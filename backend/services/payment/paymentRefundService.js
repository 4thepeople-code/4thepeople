'use strict';

const crypto = require('crypto');
const { platformPrisma } = require('../../config/platformDb');
const { defaultPaymentConfigService } = require('./paymentConfigService');
const { getAdapter } = require('./paymentGatewayFactory');

/**
 * Payment Refund Service
 *
 * Implements strict financial lifecycle management for full and partial refunds.
 * Lifecycle Invariants:
 * - Dispatching a gateway refund request leaves the refund in INITIATED status.
 * - An accepted but pending gateway response NEVER marks the refund PROCESSED.
 * - Only verified confirmation of successful refund processing marks it PROCESSED.
 * - Failed refunds are recorded as FAILED.
 * - Parent transaction transitions to PARTIALLY_REFUNDED or REFUNDED strictly after confirmed PROCESSED amounts.
 * - Sum of INITIATED and PROCESSED refunds cannot exceed the transaction's paid amount.
 */
class PaymentRefundService {
  constructor(options = {}) {
    this.prisma = options.prisma || platformPrisma;
    this.configService = options.configService || defaultPaymentConfigService;
    this.getAdapter = options.getAdapter || getAdapter;
  }

  /**
   * Initiates a refund for an eligible transaction.
   *
   * @param {Object} params
   * @param {string} params.collegeId - College UUID
   * @param {string} params.transactionId - Transaction UUID
   * @param {number} [params.amount] - Amount in currency units (defaults to remaining balance)
   * @param {string} [params.reason] - Refund note / reason
   * @param {string} [params.initiatedByAdminId] - Admin initiating the refund
   * @returns {Promise<Object>} Refund result
   */
  async processRefund(params) {
    const {
      collegeId,
      transactionId,
      amount,
      reason,
      initiatedByAdminId,
      refundId: requestedRefundId,
      idempotencyKey: requestedIdempotencyKey,
    } = params;

    if (!collegeId) throw new Error('collegeId is required');
    if (!transactionId) throw new Error('transactionId is required');

    // 1. Fetch transaction and verify status
    const txn = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        refunds: true,
      },
    });

    if (!txn || txn.collegeId !== collegeId) {
      const err = new Error(`Transaction ${transactionId} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Idempotency check: inspect existing refund by requestedIdempotencyKey across the college
    if (requestedIdempotencyKey) {
      const existingByIdempotency = await this.prisma.paymentRefund.findFirst({
        where: {
          collegeId,
          idempotencyKey: requestedIdempotencyKey,
        },
      });

      if (existingByIdempotency) {
        // Reject reuse of an idempotency key with a different amount or transaction
        if (
          existingByIdempotency.transactionId !== transactionId ||
          (amount !== undefined && amount !== null && Math.abs(existingByIdempotency.amount - Number(amount)) > 0.01)
        ) {
          const err = new Error(
            `Idempotency key '${requestedIdempotencyKey}' was already used for a different refund request (transaction: ${existingByIdempotency.transactionId}, amount: ${existingByIdempotency.amount})`
          );
          err.statusCode = 409;
          throw err;
        }

        return {
          success: true,
          idempotent: true,
          refundId: existingByIdempotency.id,
          gatewayRefundId: existingByIdempotency.gatewayRefundId,
          amount: existingByIdempotency.amount,
          status: existingByIdempotency.status,
          message: existingByIdempotency.status === 'PROCESSED'
            ? 'Refund already processed successfully.'
            : 'Refund request already initiated and pending gateway confirmation.',
          transactionStatus: txn.status,
        };
      }
    }

    // Idempotent recovery if refundId was provided and already exists
    if (requestedRefundId) {
      const existingRefund = await this.prisma.paymentRefund.findUnique({
        where: { id: requestedRefundId },
      });
      if (existingRefund && existingRefund.collegeId === collegeId) {
        if (
          existingRefund.transactionId !== transactionId ||
          (amount !== undefined && amount !== null && Math.abs(existingRefund.amount - Number(amount)) > 0.01)
        ) {
          const err = new Error(
            `Refund ID '${requestedRefundId}' was already used for a different refund request`
          );
          err.statusCode = 409;
          throw err;
        }
        if (existingRefund.status === 'PROCESSED') {
          return {
            success: true,
            idempotent: true,
            refundId: existingRefund.id,
            gatewayRefundId: existingRefund.gatewayRefundId,
            amount: existingRefund.amount,
            status: 'PROCESSED',
            transactionStatus: txn.status,
          };
        }
        if (existingRefund.status === 'INITIATED') {
          return {
            success: true,
            idempotent: true,
            refundId: existingRefund.id,
            gatewayRefundId: existingRefund.gatewayRefundId,
            amount: existingRefund.amount,
            status: 'INITIATED',
            gatewayStatus: 'pending',
            message: 'Refund request already initiated and pending gateway confirmation.',
            transactionStatus: txn.status,
          };
        }
      }
    }

    if (txn.status !== 'PAID' && txn.status !== 'PARTIALLY_REFUNDED' && txn.status !== 'LATE_PAYMENT') {
      const err = new Error(`Cannot refund transaction with status ${txn.status} (expected PAID, PARTIALLY_REFUNDED, or LATE_PAYMENT)`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Calculate remaining refundable balance
    // Both INITIATED (in-flight/pending) and PROCESSED (confirmed) refunds reserve balance
    const allocatedRefundSum = txn.refunds
      .filter((r) => r.status === 'INITIATED' || r.status === 'PROCESSED')
      .reduce((sum, r) => sum + r.amount, 0);

    const remainingBalance = txn.amount - allocatedRefundSum;
    if (remainingBalance <= 0) {
      const err = new Error('Transaction has already been fully refunded or in-flight refund covers full balance');
      err.statusCode = 400;
      throw err;
    }

    const refundAmount = amount !== undefined && amount !== null ? Number(amount) : remainingBalance;
    if (isNaN(refundAmount) || refundAmount <= 0) {
      const err = new Error('Refund amount must be strictly greater than zero');
      err.statusCode = 400;
      throw err;
    }

    if (refundAmount > remainingBalance) {
      const err = new Error(
        `Requested refund amount (${refundAmount}) exceeds remaining refundable balance (${remainingBalance})`
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Insert `payment_refunds` record with status `INITIATED` and NULL gateway_refund_id
    // Guarded by database trigger `trg_verify_payment_refund_creation`
    const refundId = requestedRefundId || crypto.randomUUID();
    const idempotencyKey = requestedIdempotencyKey || refundId;

    let refundRecord;
    try {
      refundRecord = await this.prisma.paymentRefund.create({
        data: {
          id: refundId,
          collegeId,
          transactionId: txn.id,
          amount: refundAmount,
          status: 'INITIATED',
          reason: reason || 'Requested refund',
          initiatedByAdminId: initiatedByAdminId || null,
          idempotencyKey,
        },
      });
    } catch (insertErr) {
      if (insertErr.code === 'P2002') {
        // Concurrent duplicate request inserted the refund record first
        const duplicateRecord = await this.prisma.paymentRefund.findFirst({
          where: { collegeId, idempotencyKey },
        });
        if (duplicateRecord) {
          if (
            duplicateRecord.transactionId !== transactionId ||
            Math.abs(duplicateRecord.amount - refundAmount) > 0.01
          ) {
            const err = new Error(
              `Idempotency key '${idempotencyKey}' was already used for a different refund request`
            );
            err.statusCode = 409;
            throw err;
          }
          return {
            success: true,
            idempotent: true,
            refundId: duplicateRecord.id,
            gatewayRefundId: duplicateRecord.gatewayRefundId,
            amount: duplicateRecord.amount,
            status: duplicateRecord.status,
            message: 'Refund request already initiated concurrently.',
            transactionStatus: txn.status,
          };
        }
      }
      throw insertErr;
    }

    // 4. Resolve Gateway Adapter and Decrypted Credentials
    const config = await this.configService.getDecryptedConfig(collegeId);
    const adapter = this.getAdapter(txn.gatewayProvider);

    // 5. Dispatch Refund to Gateway (Executed outside DB locks)
    let gatewayRefundRes;
    try {
      if (txn.gatewayProvider === 'RAZORPAY') {
        if (!txn.gatewayPaymentId) {
          throw new Error('Missing gatewayPaymentId for Razorpay refund');
        }
        gatewayRefundRes = await adapter.initiateRefund(
          {
            paymentId: txn.gatewayPaymentId,
            refundId: refundRecord.id,
            amount: refundAmount,
            reason: reason || 'Refund',
            idempotencyKey,
          },
          config
        );
      } else if (txn.gatewayProvider === 'CASHFREE') {
        gatewayRefundRes = await adapter.initiateRefund(
          {
            orderId: txn.id,
            refundId: refundRecord.id,
            amount: refundAmount,
            reason: reason || 'Refund',
            idempotencyKey,
          },
          config
        );
      }
    } catch (gatewayErr) {
      // Mark refund as FAILED if gateway rejected the request
      await this.markRefundFailed(collegeId, refundRecord.id, gatewayErr.message);
      throw gatewayErr;
    }

    // 6. Check Gateway Response State
    // Gateway responses can be:
    // - Pending / Created: 'pending', 'created', 'ONHOLD'
    // - Immediate Processed: 'processed', 'SUCCESS'
    // - Immediate Failed: 'failed', 'FAILED'
    const isImmediateSuccess =
      gatewayRefundRes &&
      (gatewayRefundRes.status === 'processed' || gatewayRefundRes.status === 'SUCCESS');

    const isImmediateFailure =
      gatewayRefundRes &&
      (gatewayRefundRes.status === 'failed' || gatewayRefundRes.status === 'FAILED');

    if (isImmediateSuccess) {
      return await this.confirmRefundSuccess(
        collegeId,
        refundRecord.id,
        gatewayRefundRes.gatewayRefundId
      );
    }

    if (isImmediateFailure) {
      return await this.markRefundFailed(
        collegeId,
        refundRecord.id,
        gatewayRefundRes.message || 'Refund failed by gateway'
      );
    }

    // If accepted but pending, save gatewayRefundId but leave status INITIATED
    await this.prisma.paymentRefund.update({
      where: { id: refundRecord.id },
      data: {
        gatewayRefundId: gatewayRefundRes.gatewayRefundId || null,
        status: 'INITIATED',
      },
    });

    return {
      success: true,
      refundId: refundRecord.id,
      gatewayRefundId: gatewayRefundRes.gatewayRefundId,
      amount: refundAmount,
      status: 'INITIATED',
      gatewayStatus: gatewayRefundRes.status || 'pending',
      message: 'Refund request accepted by gateway; pending asynchronous processing confirmation.',
      transactionStatus: txn.status,
    };
  }

  /**
   * Confirms successful refund processing after verified gateway completion (webhook or API).
   * Transitions refund to PROCESSED and updates parent transaction.
   *
   * @param {string} collegeId
   * @param {string} refundId
   * @param {string} [gatewayRefundId]
   * @returns {Promise<Object>}
   */
  async confirmRefundSuccess(collegeId, refundId, gatewayRefundId = null) {
    if (!collegeId || !refundId) throw new Error('collegeId and refundId are required');

    return await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findUnique({
        where: { id: refundId },
      });

      if (!refund || refund.collegeId !== collegeId) {
        throw new Error(`Refund ${refundId} not found`);
      }

      if (refund.status === 'PROCESSED') {
        // Idempotent confirmation
        const txn = await tx.paymentTransaction.findUnique({
          where: { id: refund.transactionId },
          select: { status: true },
        });
        return {
          success: true,
          idempotent: true,
          refundId: refund.id,
          gatewayRefundId: refund.gatewayRefundId,
          amount: refund.amount,
          status: 'PROCESSED',
          transactionStatus: txn.status,
        };
      }

      // Mark refund as PROCESSED
      await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: 'PROCESSED',
          gatewayRefundId: gatewayRefundId || refund.gatewayRefundId,
        },
      });

      // Calculate total confirmed processed refunds for parent transaction
      const allRefunds = await tx.paymentRefund.findMany({
        where: {
          transactionId: refund.transactionId,
          collegeId,
        },
      });

      const totalProcessed = allRefunds
        .filter((r) => r.id === refund.id || r.status === 'PROCESSED')
        .reduce((sum, r) => sum + r.amount, 0);

      const txn = await tx.paymentTransaction.findUnique({
        where: { id: refund.transactionId },
      });

      // Update parent transaction state
      const newTxnStatus = totalProcessed >= txn.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.paymentTransaction.update({
        where: { id: txn.id },
        data: { status: newTxnStatus },
      });

      return {
        success: true,
        refundId: refund.id,
        gatewayRefundId: gatewayRefundId || refund.gatewayRefundId,
        amount: refund.amount,
        status: 'PROCESSED',
        transactionStatus: newTxnStatus,
      };
    });
  }

  /**
   * Marks a refund as FAILED (due to gateway rejection or webhook notification).
   *
   * @param {string} collegeId
   * @param {string} refundId
   * @param {string} [reason]
   * @returns {Promise<Object>}
   */
  async markRefundFailed(collegeId, refundId, reason = null) {
    if (!collegeId || !refundId) throw new Error('collegeId and refundId are required');

    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
    });

    if (!refund || refund.collegeId !== collegeId) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status === 'PROCESSED') {
      throw new Error(`Cannot fail a refund that is already PROCESSED`);
    }

    await this.prisma.paymentRefund.update({
      where: { id: refund.id },
      data: {
        status: 'FAILED',
        reason: reason ? `${refund.reason || ''} [Failed: ${reason}]`.trim() : refund.reason,
      },
    });

    return {
      success: true,
      refundId: refund.id,
      status: 'FAILED',
    };
  }

  /**
   * Syncs refund status with gateway API.
   *
   * @param {string} collegeId
   * @param {string} transactionId
   * @param {string} refundId
   * @returns {Promise<Object>}
   */
  async syncRefundStatus(collegeId, transactionId, refundId) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { transaction: true },
    });

    if (!refund || refund.collegeId !== collegeId) {
      throw new Error('Refund not found');
    }

    if (refund.status === 'PROCESSED' || refund.status === 'FAILED') {
      return { success: true, status: refund.status, alreadyFinal: true };
    }

    const config = await this.configService.getDecryptedConfig(collegeId);
    const adapter = this.getAdapter(refund.transaction.gatewayProvider);

    let statusRes;
    if (refund.transaction.gatewayProvider === 'RAZORPAY') {
      if (!refund.gatewayRefundId) {
        return { success: false, message: 'No gatewayRefundId to query' };
      }
      statusRes = await adapter.fetchRefundStatus(refund.gatewayRefundId, config);
    } else if (refund.transaction.gatewayProvider === 'CASHFREE') {
      statusRes = await adapter.fetchRefundStatus(refund.transactionId, refund.id, config);
    }

    if (statusRes.status === 'processed' || statusRes.status === 'SUCCESS') {
      return await this.confirmRefundSuccess(collegeId, refund.id, statusRes.gatewayRefundId);
    } else if (statusRes.status === 'failed' || statusRes.status === 'FAILED') {
      return await this.markRefundFailed(collegeId, refund.id, 'Gateway reported failed status');
    }

    return { success: true, status: 'INITIATED', gatewayStatus: statusRes.status };
  }
}

const defaultPaymentRefundService = new PaymentRefundService();

module.exports = {
  PaymentRefundService,
  defaultPaymentRefundService,
};
