'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { PaymentConfigService } = require('../services/payment/paymentConfigService');

test('PaymentConfigService: Configuration, Encryption, and Auditing', async (t) => {
  const collegeId = '11111111-1111-1111-1111-111111111111';
  process.env.GATEWAY_ENCRYPTION_KEY = 'a'.repeat(32);

  let mockConfigStore = null;
  let mockAuditStore = [];

  const mockPrisma = {
    college: {
      findUnique: async ({ where }) => {
        if (where.id === collegeId) return { id: collegeId, name: 'Engineering College' };
        return null;
      },
    },
    collegePaymentConfig: {
      findUnique: async ({ where }) => {
        return mockConfigStore;
      },
      update: async ({ data }) => {
        mockConfigStore = { ...mockConfigStore, ...data };
        return mockConfigStore;
      },
      create: async ({ data }) => {
        mockConfigStore = { id: 'cfg_1', ...data };
        return mockConfigStore;
      },
    },
    collegePaymentConfigAudit: {
      create: async ({ data }) => {
        mockAuditStore.push(data);
        return { id: 'audit_' + mockAuditStore.length, ...data };
      },
      findMany: async () => mockAuditStore,
    },
    $transaction: async (callback) => {
      return await callback(mockPrisma);
    },
  };

  const service = new PaymentConfigService({ prisma: mockPrisma });

  await t.test('getConfig returns default unconfigured state when no record exists', async () => {
    mockConfigStore = null;
    const config = await service.getConfig(collegeId);
    assert.strictEqual(config.configured, false);
    assert.strictEqual(config.status, 'NOT_CONFIGURED');
    assert.strictEqual(config.hasKeyId, false);
    assert.strictEqual(config.keyIdPreview, null);
  });

  await t.test('updateConfig rejects activation when credentials are missing', async () => {
    mockConfigStore = null;
    await assert.rejects(
      async () => {
        await service.updateConfig(collegeId, { status: 'ACTIVE' }, { adminId: 'admin_1' });
      },
      {
        message: /Both Gateway Key ID and Key Secret must be configured/,
        statusCode: 400,
      }
    );
  });

  await t.test('updateConfig saves encrypted credentials and creates audit entry', async () => {
    mockConfigStore = null;
    mockAuditStore = [];

    const updated = await service.updateConfig(
      collegeId,
      {
        provider: 'RAZORPAY',
        mode: 'COLLEGE_OWNED_GATEWAY',
        status: 'ACTIVE',
        isTestMode: true,
        keyId: 'rzp_test_1234567890',
        keySecret: 'secret_abc_xyz',
        webhookSecret: 'whsec_999',
        changeReason: 'Initial setup for College A',
      },
      { adminId: 'admin_super_1', ipAddress: '127.0.0.1' }
    );

    assert.strictEqual(updated.configured, true);
    assert.strictEqual(updated.status, 'ACTIVE');
    assert.strictEqual(updated.provider, 'RAZORPAY');
    assert.strictEqual(updated.hasKeyId, true);
    assert.strictEqual(updated.hasKeySecret, true);
    assert.strictEqual(updated.hasWebhookSecret, true);
    assert.strictEqual(updated.keyIdPreview, 'rzp_test_...7890');

    // Stored in mock database must be ciphertext, NOT plaintext
    assert.notStrictEqual(mockConfigStore.keyIdEncrypted, 'rzp_test_1234567890');
    assert.notStrictEqual(mockConfigStore.keySecretEncrypted, 'secret_abc_xyz');
    assert.ok(mockConfigStore.keyIdEncrypted.includes('"v":1'));

    // Audit trail verification
    assert.strictEqual(mockAuditStore.length, 1);
    assert.strictEqual(mockAuditStore[0].newStatus, 'ACTIVE');
    assert.strictEqual(mockAuditStore[0].credentialsRotated, true);
    assert.strictEqual(mockAuditStore[0].changedByAdminId, 'admin_super_1');
    assert.strictEqual(mockAuditStore[0].keyIdPreview, 'rzp_test_...7890');
  });

  await t.test('getDecryptedConfig decrypts secrets strictly for internal server use', async () => {
    const decrypted = await service.getDecryptedConfig(collegeId);
    assert.strictEqual(decrypted.keyId, 'rzp_test_1234567890');
    assert.strictEqual(decrypted.keySecret, 'secret_abc_xyz');
    assert.strictEqual(decrypted.webhookSecret, 'whsec_999');
    assert.strictEqual(decrypted.provider, 'RAZORPAY');
  });
});
