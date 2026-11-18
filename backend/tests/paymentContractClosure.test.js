'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventBody, updateEventBody } = require('../validators/schemas');
const { PaymentVerificationService } = require('../services/payment/paymentVerificationService');

test('Phase 3.1: Payment Contract Closure Tests', async (t) => {
  const collegeId = '11111111-1111-4111-8111-111111111111';
  const otherCollegeId = '99999999-9999-4999-8999-999999999999';
  const eventId = '22222222-2222-4222-8222-222222222222';
  const userId = '44444444-4444-4444-8444-444444444444';
  const otherUserId = '55555555-5555-4555-8555-555555555555';
  const txnId = '66666666-6666-4666-8666-666666666666';
  const extParticipantId = '77777777-7777-4777-8777-777777777777';

  // ---------------------------------------------------------------------------
  // 1. Event Fee Persistence & Zod Schema Validation
  // ---------------------------------------------------------------------------
  await t.test('1. createEventBody: Free event defaults isPaid: false, fee: 0, currency: INR', () => {
    const parsed = createEventBody.safeParse({
      title: 'Free Workshop',
      description: 'Hands on coding',
      location: 'Lab 1',
      startAt: new Date(Date.now() + 86400000).toISOString(),
    });

    assert.equal(parsed.success, true);
    assert.equal(parsed.data.isPaid, false);
    assert.equal(parsed.data.fee, 0);
    assert.equal(parsed.data.currency, 'INR');
  });

  await t.test('2. createEventBody: Paid event requires positive integer fee', () => {
    // Missing / zero fee on paid event
    const invalidZero = createEventBody.safeParse({
      title: 'Paid Summit',
      description: 'Tech summit',
      location: 'Auditorium',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      isPaid: true,
      fee: 0,
    });
    assert.equal(invalidZero.success, false);

    // Negative fee
    const invalidNeg = createEventBody.safeParse({
      title: 'Paid Summit',
      description: 'Tech summit',
      location: 'Auditorium',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      isPaid: true,
      fee: -100,
    });
    assert.equal(invalidNeg.success, false);

    // Valid positive fee
    const valid = createEventBody.safeParse({
      title: 'Paid Summit',
      description: 'Tech summit',
      location: 'Auditorium',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      isPaid: true,
      fee: 250,
      currency: 'INR',
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.isPaid, true);
    assert.equal(valid.data.fee, 250);
  });

  await t.test('3. updateEventBody: Accepts isPaid, fee, currency modifications', () => {
    // Toggle to free
    const updateFree = updateEventBody.safeParse({
      isPaid: false,
      fee: 0,
    });
    assert.equal(updateFree.success, true);
    assert.equal(updateFree.data.isPaid, false);

    // Update fee on paid event
    const updateFee = updateEventBody.safeParse({
      isPaid: true,
      fee: 500,
    });
    assert.equal(updateFee.success, true);
    assert.equal(updateFee.data.fee, 500);

    // Reject zero fee when isPaid is explicitly true
    const invalidFee = updateEventBody.safeParse({
      isPaid: true,
      fee: 0,
    });
    assert.equal(invalidFee.success, false);
  });

  // ---------------------------------------------------------------------------
  // 2. Authoritative Payment Status Endpoint
  // ---------------------------------------------------------------------------
  // Mock Prisma Store
  const mockTransactions = new Map();
  const mockExternalParticipants = new Map();
  const mockRegistrations = new Map();

  const mockPrisma = {
    paymentTransaction: {
      findUnique: async ({ where }) => mockTransactions.get(where.id) || null,
    },
    externalParticipant: {
      findUnique: async ({ where }) => mockExternalParticipants.get(where.id) || null,
    },
    eventRegistration: {
      findFirst: async ({ where }) => {
        for (const reg of mockRegistrations.values()) {
          if (where.paymentTransactionId && reg.paymentTransactionId === where.paymentTransactionId) {
            return reg;
          }
        }
        return null;
      },
    },
  };

  const verificationService = new PaymentVerificationService({ prisma: mockPrisma });

  // Seed sample student transaction
  mockTransactions.set(txnId, {
    id: txnId,
    collegeId,
    eventId,
    reservationId: 'res-001',
    participantType: 'STUDENT',
    userId,
    externalParticipantId: null,
    amount: 250,
    currency: 'INR',
    status: 'PAID',
    gatewayProvider: 'RAZORPAY',
    paymentMode: 'COLLEGE_OWNED_GATEWAY',
    merchantAccountId: 'acc_secret_123',
    gatewayOrderId: 'order_rzp_999',
    gatewayPaymentId: 'pay_rzp_888',
    gatewaySignature: 'secret_hmac_signature',
    idempotencyKey: 'idem_key_xyz',
    registrationPayload: { answers: { tShirt: 'L' } },
    paymentMethod: 'UPI',
    vpaMasked: 'user@okhdfcbank',
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  mockRegistrations.set('reg-001', {
    id: 'reg-001',
    collegeId,
    eventId,
    userId,
    paymentTransactionId: txnId,
    status: 'CONFIRMED',
    registeredAt: new Date(),
  });

  await t.test('4. getTransactionStatus: Authorized student caller receives authoritative status & registration', async () => {
    const result = await verificationService.getTransactionStatus({
      collegeId,
      transactionId: txnId,
      caller: { userId, userRole: 'USER' },
    });

    assert.equal(result.transaction.id, txnId);
    assert.equal(result.transaction.status, 'PAID');
    assert.equal(result.transaction.amount, 250);
    assert.equal(result.transaction.gatewayOrderId, 'order_rzp_999');
    assert.equal(result.isRegistered, true);
    assert.equal(result.registration.id, 'reg-001');

    // Strict zero-leakage assertions:
    assert.equal(result.transaction.gatewaySignature, undefined, 'gatewaySignature must never be exposed');
    assert.equal(result.transaction.merchantAccountId, undefined, 'merchantAccountId must never be exposed');
    assert.equal(result.transaction.idempotencyKey, undefined, 'idempotencyKey must never be exposed');
    assert.equal(result.transaction.registrationPayload, undefined, 'registrationPayload must never be exposed');
  });

  await t.test('5. getTransactionStatus: Unauthorized student caller is rejected with 403', async () => {
    await assert.rejects(
      async () => {
        await verificationService.getTransactionStatus({
          collegeId,
          transactionId: txnId,
          caller: { userId: otherUserId, userRole: 'USER' },
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Unauthorized'));
        return true;
      }
    );
  });

  await t.test('6. getTransactionStatus: College Admin / Manager has authorized visibility', async () => {
    const result = await verificationService.getTransactionStatus({
      collegeId,
      transactionId: txnId,
      caller: { userId: 'admin-uuid', userRole: 'COLLEGE_ADMIN' },
    });

    assert.equal(result.transaction.id, txnId);
    assert.equal(result.transaction.status, 'PAID');
  });

  await t.test('7. getTransactionStatus: Cross-tenant access is rejected with 404', async () => {
    await assert.rejects(
      async () => {
        await verificationService.getTransactionStatus({
          collegeId: otherCollegeId,
          transactionId: txnId,
          caller: { userId, userRole: 'USER' },
        });
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // Seed external participant transaction
  const extTxnId = '88888888-8888-4888-8888-888888888888';
  mockExternalParticipants.set(extParticipantId, {
    id: extParticipantId,
    email: 'guest@external.edu',
  });

  mockTransactions.set(extTxnId, {
    id: extTxnId,
    collegeId,
    eventId,
    reservationId: 'res-002',
    participantType: 'EXTERNAL',
    userId: null,
    externalParticipantId: extParticipantId,
    amount: 300,
    currency: 'INR',
    status: 'PAID',
    gatewayProvider: 'CASHFREE',
    paymentMode: 'COLLEGE_OWNED_GATEWAY',
    gatewayOrderId: 'cf_order_777',
    gatewayPaymentId: 'cf_pay_666',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await t.test('8. getTransactionStatus: Authorized external participant verified by email', async () => {
    const result = await verificationService.getTransactionStatus({
      collegeId,
      transactionId: extTxnId,
      caller: { externalEmail: 'guest@external.edu' },
    });

    assert.equal(result.transaction.id, extTxnId);
    assert.equal(result.transaction.gatewayProvider, 'CASHFREE');
    assert.equal(result.transaction.amount, 300);
  });

  await t.test('9. getTransactionStatus: Wrong external participant email rejected with 403', async () => {
    await assert.rejects(
      async () => {
        await verificationService.getTransactionStatus({
          collegeId,
          transactionId: extTxnId,
          caller: { externalEmail: 'imposter@external.edu' },
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });
});
