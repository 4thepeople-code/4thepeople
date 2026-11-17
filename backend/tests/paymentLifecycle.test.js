'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { PaymentOrderService } = require('../services/payment/paymentOrderService');
const { PaymentVerificationService } = require('../services/payment/paymentVerificationService');
const { PaymentRegistrationService } = require('../services/payment/paymentRegistrationService');
const { PaymentWebhookService } = require('../services/payment/paymentWebhookService');
const { PaymentRefundService } = require('../services/payment/paymentRefundService');
const RazorpayAdapter = require('../services/payment/adapters/razorpayAdapter');
const CashfreeAdapter = require('../services/payment/adapters/cashfreeAdapter');

test('Payment Lifecycle: Checkout, Verification, Webhooks, and Refunds', async (t) => {
  const collegeId = '11111111-1111-4111-8111-111111111111';
  const eventId = '22222222-2222-4222-8222-222222222222';
  const freeEventId = '33333333-3333-4333-8333-333333333333';
  const userId = '44444444-4444-4444-8444-444444444444';

  process.env.GATEWAY_ENCRYPTION_KEY = 'a'.repeat(32);

  // In-memory mock database store
  let mockEvent = {
    id: eventId,
    collegeId,
    title: 'Hackathon 2026',
    isPaid: true,
    fee: 500,
    currency: 'INR',
    registrationMode: 'INTERNAL',
    capacity: 100,
    registeredCount: 10,
    startDate: new Date(),
    endDate: new Date(),
    venue: 'Auditorium',
  };

  let mockFreeEvent = {
    id: freeEventId,
    collegeId,
    title: 'Free Workshop',
    isPaid: false,
    fee: 0,
    currency: 'INR',
    registrationMode: 'INTERNAL',
    capacity: 50,
    registeredCount: 5,
  };

  let mockConfig = {
    id: 'cfg_1',
    collegeId,
    provider: 'RAZORPAY',
    mode: 'COLLEGE_OWNED_GATEWAY',
    status: 'ACTIVE',
    isTestMode: true,
    displayMerchantName: 'College Gateway',
    keyId: 'rzp_test_key123',
    keySecret: 'secret_key_456',
    webhookSecret: 'whsec_789',
  };

  let reservationsStore = [];
  let transactionsStore = [];
  let registrationsStore = [];
  let webhooksStore = [];
  let refundsStore = [];
  let externalParticipantsStore = [];
  let simulateRegistrationFailure = false;

  const mockConfigService = {
    getDecryptedConfig: async (cId) => {
      if (cId === collegeId) return mockConfig;
      const err = new Error('College config not found');
      err.statusCode = 404;
      throw err;
    },
  };

  const mockPrisma = {
    eventsWithStatus: {
      findFirst: async ({ where }) => {
        if (where.id === eventId) return { id: eventId, collegeId, status: 'UPCOMING', visibility: 'PUBLIC' };
        if (where.id === freeEventId) return { id: freeEventId, collegeId, status: 'UPCOMING', visibility: 'PUBLIC' };
        return null;
      },
    },
    event: {
      findFirst: async ({ where }) => {
        if (where.id === eventId) return mockEvent;
        if (where.id === freeEventId) return mockFreeEvent;
        return null;
      },
    },
    eventRegistration: {
      findFirst: async ({ where }) => {
        return (
          registrationsStore.find(
            (r) =>
              r.collegeId === where.collegeId &&
              (where.paymentTransactionId ? r.paymentTransactionId === where.paymentTransactionId : true) &&
              (where.userId ? r.userId === where.userId : true) &&
              (where.externalParticipantId ? r.externalParticipantId === where.externalParticipantId : true) &&
              (where.eventId ? r.eventId === where.eventId : true)
          ) || null
        );
      },
      create: async ({ data }) => {
        if (simulateRegistrationFailure) {
          throw new Error('Simulated database trigger capacity overflow');
        }
        const row = { id: 'reg_' + (registrationsStore.length + 1), ...data };
        registrationsStore.push(row);
        return row;
      },
    },
    seatReservation: {
      findFirst: async ({ where, include, select }) => {
        if (include && include.paymentTransaction === true) {
          throw new Error('Database permission violation: include paymentTransaction without explicit select violates app_user column grants (gateway_signature)');
        }
        if (select && select.paymentTransaction && !select.paymentTransaction.select) {
          throw new Error('Database permission violation: selecting full paymentTransaction violates app_user column grants');
        }
        if (select && select.paymentTransaction && select.paymentTransaction.select) {
          const ptSelect = select.paymentTransaction.select;
          if (ptSelect.gatewaySignature || ptSelect.idempotencyKey || ptSelect.merchantAccountId || ptSelect.registrationPayload) {
            throw new Error('Database permission violation: attempted to select secret paymentTransaction column under app_user');
          }
        }
        return (
          reservationsStore.find(
            (r) =>
              r.collegeId === where.collegeId &&
              r.eventId === where.eventId &&
              r.status === where.status &&
              (where.userId ? r.userId === where.userId : true) &&
              (where.externalParticipantId ? r.externalParticipantId === where.externalParticipantId : true) &&
              (!where.expiresAt || r.expiresAt > where.expiresAt.gt)
          ) || null
        );
      },
      findUnique: async ({ where }) => {
        return reservationsStore.find((r) => r.id === where.id) || null;
      },
      count: async () => reservationsStore.filter((r) => r.status === 'HELD').length,
      create: async ({ data }) => {
        const row = { id: 'res_' + (reservationsStore.length + 1), ...data };
        reservationsStore.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = reservationsStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of reservationsStore) {
          if (where.id && r.id !== where.id) continue;
          if (where.collegeId && r.collegeId !== where.collegeId) continue;
          if (where.status && r.status !== where.status) continue;
          if (where.expiresAt && where.expiresAt.gt && r.expiresAt <= where.expiresAt.gt) continue;
          Object.assign(r, data);
          count++;
        }
        return { count };
      },
    },
    paymentTransaction: {
      create: async ({ data, select }) => {
        if (select) {
          if (select.gatewaySignature || select.idempotencyKey || select.merchantAccountId || select.registrationPayload) {
            throw new Error('Database permission violation: attempted to select secret paymentTransaction column under app_user');
          }
        }
        const row = { ...data, createdAt: new Date(), updatedAt: new Date(), refunds: [] };
        transactionsStore.push(row);
        const res = reservationsStore.find((r) => r.id === row.reservationId);
        if (res) res.paymentTransaction = row;
        return row;
      },
      findFirst: async ({ where }) => {
        return (
          transactionsStore.find((t) => {
            if (where.gatewayOrderId && t.gatewayOrderId === where.gatewayOrderId) return true;
            if (where.gatewayPaymentId && t.gatewayPaymentId === where.gatewayPaymentId) return true;
            if (where.OR) {
              return where.OR.some((cond) => (cond.id && t.id === cond.id) || (cond.gatewayOrderId && t.gatewayOrderId === cond.gatewayOrderId));
            }
            return false;
          }) || null
        );
      },
      findUnique: async ({ where }) => {
        const txn = transactionsStore.find((t) => t.id === where.id);
        if (!txn) return null;
        return {
          ...txn,
          event: mockEvent,
          refunds: refundsStore.filter((rf) => rf.transactionId === txn.id),
        };
      },
      update: async ({ where, data }) => {
        const row = transactionsStore.find((t) => t.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    paymentWebhookEvent: {
      findUnique: async ({ where }) => {
        const key = `${where.provider_gatewayEventId.provider}:${where.provider_gatewayEventId.gatewayEventId}`;
        return webhooksStore.find((w) => `${w.provider}:${w.gatewayEventId}` === key) || null;
      },
      create: async ({ data }) => {
        const key = `${data.provider}:${data.gatewayEventId}`;
        const duplicate = webhooksStore.find((w) => `${w.provider}:${w.gatewayEventId}` === key);
        if (duplicate) {
          const err = new Error('Unique constraint failed on uq_payment_webhooks_provider_event');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || 'wh_' + (webhooksStore.length + 1),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        webhooksStore.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const w of webhooksStore) {
          if (where.provider && w.provider !== where.provider) continue;
          if (where.gatewayEventId && w.gatewayEventId !== where.gatewayEventId) continue;
          if (where.claimToken && w.claimToken !== where.claimToken) continue;
          if (where.OR) {
            const matchesOr = where.OR.some((cond) => {
              if (cond.status && w.status !== cond.status) return false;
              if (cond.updatedAt && cond.updatedAt.lte) {
                if (new Date(w.updatedAt || w.createdAt) > cond.updatedAt.lte) return false;
              }
              return true;
            });
            if (!matchesOr) continue;
          }
          Object.assign(w, data);
          count++;
        }
        return { count };
      },
      upsert: async ({ where, create, update }) => {
        const key = `${where.provider_gatewayEventId.provider}:${where.provider_gatewayEventId.gatewayEventId}`;
        let row = webhooksStore.find((w) => `${w.provider}:${w.gatewayEventId}` === key);
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
        } else {
          row = {
            id: 'wh_' + (webhooksStore.length + 1),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          webhooksStore.push(row);
        }
        return row;
      },
      update: async ({ where, data }) => {
        let row;
        if (where && where.provider_gatewayEventId) {
          const key = `${where.provider_gatewayEventId.provider}:${where.provider_gatewayEventId.gatewayEventId}`;
          row = webhooksStore.find((w) => `${w.provider}:${w.gatewayEventId}` === key);
        } else if (where && where.id) {
          row = webhooksStore.find((w) => w.id === where.id);
        }
        if (row) Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    paymentRefund: {
      create: async ({ data }) => {
        if (data.idempotencyKey) {
          const duplicate = refundsStore.find(
            (r) => r.collegeId === data.collegeId && r.idempotencyKey === data.idempotencyKey
          );
          if (duplicate) {
            const err = new Error('Unique constraint failed on uq_payment_refunds_college_idempotency');
            err.code = 'P2002';
            throw err;
          }
        }
        const row = { id: data.id || 'rf_' + (refundsStore.length + 1), createdAt: new Date(), updatedAt: new Date(), ...data };
        refundsStore.push(row);
        return row;
      },
      findUnique: async ({ where }) => {
        return refundsStore.find((r) => r.id === where.id) || null;
      },
      findFirst: async ({ where }) => {
        return (
          refundsStore.find((r) => {
            if (where.id && r.id !== where.id) return false;
            if (where.collegeId && r.collegeId !== where.collegeId) return false;
            if (where.transactionId && r.transactionId !== where.transactionId) return false;
            if (where.gatewayRefundId && r.gatewayRefundId !== where.gatewayRefundId) return false;
            if (where.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) return false;
            if (where.status && r.status !== where.status) return false;
            if (where.OR) {
              return where.OR.some((cond) => {
                if (cond.id && r.id === cond.id) return true;
                if (cond.gatewayRefundId && r.gatewayRefundId === cond.gatewayRefundId) return true;
                if (cond.transactionId && r.transactionId === cond.transactionId) {
                  if (cond.status && r.status !== cond.status) return false;
                  return true;
                }
                return false;
              });
            }
            return true;
          }) || null
        );
      },
      findMany: async ({ where }) => {
        return refundsStore.filter((r) => {
          if (where && where.transactionId && r.transactionId !== where.transactionId) return false;
          if (where && where.collegeId && r.collegeId !== where.collegeId) return false;
          return true;
        });
      },
      update: async ({ where, data }) => {
        const row = refundsStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    externalParticipant: {
      findFirst: async ({ where }) => {
        return (
          externalParticipantsStore.find((p) => {
            if (where.collegeId && p.collegeId !== where.collegeId) return false;
            if (where.email && p.email.toLowerCase() !== where.email.toLowerCase()) return false;
            if (where.id && p.id !== where.id) return false;
            return true;
          }) || null
        );
      },
      findUnique: async ({ where }) => {
        return (
          externalParticipantsStore.find((p) => {
            if (where.id && p.id === where.id) return true;
            if (where.collegeId_email) {
              return (
                p.collegeId === where.collegeId_email.collegeId &&
                p.email.toLowerCase() === where.collegeId_email.email.toLowerCase()
              );
            }
            return false;
          }) || null
        );
      },
      create: async ({ data }) => {
        const row = { id: data.id || 'ext_part_' + (externalParticipantsStore.length + 1), ...data };
        externalParticipantsStore.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = externalParticipantsStore.find((p) => p.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    user: {
      findUnique: async ({ where }) => {
        if (where.id === userId) {
          return {
            id: userId,
            name: 'Priya Sharma',
            email: 'priya@college.edu',
            rollNumber: 'CS2026-01',
            collegeId,
            college: { name: 'Engineering College' },
          };
        }
        if (where.id) {
          return {
            id: where.id,
            name: 'Test Student ' + where.id.slice(0, 4),
            email: `student_${where.id.slice(0, 4)}@college.edu`,
            rollNumber: 'CS2026-99',
            collegeId,
            college: { name: 'Engineering College' },
          };
        }
        return null;
      },
    },
    emailOutbox: {
      create: async ({ data }) => ({ id: 'email_outbox_1', ...data }),
    },
    $executeRaw: async (query, ...params) => {
      const values = Array.isArray(query) ? params : (query && query.values ? query.values : params);
      const queryStr = Array.isArray(query)
        ? query.join('?')
        : typeof query === 'string'
          ? query
          : (query && query.strings ? query.strings.join('?') : '');

      if (queryStr.includes('fn_complete_payment_transaction')) {
        const txnId = values[1];
        const payId = values[2];
        const sig = values[3];
        const txn = transactionsStore.find((t) => t.id === txnId);
        if (txn) {
          txn.status = 'PAID';
          txn.gatewayPaymentId = payId;
          txn.gatewaySignature = sig;
          txn.updatedAt = new Date();
        }
      } else if (queryStr.includes('fn_fail_payment_transaction')) {
        const txnId = values[1];
        const reason = values[2];
        const txn = transactionsStore.find((t) => t.id === txnId);
        if (txn) {
          txn.status = 'FAILED';
          txn.failureReason = reason;
          txn.updatedAt = new Date();
        }
      }
      return 1;
    },
    $transaction: async (callback) => {
      return await callback(mockPrisma);
    },
  };

  // Mock adapter factory
  let mockRefundResponseStatus = 'processed';
  let mockPaymentStatus = 'captured';
  let mockCaptureStatus = 'captured';
  const mockRazorpayAdapter = new RazorpayAdapter({
    httpClient: async (url, options) => {
      if (url.includes('/refund')) {
        const body = options && options.body ? JSON.parse(options.body) : {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'rfnd_rzp_mock_' + Date.now(),
            amount: body.amount || 20000,
            status: mockRefundResponseStatus,
          }),
        };
      }
      if (url.includes('/orders/') && url.includes('/payments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entity: 'collection',
            count: 1,
            items: [
              {
                id: 'pay_rzp_from_order_123',
                amount: 50000,
                currency: 'INR',
                status: 'captured',
                method: 'upi',
                vpa: 'authoritative@upi',
              },
            ],
          }),
        };
      }
      if (url.includes('/capture')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: url.split('/')[4] || 'pay_real_999',
            amount: 50000,
            currency: 'INR',
            status: mockCaptureStatus,
            captured: mockCaptureStatus === 'captured',
          }),
        };
      }
      if (url.includes('/payments/') && !url.includes('/refund')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'pay_real_999',
            amount: 50000,
            currency: 'INR',
            status: mockPaymentStatus,
            method: 'upi',
            vpa: 'priya@okhdfcbank',
            captured: mockPaymentStatus === 'captured',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'order_rzp_mock_999',
          amount: 50000,
          currency: 'INR',
          status: 'created',
        }),
      };
    },
  });

  const mockCashfreeAdapter = new CashfreeAdapter({
    httpClient: async (url, options) => {
      if (url.includes('/refunds')) {
        const body = options && options.body ? JSON.parse(options.body) : {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            cf_refund_id: 'cf_rfnd_999',
            refund_id: body.refund_id || 'rf_1',
            refund_status: mockRefundResponseStatus === 'processed' ? 'SUCCESS' : 'PENDING',
            refund_amount: body.refund_amount || 200,
          }),
        };
      }
      if (url.includes('/payments')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              cf_payment_id: 888123,
              payment_status: 'SUCCESS',
              payment_amount: 500,
              payment_currency: 'INR',
              payment_group: 'upi',
              payment_method: { upi: { upi_id: 'cf_user@upi' } },
            },
          ],
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          order_id: 'cf_order_999',
          order_status: 'ACTIVE',
          order_amount: 500,
          order_currency: 'INR',
        }),
      };
    },
  });

  const adapterResolver = (provider) => (provider === 'CASHFREE' ? mockCashfreeAdapter : mockRazorpayAdapter);

  const orderService = new PaymentOrderService({
    configService: mockConfigService,
    withTenant: async (cId, callback) => await callback(mockPrisma),
    getAdapter: adapterResolver,
  });
  const registrationService = new PaymentRegistrationService({ prisma: mockPrisma });
  const verificationService = new PaymentVerificationService({
    prisma: mockPrisma,
    configService: mockConfigService,
    registrationService,
    getAdapter: adapterResolver,
  });
  const refundService = new PaymentRefundService({
    prisma: mockPrisma,
    configService: mockConfigService,
    getAdapter: adapterResolver,
  });
  const webhookService = new PaymentWebhookService({
    prisma: mockPrisma,
    configService: mockConfigService,
    registrationService,
    refundService,
    getAdapter: adapterResolver,
  });

  await t.test('1. Checkout creation rejects free events', async () => {
    await assert.rejects(
      async () => {
        await orderService.createCheckoutSession({
          collegeId,
          eventId: freeEventId,
          participant: { participantType: 'STUDENT', userId },
        });
      },
      {
        message: /This is a free event/,
        statusCode: 400,
      }
    );
  });

  let activeSession = null;
  await t.test('2. Checkout session creates seat hold and PENDING transaction', async () => {
    activeSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId,
        name: 'Priya Sharma',
        email: 'priya@college.edu',
      },
    });

    assert.strictEqual(activeSession.reused, false);
    assert.ok(activeSession.transactionId);
    assert.ok(activeSession.reservationId);
    assert.strictEqual(activeSession.amount, 500);
    assert.strictEqual(activeSession.provider, 'RAZORPAY');

    const reservation = reservationsStore.find((r) => r.id === activeSession.reservationId);
    assert.ok(reservation);
    assert.strictEqual(reservation.status, 'HELD');

    const txn = transactionsStore.find((t) => t.id === activeSession.transactionId);
    assert.ok(txn);
    assert.strictEqual(txn.status, 'PENDING');
  });

  await t.test('3. Duplicate checkout request returns existing active session (Idempotent)', async () => {
    const secondSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId,
        name: 'Priya Sharma',
        email: 'priya@college.edu',
      },
    });

    assert.strictEqual(secondSession.reused, true);
    assert.strictEqual(secondSession.transactionId, activeSession.transactionId);
    assert.strictEqual(secondSession.reservationId, activeSession.reservationId);
    assert.strictEqual(reservationsStore.length, 1);
    assert.strictEqual(transactionsStore.length, 1);
  });

  await t.test('4. Payment verification fails when signature is forged', async () => {
    await assert.rejects(
      async () => {
        await verificationService.verifyPayment({
          collegeId,
          transactionId: activeSession.transactionId,
          paymentDetails: {
            razorpay_order_id: activeSession.gatewayOrderId,
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'invalid_forged_signature_hex_00000000',
          },
        });
      },
      {
        message: /Invalid gateway signature/,
        statusCode: 400,
      }
    );

    const txn = transactionsStore.find((t) => t.id === activeSession.transactionId);
    assert.strictEqual(txn.status, 'FAILED');
    const res = reservationsStore.find((r) => r.id === activeSession.reservationId);
    assert.strictEqual(res.status, 'RELEASED');
  });

  await t.test('5. Payment verification fails on order ID mismatch', async () => {
    const session = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId,
        name: 'Priya Sharma',
        email: 'priya@college.edu',
      },
    });

    await assert.rejects(
      async () => {
        await verificationService.verifyPayment({
          collegeId,
          transactionId: session.transactionId,
          paymentDetails: {
            razorpay_order_id: 'order_attacker_cheaper_order',
            razorpay_payment_id: 'pay_attacker_1',
            razorpay_signature: 'sig_attacker',
          },
        });
      },
      {
        message: /Order ID mismatch/,
        statusCode: 400,
      }
    );
  });

  await t.test('6. Payment verification fails when student caller userId does not match transaction', async () => {
    const session = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId,
        name: 'Priya Sharma',
        email: 'priya@college.edu',
      },
    });

    await assert.rejects(
      async () => {
        await verificationService.verifyPayment({
          collegeId,
          transactionId: session.transactionId,
          expectedUserId: '99999999-9999-4999-8999-999999999999',
          paymentDetails: {
            razorpay_order_id: session.gatewayOrderId,
            razorpay_payment_id: 'pay_real_999',
            razorpay_signature: 'any_sig',
          },
        });
      },
      {
        message: /Unauthorized: Transaction does not belong to the authenticated student/,
        statusCode: 403,
      }
    );
  });

  let secondSession = null;
  await t.test('7. Successful payment advances to PAID and creates EventRegistration', async () => {
    secondSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId,
        name: 'Priya Sharma',
        email: 'priya@college.edu',
      },
    });

    const paymentId = 'pay_real_999';
    const validSignature = crypto
      .createHmac('sha256', mockConfig.keySecret)
      .update(`${secondSession.gatewayOrderId}|${paymentId}`)
      .digest('hex');

    const result = await verificationService.verifyPayment({
      collegeId,
      transactionId: secondSession.transactionId,
      expectedUserId: userId,
      paymentDetails: {
        razorpay_order_id: secondSession.gatewayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      },
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.registration);
    assert.strictEqual(result.registration.userId, userId);
    assert.strictEqual(result.registration.paymentTransactionId, secondSession.transactionId);

    const txn = transactionsStore.find((t) => t.id === secondSession.transactionId);
    assert.strictEqual(txn.status, 'PAID');
    assert.strictEqual(txn.gatewayPaymentId, paymentId);

    const res = reservationsStore.find((r) => r.id === secondSession.reservationId);
    assert.strictEqual(res.status, 'CONFIRMED');
  });

  await t.test('8. Duplicate verification request is idempotent and returns existing registration', async () => {
    const paymentId = 'pay_real_999';
    const validSignature = crypto
      .createHmac('sha256', mockConfig.keySecret)
      .update(`${secondSession.gatewayOrderId}|${paymentId}`)
      .digest('hex');

    const result = await verificationService.verifyPayment({
      collegeId,
      transactionId: secondSession.transactionId,
      paymentDetails: {
        razorpay_order_id: secondSession.gatewayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.idempotent, true);
    assert.strictEqual(registrationsStore.length, 1);
  });

  await t.test('9. Interrupted registration records failureReason and recovers on retry', async () => {
    const interSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId: '55555555-5555-4555-8555-555555555555',
        name: 'Rohan Verma',
        email: 'rohan@college.edu',
      },
    });

    const paymentId = 'pay_real_999';
    const validSignature = crypto
      .createHmac('sha256', mockConfig.keySecret)
      .update(`${interSession.gatewayOrderId}|${paymentId}`)
      .digest('hex');

    // Simulate transient failure during registration creation
    simulateRegistrationFailure = true;

    const result = await verificationService.verifyPayment({
      collegeId,
      transactionId: interSession.transactionId,
      paymentDetails: {
        razorpay_order_id: interSession.gatewayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      },
    });

    // Transaction is marked PAID in ledger, but returns warning that registration is pending
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.warning, 'PAYMENT_RECEIVED_REGISTRATION_PENDING');
    assert.strictEqual(result.registration, null);

    const txn = transactionsStore.find((t) => t.id === interSession.transactionId);
    assert.strictEqual(txn.status, 'PAID');
    assert.match(txn.failureReason, /registration creation failed/i);

    // Now resolve transient failure and retry verification
    simulateRegistrationFailure = false;
    const retryResult = await verificationService.verifyPayment({
      collegeId,
      transactionId: interSession.transactionId,
      paymentDetails: {
        razorpay_order_id: interSession.gatewayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      },
    });

    assert.strictEqual(retryResult.success, true);
    assert.ok(retryResult.registration);
    assert.strictEqual(retryResult.registration.paymentTransactionId, interSession.transactionId);
  });

  await t.test('10. Late payment after reservation expiry marks LATE_PAYMENT without registering', async () => {
    const expiredRes = {
      id: 'res_expired_1',
      collegeId,
      eventId,
      status: 'HELD',
      expiresAt: new Date(Date.now() - 60000), // 1 minute ago
    };
    reservationsStore.push(expiredRes);

    const lateTxn = {
      id: 'txn_late_1',
      collegeId,
      eventId,
      reservationId: expiredRes.id,
      amount: 500,
      currency: 'INR',
      status: 'PAID',
      gatewayProvider: 'RAZORPAY',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(lateTxn);

    const regRes = await registrationService.completePaidRegistration({
      collegeId,
      transactionId: lateTxn.id,
    });

    assert.strictEqual(regRes.success, false);
    assert.strictEqual(regRes.status, 'LATE_PAYMENT');
    assert.strictEqual(lateTxn.status, 'LATE_PAYMENT');
    assert.strictEqual(expiredRes.status, 'EXPIRED');

    // Idempotent retry returns same late payment result
    const retryLate = await registrationService.completePaidRegistration({
      collegeId,
      transactionId: lateTxn.id,
    });
    assert.strictEqual(retryLate.success, false);
    assert.strictEqual(retryLate.status, 'LATE_PAYMENT');
  });

  await t.test('11. Webhook processing verifies signature and deduplicates delivery', async () => {
    const whEventId = 'evt_rzp_mock_1';
    const payload = {
      id: whEventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_123',
            order_id: secondSession.gatewayOrderId,
            amount: 50000,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            vpa: 'user@upi',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const reqMock = {
      headers: { 'x-razorpay-signature': validSignature },
      rawBody,
      body: payload,
    };

    // First delivery
    const res1 = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.processed, true);

    // Duplicate delivery
    const res2 = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.idempotent, true);
  });

  await t.test('12. External participant checkout derives identity server-side and rejects spoofed ID', async () => {
    const extEmail = 'external.student@mit.edu';

    // 1. Checkout automatically creates ExternalParticipant
    const extSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'EXTERNAL',
        name: 'Alex Rivera',
        email: extEmail,
        phone: '9876543210',
      },
    });

    assert.strictEqual(extSession.reused, false);
    const createdExt = externalParticipantsStore.find((p) => p.email === extEmail);
    assert.ok(createdExt);
    assert.strictEqual(createdExt.name, 'Alex Rivera');

    // 2. Reject checkout if client supplies an externalParticipantId that doesn't match
    await assert.rejects(
      async () => {
        await orderService.createCheckoutSession({
          collegeId,
          eventId,
          participant: {
            participantType: 'EXTERNAL',
            externalParticipantId: '99999999-9999-4999-8999-999999999999',
            name: 'Alex Rivera',
            email: extEmail,
          },
        });
      },
      {
        message: /Client externalParticipantId does not match verified external participant identity/,
        statusCode: 403,
      }
    );
  });

  await t.test('13. External participant verification checks email ownership', async () => {
    const extEmail = 'owner@mit.edu';
    const extSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'EXTERNAL',
        name: 'Owner Participant',
        email: extEmail,
      },
    });

    // Impersonator with different email should be rejected
    await assert.rejects(
      async () => {
        await verificationService.verifyPayment({
          collegeId,
          transactionId: extSession.transactionId,
          expectedExternalEmail: 'impersonator@other.edu',
          paymentDetails: {
            razorpay_order_id: extSession.gatewayOrderId,
            razorpay_payment_id: 'pay_real_999',
            razorpay_signature: 'sig',
          },
        });
      },
      {
        message: /Unauthorized: Transaction does not belong to the authenticated external participant/,
        statusCode: 403,
      }
    );
  });

  await t.test('14. Refunds: Pending gateway response leaves refund INITIATED and transaction unchanged', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === secondSession.transactionId);
    assert.strictEqual(paidTxn.status, 'PAID');

    // Set adapter to return pending response
    mockRefundResponseStatus = 'pending';

    const res = await refundService.processRefund({
      collegeId,
      transactionId: paidTxn.id,
      amount: 100,
      reason: 'Partial cancellation under review',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'INITIATED');
    assert.strictEqual(res.gatewayStatus, 'pending');

    // Transaction status must NOT be changed to PARTIALLY_REFUNDED yet!
    assert.strictEqual(paidTxn.status, 'PAID');

    const refundRec = refundsStore.find((r) => r.id === res.refundId);
    assert.ok(refundRec);
    assert.strictEqual(refundRec.status, 'INITIATED');
  });

  await t.test('15. Refunds: Webhook refund.processed confirms refund and updates transaction balance', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === secondSession.transactionId);
    const initiatedRefund = refundsStore.find((r) => r.transactionId === paidTxn.id && r.status === 'INITIATED');
    assert.ok(initiatedRefund);

    const whEventId = 'evt_rzp_rfnd_1';
    const payload = {
      id: whEventId,
      event: 'refund.processed',
      payload: {
        payment: {
          entity: {
            id: paidTxn.gatewayPaymentId,
          },
        },
        refund: {
          entity: {
            id: initiatedRefund.gatewayRefundId || 'rfnd_rzp_confirmed_1',
            payment_id: paidTxn.gatewayPaymentId,
            amount: 10000,
            status: 'processed',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const reqMock = {
      headers: { 'x-razorpay-signature': validSignature },
      rawBody,
      body: payload,
    };

    const res = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res.success, true);

    // Refund transitioned to PROCESSED
    assert.strictEqual(initiatedRefund.status, 'PROCESSED');
    // Parent transaction updated to PARTIALLY_REFUNDED
    assert.strictEqual(paidTxn.status, 'PARTIALLY_REFUNDED');
  });

  await t.test('16. Refunds: Webhook refund.failed marks refund FAILED without changing transaction balance', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === secondSession.transactionId);

    // Initiate another pending refund
    mockRefundResponseStatus = 'pending';
    const initRes = await refundService.processRefund({
      collegeId,
      transactionId: paidTxn.id,
      amount: 50,
      reason: 'Failed gateway attempt',
    });

    const pendingRefund = refundsStore.find((r) => r.id === initRes.refundId);
    assert.strictEqual(pendingRefund.status, 'INITIATED');

    const whEventId = 'evt_rzp_rfnd_fail_1';
    const payload = {
      id: whEventId,
      event: 'refund.failed',
      payload: {
        payment: {
          entity: {
            id: paidTxn.gatewayPaymentId,
          },
        },
        refund: {
          entity: {
            id: pendingRefund.gatewayRefundId,
            payment_id: paidTxn.gatewayPaymentId,
            amount: 5000,
            status: 'failed',
            error_description: 'Issuer declined refund',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const reqMock = {
      headers: { 'x-razorpay-signature': validSignature },
      rawBody,
      body: payload,
    };

    const res = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res.success, true);

    // Refund marked FAILED
    assert.strictEqual(pendingRefund.status, 'FAILED');
    // Transaction still PARTIALLY_REFUNDED (failed refund does not increase deducted amount)
    assert.strictEqual(paidTxn.status, 'PARTIALLY_REFUNDED');
  });

  await t.test('17. Refunds: Full refund transitions to REFUNDED, prevents over-refunding', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === secondSession.transactionId);
    mockRefundResponseStatus = 'processed';

    // Attempting to refund 450 (which exceeds remaining 400) must be rejected
    await assert.rejects(
      async () => {
        await refundService.processRefund({
          collegeId,
          transactionId: paidTxn.id,
          amount: 450,
          reason: 'Excessive refund',
        });
      },
      {
        message: /exceeds remaining refundable balance/,
        statusCode: 400,
      }
    );

    // Refunding remaining 400 transitions to REFUNDED
    const fullRefundRes = await refundService.processRefund({
      collegeId,
      transactionId: paidTxn.id,
      amount: 400,
      reason: 'Full balance settlement',
    });

    assert.strictEqual(fullRefundRes.success, true);
    assert.strictEqual(fullRefundRes.status, 'PROCESSED');
    assert.strictEqual(paidTxn.status, 'REFUNDED');

    // Attempting any further refund on fully refunded transaction must be rejected
    await assert.rejects(
      async () => {
        await refundService.processRefund({
          collegeId,
          transactionId: paidTxn.id,
          amount: 10,
        });
      },
      {
        message: /Cannot refund transaction with status REFUNDED/,
        statusCode: 400,
      }
    );
  });

  await t.test('18. Cashfree webhook: payment success and refund webhook handling', async () => {
    // 1. Create a held reservation and Cashfree transaction
    const cfReservation = {
      id: 'res_cf_999',
      collegeId,
      eventId,
      userId,
      status: 'HELD',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    reservationsStore.push(cfReservation);

    const cfTxn = {
      id: '55555555-5555-4555-8555-555555555555',
      collegeId,
      eventId,
      userId,
      reservationId: cfReservation.id,
      amount: 500,
      currency: 'INR',
      status: 'PENDING',
      gatewayProvider: 'CASHFREE',
      gatewayOrderId: 'cf_order_999',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(cfTxn);

    const nowSec = Math.floor(Date.now() / 1000);
    const cfPaymentPayload = {
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: cfTxn.id },
        payment: {
          cf_payment_id: 11223344,
          payment_status: 'SUCCESS',
          payment_group: 'upi',
          payment_method: { upi: { upi_id: 'cf_payer@upi' } },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(cfPaymentPayload), 'utf8');
    const signaturePayload = `${nowSec}${rawBody.toString('utf8')}`;
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(signaturePayload)
      .digest('base64');

    const reqMock = {
      headers: {
        'x-webhook-signature': validSignature,
        'x-webhook-timestamp': String(nowSec),
      },
      rawBody,
      body: cfPaymentPayload,
    };

    const res = await webhookService.processCashfreeWebhook(reqMock);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.processed, true);
    assert.strictEqual(cfTxn.status, 'PAID');

    // 2. Process Cashfree Refund Webhook
    const cfRefundRec = {
      id: '66666666-6666-4666-8666-666666666666',
      collegeId,
      transactionId: cfTxn.id,
      amount: 500,
      status: 'INITIATED',
      gatewayRefundId: 'cf_rfnd_111',
    };
    refundsStore.push(cfRefundRec);

    const cfRefundPayload = {
      type: 'REFUND_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: cfTxn.id },
        refund: {
          cf_refund_id: 'cf_rfnd_111',
          refund_id: cfRefundRec.id,
          refund_status: 'SUCCESS',
          refund_amount: 500,
        },
      },
    };

    const rfRawBody = Buffer.from(JSON.stringify(cfRefundPayload), 'utf8');
    const rfSignaturePayload = `${nowSec}${rfRawBody.toString('utf8')}`;
    const rfValidSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rfSignaturePayload)
      .digest('base64');

    const rfReqMock = {
      headers: {
        'x-webhook-signature': rfValidSignature,
        'x-webhook-timestamp': String(nowSec),
      },
      rawBody: rfRawBody,
      body: cfRefundPayload,
    };

    const rfRes = await webhookService.processCashfreeWebhook(rfReqMock);
    assert.strictEqual(rfRes.success, true);
    assert.strictEqual(cfRefundRec.status, 'PROCESSED');
    assert.strictEqual(cfTxn.status, 'REFUNDED');
  });

  await t.test('19. Database permission: Safe app_user column select without secret columns', async () => {
    // Calling createCheckoutSession exercises both tx.paymentTransaction.create(select: ...)
    // and tx.seatReservation.findFirst(select: { paymentTransaction: { select: ... } })
    const user19 = '11111111-9999-4999-8999-191919191919';
    const session = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId: user19,
        name: 'Student 19',
        email: 'student19@college.edu',
      },
    });
    assert.ok(session);
    assert.ok(session.transactionId);
    // Ensure the transaction in store did not require querying secret columns
    const createdTxn = transactionsStore.find((t) => t.id === session.transactionId);
    assert.ok(createdTxn);
    assert.strictEqual(createdTxn.status, 'PENDING');
  });

  await t.test('20. Razorpay capture: Authorized but uncaptured payment returns pending state and halts registration', async () => {
    // Create new checkout session for test
    const user20 = '11111111-9999-4999-8999-202020202020';
    const testSession = await orderService.createCheckoutSession({
      collegeId,
      eventId,
      participant: {
        participantType: 'STUDENT',
        userId: user20,
        name: 'Student 20',
        email: 'student20@college.edu',
      },
    });

    const validSignature = crypto
      .createHmac('sha256', mockConfig.keySecret)
      .update(`${testSession.gatewayOrderId}|pay_real_999`)
      .digest('hex');

    // Simulate payment returned as authorized, and capture attempt fails to capture (remains authorized)
    mockPaymentStatus = 'authorized';
    mockCaptureStatus = 'authorized';

    const verifyRes = await verificationService.verifyPayment({
      collegeId,
      transactionId: testSession.transactionId,
      userId: user20,
      paymentDetails: {
        razorpay_order_id: testSession.gatewayOrderId,
        razorpay_payment_id: 'pay_real_999',
        razorpay_signature: validSignature,
      },
    });

    // Must return PAYMENT_AUTHORIZED_PENDING_CAPTURE and registration must be null
    assert.strictEqual(verifyRes.status, 'PAYMENT_AUTHORIZED_PENDING_CAPTURE');
    assert.strictEqual(verifyRes.registration, null);

    // Transaction status must remain PENDING (not marked PAID)
    const txn = transactionsStore.find((t) => t.id === testSession.transactionId);
    assert.strictEqual(txn.status, 'PENDING');

    // Reset mock payment status
    mockPaymentStatus = 'captured';
    mockCaptureStatus = 'captured';
  });

  await t.test('21. Reservation integrity: Missing, RELEASED, or EXPIRED reservations transition to LATE_PAYMENT', async () => {
    // Case A: Missing reservation
    const txnNoRes = {
      id: '77777777-1111-4111-8111-111111111111',
      collegeId,
      eventId,
      userId,
      reservationId: null,
      amount: 500,
      currency: 'INR',
      status: 'PAID',
      gatewayProvider: 'RAZORPAY',
      gatewayPaymentId: 'pay_miss_res',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(txnNoRes);

    const resA = await registrationService.completePaidRegistration({
      collegeId,
      transactionId: txnNoRes.id,
    });
    assert.strictEqual(resA.status, 'LATE_PAYMENT');
    assert.strictEqual(txnNoRes.status, 'LATE_PAYMENT');
    assert.match(txnNoRes.failureReason, /Missing or deleted seat reservation/i);

    // Case B: Released reservation
    const releasedRes = {
      id: 'res_released_test',
      collegeId,
      eventId,
      userId,
      status: 'RELEASED',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    reservationsStore.push(releasedRes);

    const txnReleased = {
      id: '77777777-2222-4222-8222-222222222222',
      collegeId,
      eventId,
      userId,
      reservationId: releasedRes.id,
      amount: 500,
      currency: 'INR',
      status: 'PAID',
      gatewayPaymentId: 'pay_rel_res',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(txnReleased);

    const resB = await registrationService.completePaidRegistration({
      collegeId,
      transactionId: txnReleased.id,
    });
    assert.strictEqual(resB.status, 'LATE_PAYMENT');
    assert.strictEqual(txnReleased.status, 'LATE_PAYMENT');
    assert.match(txnReleased.failureReason, /released/i);

    // Case C: Expired reservation
    const expiredRes = {
      id: 'res_expired_test',
      collegeId,
      eventId,
      userId,
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1000),
    };
    reservationsStore.push(expiredRes);

    const txnExpired = {
      id: '77777777-3333-4333-8333-333333333333',
      collegeId,
      eventId,
      userId,
      reservationId: expiredRes.id,
      amount: 500,
      currency: 'INR',
      status: 'PAID',
      gatewayPaymentId: 'pay_exp_res',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(txnExpired);

    const resC = await registrationService.completePaidRegistration({
      collegeId,
      transactionId: txnExpired.id,
    });
    assert.strictEqual(resC.status, 'LATE_PAYMENT');
    assert.strictEqual(txnExpired.status, 'LATE_PAYMENT');
    assert.match(txnExpired.failureReason, /expired/i);
  });

  await t.test('22. Refund webhook matching: Ambiguous refund does not modify any refund record', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === secondSession.transactionId);

    // Create an initiated refund with a known gatewayRefundId
    const knownRefund = {
      id: '88888888-1111-4111-8111-111111111111',
      collegeId,
      transactionId: paidTxn.id,
      amount: 100,
      status: 'INITIATED',
      gatewayRefundId: 'rfnd_known_123',
    };
    refundsStore.push(knownRefund);

    // Incoming webhook has unknown gateway refund ID and no matching internal refund ID
    const ambiguousPayload = {
      id: 'evt_rzp_ambiguous_1',
      event: 'refund.processed',
      payload: {
        payment: { entity: { id: paidTxn.gatewayPaymentId } },
        refund: {
          entity: {
            id: 'rfnd_unknown_999',
            payment_id: paidTxn.gatewayPaymentId,
            amount: 10000,
            status: 'processed',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(ambiguousPayload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const reqMock = {
      headers: { 'x-razorpay-signature': validSignature },
      rawBody,
      body: ambiguousPayload,
    };

    const res = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.ignored, true);

    // The existing initiated refund must NOT have been updated
    assert.strictEqual(knownRefund.status, 'INITIATED');
  });

  await t.test('23. Webhook concurrency and retry: Rejects concurrent claims and permits retry on failure', async () => {
    const eventId = 'evt_concurrency_test_1';
    const payload = { test: true };

    // First claim succeeds and receives claimToken
    const claim1 = await webhookService._claimWebhookEvent('RAZORPAY', eventId, 'test.event', payload, collegeId);
    assert.strictEqual(claim1.claimed, true);
    assert.ok(claim1.claimToken);

    // Immediate second claim within 30s lease is recognized as concurrent
    const claim2 = await webhookService._claimWebhookEvent('RAZORPAY', eventId, 'test.event', payload, collegeId);
    assert.strictEqual(claim2.claimed, false);
    assert.strictEqual(claim2.concurrent, true);

    // Simulate failure of the first attempt
    await mockPrisma.paymentWebhookEvent.update({
      where: {
        provider_gatewayEventId: {
          provider: 'RAZORPAY',
          gatewayEventId: eventId,
        },
      },
      data: { status: 'FAILED', errorMessage: 'Transient network failure' },
    });

    // Retry after failure succeeds in re-claiming the event
    const retryClaim = await webhookService._claimWebhookEvent('RAZORPAY', eventId, 'test.event', payload, collegeId);
    assert.strictEqual(retryClaim.claimed, true);
    assert.ok(retryClaim.claimToken);
    assert.notStrictEqual(retryClaim.claimToken, claim1.claimToken, 'Re-claimed event must have fresh claimToken');

    // Claim ownership validation: expired worker with old claim1.claimToken cannot overwrite
    const expiredUpdate = await mockPrisma.paymentWebhookEvent.updateMany({
      where: {
        provider: 'RAZORPAY',
        gatewayEventId: eventId,
        claimToken: claim1.claimToken, // Old expired token
      },
      data: {
        status: 'PROCESSED',
      },
    });
    assert.strictEqual(expiredUpdate.count, 0, 'Expired worker with stale claimToken must update 0 rows');
  });

  await t.test('24. Razorpay order.paid without payment entity queries authoritative gateway', async () => {
    // Create transaction with held reservation
    const ordReservation = {
      id: 'res_ord_paid_1',
      collegeId,
      eventId,
      userId,
      status: 'HELD',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    reservationsStore.push(ordReservation);

    const ordTxn = {
      id: '99999999-1111-4111-8111-111111111111',
      collegeId,
      eventId,
      userId,
      reservationId: ordReservation.id,
      amount: 500,
      currency: 'INR',
      status: 'PENDING',
      gatewayProvider: 'RAZORPAY',
      gatewayOrderId: 'order_rzp_auth_test_999',
      createdAt: new Date(),
      updatedAt: new Date(),
      refunds: [],
    };
    transactionsStore.push(ordTxn);

    // Payload has order entity only (no payment entity)
    const orderPaidPayload = {
      id: 'evt_order_paid_authoritative_1',
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: 'order_rzp_auth_test_999',
            amount: 50000,
            status: 'paid',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(orderPaidPayload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const reqMock = {
      headers: { 'x-razorpay-signature': validSignature },
      rawBody,
      body: orderPaidPayload,
    };

    const res = await webhookService.processRazorpayWebhook(reqMock);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.processed, true);

    // Authority query fetched pay_rzp_from_order_123
    assert.strictEqual(ordTxn.gatewayPaymentId, 'pay_rzp_from_order_123');
    assert.strictEqual(ordTxn.status, 'PAID');
  });

  await t.test('25. Refund idempotency: params.refundId or idempotencyKey prevents duplicate refund creation', async () => {
    const paidTxn = transactionsStore.find((t) => t.id === '99999999-1111-4111-8111-111111111111');
    const fixedRefundId = 'bbbbbbbb-2222-4222-8222-222222222222';
    mockRefundResponseStatus = 'pending';

    // First refund call
    const res1 = await refundService.processRefund({
      collegeId,
      transactionId: paidTxn.id,
      amount: 100,
      refundId: fixedRefundId,
      idempotencyKey: 'idemp_key_test_1',
      reason: 'First call',
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.refundId, fixedRefundId);

    // Second refund call with same refundId and same amount
    const res2 = await refundService.processRefund({
      collegeId,
      transactionId: paidTxn.id,
      amount: 100,
      refundId: fixedRefundId,
      idempotencyKey: 'idemp_key_test_1',
      reason: 'Duplicate call',
    });

    // Should return existing refund record idempotently
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.refundId, fixedRefundId);
    assert.strictEqual(res2.status, 'INITIATED');

    // Only 1 refund was created in store for this fixedRefundId
    const matchingRefunds = refundsStore.filter((r) => r.id === fixedRefundId);
    assert.strictEqual(matchingRefunds.length, 1);

    // Reusing the same idempotency key with a DIFFERENT amount must be rejected with 409
    await assert.rejects(
      async () => {
        await refundService.processRefund({
          collegeId,
          transactionId: paidTxn.id,
          amount: 200, // Different amount!
          idempotencyKey: 'idemp_key_test_1',
        });
      },
      {
        statusCode: 409,
        message: /already used for a different refund request/,
      }
    );
  });
});
