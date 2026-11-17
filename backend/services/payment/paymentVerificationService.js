'use strict';

const crypto = require('crypto');
const { platformPrisma } = require('../../config/platformDb');
const { defaultPaymentConfigService } = require('./paymentConfigService');
const { getAdapter } = require('./paymentGatewayFactory');
const { defaultPaymentRegistrationService } = require('./paymentRegistrationService');

/**
 * Payment Verification Service
 *
 * Verifies gateway payment responses and cryptographically advances transaction states
 * using the privileged platform_ops database client.
 */
class PaymentVerificationService {
  constructor(options = {}) {
    this.prisma = options.prisma || platformPrisma;
    this.configService = options.configService || defaultPaymentConfigService;
    this.registrationService = options.registrationService || defaultPaymentRegistrationService;
    this.getAdapter = options.getAdapter || getAdapter;
  }

  /**
   * Verifies client-side payment completion payload.
   *
   * @param {Object} params
   * @param {string} params.collegeId - College UUID
   * @param {string} params.transactionId - Transaction UUID
   * @param {Object} params.paymentDetails - Gateway-specific payment response
   * @param {string} [params.expectedUserId] - Student user UUID to verify caller ownership
   * @param {string} [params.expectedExternalEmail] - External participant email to verify caller ownership
   * @returns {Promise<Object>} Verification and registration result
   */
  async verifyPayment(params) {
    const { collegeId, transactionId, paymentDetails, expectedUserId, expectedExternalEmail } = params;

    if (!collegeId) throw new Error('collegeId is required');
    if (!transactionId) throw new Error('transactionId is required');
    if (!paymentDetails) throw new Error('paymentDetails are required');

    // 1. Fetch transaction
    const txn = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!txn || txn.collegeId !== collegeId) {
      const err = new Error(`Transaction ${transactionId} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Caller authorization checks
    if (expectedUserId && txn.userId && txn.userId !== expectedUserId) {
      const err = new Error('Unauthorized: Transaction does not belong to the authenticated student');
      err.statusCode = 403;
      throw err;
    }

    if (expectedExternalEmail && txn.externalParticipantId) {
      const ext = await this.prisma.externalParticipant.findUnique({
        where: { id: txn.externalParticipantId },
      });
      if (!ext || ext.email.toLowerCase() !== expectedExternalEmail.toLowerCase()) {
        const err = new Error('Unauthorized: Transaction does not belong to the authenticated external participant');
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. If already confirmed PAID, ensure registration is complete and return idempotently
    if (txn.status === 'PAID') {
      const regResult = await this.registrationService.completePaidRegistration({
        collegeId,
        transactionId: txn.id,
      });
      return {
        success: true,
        idempotent: true,
        message: 'Payment already verified.',
        registration: regResult.registration,
      };
    }

    if (txn.status === 'LATE_PAYMENT') {
      return {
        success: false,
        status: 'LATE_PAYMENT',
        message: 'Payment was received after the seat reservation expired. A refund will be initiated.',
        transactionId: txn.id,
        registration: null,
      };
    }

    if (txn.status === 'FAILED') {
      const err = new Error('Cannot verify payment: Transaction is in terminal FAILED state');
      err.statusCode = 400;
      throw err;
    }

    if (txn.status !== 'PENDING') {
      const err = new Error(`Transaction is not in PENDING state (current: ${txn.status})`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Resolve College Configuration & Decrypted Gateway Credentials
    const config = await this.configService.getDecryptedConfig(collegeId);
    const adapter = this.getAdapter(txn.gatewayProvider);

    let gatewayPaymentId = null;
    let gatewaySignature = null;
    let paymentMethod = null;
    let vpaMasked = null;

    // 4. Provider-Specific Verification
    if (txn.gatewayProvider === 'RAZORPAY') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;

      if (!razorpay_payment_id || !razorpay_signature) {
        const err = new Error('Missing Razorpay payment ID or signature in callback payload');
        err.statusCode = 400;
        throw err;
      }

      // Guard against order ID mismatch attacks
      if (razorpay_order_id && razorpay_order_id !== txn.gatewayOrderId) {
        const err = new Error('Order ID mismatch: client razorpay_order_id does not match transaction gatewayOrderId');
        err.statusCode = 400;
        throw err;
      }

      const isValid = adapter.verifyPayment(
        {
          orderId: txn.gatewayOrderId,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
        },
        config
      );

      if (!isValid) {
        // Record failure in database
        await this.failPayment({
          collegeId,
          transactionId: txn.id,
          reason: 'Cryptographic signature verification failed',
        });
        const err = new Error('Payment verification failed: Invalid gateway signature');
        err.statusCode = 400;
        throw err;
      }

      gatewayPaymentId = razorpay_payment_id;
      gatewaySignature = razorpay_signature;

      // Authoritative verification with Razorpay API (status, amount, currency)
      try {
        let statusDetails = await adapter.fetchPaymentStatus(razorpay_payment_id, config);

        // If authorized but not yet captured, attempt authoritative capture
        if (statusDetails.status === 'authorized' && typeof adapter.capturePayment === 'function') {
          try {
            const captureRes = await adapter.capturePayment(
              razorpay_payment_id,
              txn.amount,
              txn.currency,
              config
            );
            if (captureRes.status === 'captured') {
              if (captureRes.amount !== undefined && Math.abs(captureRes.amount - Number(txn.amount)) > 0.01) {
                console.warn(`[PaymentVerificationService] Capture amount mismatch: expected ${txn.amount}, received ${captureRes.amount}`);
              } else if (captureRes.currency && txn.currency && captureRes.currency.toUpperCase() !== txn.currency.toUpperCase()) {
                console.warn(`[PaymentVerificationService] Capture currency mismatch: expected ${txn.currency}, received ${captureRes.currency}`);
              } else {
                statusDetails = { ...statusDetails, ...captureRes, status: 'captured', captured: true };
              }
            }
          } catch (captureErr) {
            console.warn('[PaymentVerificationService] Razorpay capture attempt failed:', captureErr.message);
          }
        }

        // Do not mark an authorized payment as PAID. Only complete after authoritative capture confirmation.
        if (statusDetails.status !== 'captured') {
          if (statusDetails.status === 'authorized') {
            return {
              success: true,
              status: 'PAYMENT_AUTHORIZED_PENDING_CAPTURE',
              warning: 'PAYMENT_AUTHORIZED_PENDING_CAPTURE',
              message: 'Payment was authorized by the gateway but capture is pending. Registration will be confirmed once capture completes.',
              transactionId: txn.id,
              registration: null,
            };
          }

          await this.failPayment({
            collegeId,
            transactionId: txn.id,
            reason: `Razorpay payment is not captured (status: ${statusDetails.status})`,
          });
          const err = new Error(`Payment verification failed: Status is ${statusDetails.status}`);
          err.statusCode = 400;
          throw err;
        }

        if (statusDetails.amount !== undefined && Math.abs(statusDetails.amount - Number(txn.amount)) > 0.01) {
          await this.failPayment({
            collegeId,
            transactionId: txn.id,
            reason: `Razorpay payment amount mismatch: expected ${txn.amount}, received ${statusDetails.amount}`,
          });
          const err = new Error('Payment verification failed: Amount mismatch');
          err.statusCode = 400;
          throw err;
        }

        if (statusDetails.currency && txn.currency && statusDetails.currency.toUpperCase() !== txn.currency.toUpperCase()) {
          await this.failPayment({
            collegeId,
            transactionId: txn.id,
            reason: `Razorpay currency mismatch: expected ${txn.currency}, received ${statusDetails.currency}`,
          });
          const err = new Error('Payment verification failed: Currency mismatch');
          err.statusCode = 400;
          throw err;
        }

        paymentMethod = statusDetails.method || null;
        vpaMasked = statusDetails.vpa || null;
      } catch (fetchErr) {
        if (fetchErr.statusCode === 400) throw fetchErr;
        // Non-fatal if fetch status network fails; cryptographic signature was verified
        console.warn('[PaymentVerificationService] Authoritative status check warning:', fetchErr.message);
      }
    } else if (txn.gatewayProvider === 'CASHFREE') {
      const verification = await adapter.verifyPayment(
        { orderId: txn.id, paymentId: paymentDetails.cf_payment_id },
        config
      );

      if (!verification.isValid) {
        await this.failPayment({
          collegeId,
          transactionId: txn.id,
          reason: verification.reason || 'Cashfree payment verification failed',
        });
        const err = new Error(`Payment verification failed: ${verification.reason || 'Verification rejected'}`);
        err.statusCode = 400;
        throw err;
      }

      if (verification.amount !== undefined && Math.abs(verification.amount - Number(txn.amount)) > 0.01) {
        await this.failPayment({
          collegeId,
          transactionId: txn.id,
          reason: `Payment amount mismatch: expected ${txn.amount}, received ${verification.amount}`,
        });
        const err = new Error('Payment verification failed: Amount mismatch');
        err.statusCode = 400;
        throw err;
      }

      if (verification.currency && txn.currency && verification.currency.toUpperCase() !== txn.currency.toUpperCase()) {
        await this.failPayment({
          collegeId,
          transactionId: txn.id,
          reason: `Payment currency mismatch: expected ${txn.currency}, received ${verification.currency}`,
        });
        const err = new Error('Payment verification failed: Currency mismatch');
        err.statusCode = 400;
        throw err;
      }

      gatewayPaymentId = verification.gatewayPaymentId;
      gatewaySignature = 'cf_verified_' + crypto.randomBytes(16).toString('hex');
      paymentMethod = verification.paymentMethod || null;
      vpaMasked = verification.vpa || null;
    }

    // 5. Invoke PostgreSQL transition function `fn_complete_payment_transaction` via platform_ops
    await this.prisma.$executeRaw`
      SELECT public.fn_complete_payment_transaction(
        ${collegeId}::uuid,
        ${txn.id}::uuid,
        ${gatewayPaymentId},
        ${gatewaySignature},
        ${paymentMethod},
        ${vpaMasked}
      )
    `;

    // 6. Complete Paid Registration and update seat hold
    let regResult;
    try {
      regResult = await this.registrationService.completePaidRegistration({
        collegeId,
        transactionId: txn.id,
      });
    } catch (regErr) {
      await this.prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          failureReason: `Paid but registration creation failed: ${regErr.message}`,
        },
      });
      return {
        success: true,
        warning: 'PAYMENT_RECEIVED_REGISTRATION_PENDING',
        message: 'Payment was received successfully, but registration completion encountered an issue and is pending administrative confirmation.',
        transactionId: txn.id,
        registration: null,
      };
    }

    if (regResult && regResult.status === 'LATE_PAYMENT') {
      return {
        success: false,
        status: 'LATE_PAYMENT',
        message: regResult.message,
        transactionId: txn.id,
        registration: null,
      };
    }

    return {
      success: true,
      message: 'Payment successfully verified and registration confirmed',
      transactionId: txn.id,
      registration: regResult.registration,
    };
  }

  /**
   * Transitions a transaction to FAILED status using `fn_fail_payment_transaction`.
   * Releases seat reservation if applicable.
   *
   * @param {Object} params
   * @param {string} params.collegeId - College UUID
   * @param {string} params.transactionId - Transaction UUID
   * @param {string} [params.reason] - Failure reason
   */
  async failPayment(params) {
    const { collegeId, transactionId, reason } = params;

    await this.prisma.$executeRaw`
      SELECT public.fn_fail_payment_transaction(
        ${collegeId}::uuid,
        ${transactionId}::uuid,
        ${reason || 'Payment failed or rejected'}
      )
    `;

    // Release seat hold if reservation exists
    const txn = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      select: { reservationId: true },
    });

    if (txn && txn.reservationId) {
      await this.prisma.seatReservation.update({
        where: { id: txn.reservationId },
        data: { status: 'RELEASED' },
      });
    }
  }
}

const defaultPaymentVerificationService = new PaymentVerificationService();

module.exports = {
  PaymentVerificationService,
  defaultPaymentVerificationService,
};
