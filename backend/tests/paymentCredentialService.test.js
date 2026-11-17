'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  getGatewayEncryptionKey,
  encryptCredential,
  decryptCredential,
  maskCredential,
  buildAadString,
  CURRENT_ENCRYPTION_VERSION,
} = require('../services/payment/paymentCredentialService');

test('paymentCredentialService: Key validation and environment checks', async (t) => {
  const originalEnv = process.env.GATEWAY_ENCRYPTION_KEY;

  await t.test('throws when GATEWAY_ENCRYPTION_KEY is missing', () => {
    delete process.env.GATEWAY_ENCRYPTION_KEY;
    assert.throws(
      () => getGatewayEncryptionKey(),
      /GATEWAY_ENCRYPTION_KEY environment variable is missing/
    );
  });

  await t.test('throws when GATEWAY_ENCRYPTION_KEY is incorrect length (< 32 bytes)', () => {
    process.env.GATEWAY_ENCRYPTION_KEY = 'too_short_key_16b';
    assert.throws(
      () => getGatewayEncryptionKey(),
      /GATEWAY_ENCRYPTION_KEY must be exactly 32 bytes/
    );
  });

  await t.test('accepts valid 32-byte UTF-8 string', () => {
    const valid32String = 'a'.repeat(32);
    process.env.GATEWAY_ENCRYPTION_KEY = valid32String;
    const key = getGatewayEncryptionKey();
    assert.strictEqual(key.length, 32);
  });

  await t.test('accepts valid 64-character hex string', () => {
    const validHex = '0123456789abcdef'.repeat(4);
    process.env.GATEWAY_ENCRYPTION_KEY = validHex;
    const key = getGatewayEncryptionKey();
    assert.strictEqual(key.length, 32);
    assert.strictEqual(key.toString('hex'), validHex);
  });

  // Restore original environment
  if (originalEnv !== undefined) {
    process.env.GATEWAY_ENCRYPTION_KEY = originalEnv;
  } else {
    delete process.env.GATEWAY_ENCRYPTION_KEY;
  }
});

test('paymentCredentialService: Encryption, Decryption, and Integrity', async (t) => {
  const testKeyHex = 'f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef';
  process.env.GATEWAY_ENCRYPTION_KEY = testKeyHex;

  const collegeA = '11111111-1111-1111-1111-111111111111';
  const collegeB = '22222222-2222-2222-2222-222222222222';
  const secretText = 'rzp_secret_99887766554433221100aabbccddeeff';

  await t.test('encrypts and decrypts cleanly with matching context', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    assert.ok(typeof encrypted === 'string');
    const parsed = JSON.parse(encrypted);
    assert.strictEqual(parsed.v, CURRENT_ENCRYPTION_VERSION);
    assert.ok(parsed.iv);
    assert.ok(parsed.tag);
    assert.ok(parsed.data);

    const decrypted = decryptCredential(encrypted, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    assert.strictEqual(decrypted, secretText);
  });

  await t.test('fails decryption when AAD collegeId mismatches (cross-tenant transplant)', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    assert.throws(
      () =>
        decryptCredential(encrypted, {
          collegeId: collegeB, // Wrong college
          fieldName: 'key_secret',
        }),
      /integrity authentication check failed/
    );
  });

  await t.test('fails decryption when AAD fieldName mismatches (field-swapping attack)', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    assert.throws(
      () =>
        decryptCredential(encrypted, {
          collegeId: collegeA,
          fieldName: 'webhook_secret', // Wrong field
        }),
      /integrity authentication check failed/
    );
  });

  await t.test('fails decryption when ciphertext data is tampered with', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    const parsed = JSON.parse(encrypted);
    // Tamper with one hex character
    const tamperedHex =
      parsed.data.slice(0, -2) + (parsed.data.slice(-2) === 'aa' ? 'bb' : 'aa');
    parsed.data = tamperedHex;

    assert.throws(
      () =>
        decryptCredential(JSON.stringify(parsed), {
          collegeId: collegeA,
          fieldName: 'key_secret',
        }),
      /integrity authentication check failed/
    );
  });

  await t.test('fails decryption when auth tag is tampered with', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    const parsed = JSON.parse(encrypted);
    parsed.tag = '00'.repeat(16); // Fake tag

    assert.throws(
      () =>
        decryptCredential(JSON.stringify(parsed), {
          collegeId: collegeA,
          fieldName: 'key_secret',
        }),
      /integrity authentication check failed/
    );
  });

  await t.test('fails decryption when IV is tampered with', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    const parsed = JSON.parse(encrypted);
    parsed.iv = '11'.repeat(12); // Altered IV

    assert.throws(
      () =>
        decryptCredential(JSON.stringify(parsed), {
          collegeId: collegeA,
          fieldName: 'key_secret',
        }),
      /integrity authentication check failed/
    );
  });

  await t.test('fails decryption when decrypted under a different master key', () => {
    const encrypted = encryptCredential(secretText, {
      collegeId: collegeA,
      fieldName: 'key_secret',
    });

    const differentKey = crypto.randomBytes(32);
    assert.throws(
      () =>
        decryptCredential(encrypted, {
          collegeId: collegeA,
          fieldName: 'key_secret',
          keyOverride: differentKey,
        }),
      /integrity authentication check failed/
    );
  });
});

test('paymentCredentialService: Masking previews', async (t) => {
  await t.test('masks Razorpay test key', () => {
    const preview = maskCredential('rzp_test_51Oq9kS9abc1234');
    assert.strictEqual(preview, 'rzp_test_...1234');
  });

  await t.test('masks Razorpay live key', () => {
    const preview = maskCredential('rzp_live_51Oq9kS9xyz5678');
    assert.strictEqual(preview, 'rzp_live_...5678');
  });

  await t.test('masks Cashfree app id', () => {
    const preview = maskCredential('CF_APP_9988776655');
    assert.strictEqual(preview, 'CF_...6655');
  });

  await t.test('masks short string', () => {
    const preview = maskCredential('abc');
    assert.strictEqual(preview, '****');
  });
});
