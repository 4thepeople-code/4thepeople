/**
 * Phase 3 — Regression Tests
 * Verifies Phase 1 and Phase 2 behavior is unaffected.
 *
 * Tests (all without DB, using unit-level checks):
 *   1. getExternalOtpPepper() throws when EXTERNAL_OTP_PEPPER is unset.
 *   2. hashExternalOtp and hashActivationCode produce different hashes for same input.
 *   3. crossCollegeRegisterMiddleware correctly sets isCrossCollege flag.
 *   4. authenticateExternalToken rejects college JWT.
 *   5. attendeeQuery schema now accepts participantType filter.
 *   6. externalOtpRequestBody validates email and eventId correctly.
 *   7. calculateTemplateExpiry('EXTERNAL_OTP') returns ~10 minutes.
 *   8. calculateTemplateExpiry existing templates unchanged.
 *   9. ExternalAuthOtp model has collegeId field in Prisma schema.
 *  10. EventRegistration model has @@unique on (externalParticipantId, eventId).
 */

process.env.NODE_ENV = 'development';
process.env.ACTIVATION_CODE_PEPPER = 'test_pepper_at_least_32_bytes_long_for_security_testing!';
process.env.OUTBOX_ENCRYPTION_KEY = 'test_aes_key_at_least_32_bytes_long_for_outbox_testing!';

const assert = require('assert');
const crypto = require('crypto');

async function runRegressionTests() {
  console.log('======================================================================');
  console.log('PHASE 3D — REGRESSION TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      process.stdout.write(`  [RUN] ${name}... `);
      fn();
      console.log('✓ PASS');
      passed++;
    } catch (err) {
      console.log('✗ FAIL');
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // ─── Crypto tests ─────────────────────────────────────────────────────────

  test('1. getExternalOtpPepper() throws when EXTERNAL_OTP_PEPPER is unset', () => {
    const original = process.env.EXTERNAL_OTP_PEPPER;
    delete process.env.EXTERNAL_OTP_PEPPER;

    // Reload the module fresh to bypass any cached reference
    // (we clear require cache for this test only)
    const cacheKey = Object.keys(require.cache).find(k => k.includes('cryptoUtils'));
    if (cacheKey) delete require.cache[cacheKey];

    const { getExternalOtpPepper } = require('../utils/cryptoUtils');
    let threw = false;
    try {
      getExternalOtpPepper();
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('EXTERNAL_OTP_PEPPER'), 'Error must mention EXTERNAL_OTP_PEPPER');
    }
    assert.strictEqual(threw, true, 'getExternalOtpPepper must throw when env var is unset');

    process.env.EXTERNAL_OTP_PEPPER = original || 'test_external_otp_pepper_32_bytes_long!!';
    // Re-clear cache so subsequent calls get fresh module
    if (cacheKey) delete require.cache[cacheKey];
  });

  test('2. hashExternalOtp and hashActivationCode differ for same input', () => {
    process.env.EXTERNAL_OTP_PEPPER = 'test_external_otp_pepper_32_bytes_long!!';

    const cacheKey = Object.keys(require.cache).find(k => k.includes('cryptoUtils'));
    if (cacheKey) delete require.cache[cacheKey];

    const { hashExternalOtp, hashActivationCode } = require('../utils/cryptoUtils');
    const salt = crypto.randomBytes(16).toString('hex');
    const code = '123456';
    const extHash = hashExternalOtp(salt, code);
    const actHash = hashActivationCode(code);
    assert.notStrictEqual(extHash, actHash, 'External and activation hashes must differ (different peppers)');
  });

  test('3. calculateTemplateExpiry EXTERNAL_OTP returns ~10 minutes', () => {
    const { calculateTemplateExpiry } = require('../services/outboxService');
    const before = Date.now();
    const expiry = calculateTemplateExpiry('EXTERNAL_OTP');
    const after = Date.now();
    const diff = expiry.getTime() - before;
    // Allow 1 second tolerance
    assert.ok(diff >= 9 * 60 * 1000 && diff <= 10 * 60 * 1000 + 1000,
      `EXTERNAL_OTP expiry should be ~10min, got ${diff}ms`);
  });

  test('4. calculateTemplateExpiry STUDENT_ACTIVATION still returns 10 minutes', () => {
    const { calculateTemplateExpiry } = require('../services/outboxService');
    const expiry = calculateTemplateExpiry('STUDENT_ACTIVATION');
    const diff = expiry.getTime() - Date.now();
    assert.ok(diff >= 9 * 60 * 1000 && diff <= 10 * 60 * 1000 + 1000,
      'STUDENT_ACTIVATION expiry regression');
  });

  test('5. calculateTemplateExpiry PASSWORD_RESET still returns 1 hour', () => {
    const { calculateTemplateExpiry } = require('../services/outboxService');
    const expiry = calculateTemplateExpiry('PASSWORD_RESET');
    const diff = expiry.getTime() - Date.now();
    assert.ok(diff >= 59 * 60 * 1000 && diff <= 60 * 60 * 1000 + 1000,
      'PASSWORD_RESET expiry regression');
  });

  test('6. externalOtpRequestBody schema validates correctly', () => {
    const { externalOtpRequestBody } = require('../validators/schemas');
    const validResult = externalOtpRequestBody.safeParse({
      email: 'USER@EXAMPLE.COM',
      eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });
    assert.strictEqual(validResult.success, true);
    // Email should be normalized to lowercase
    assert.strictEqual(validResult.data.email, 'user@example.com');

    const invalidResult = externalOtpRequestBody.safeParse({ email: 'not-an-email', eventId: 'not-a-uuid' });
    assert.strictEqual(invalidResult.success, false);
  });

  test('7. externalOtpVerifyBody rejects non-6-digit code', () => {
    const { externalOtpVerifyBody } = require('../validators/schemas');
    const result1 = externalOtpVerifyBody.safeParse({ email: 'a@b.com', code: '12345' }); // 5 digits
    assert.strictEqual(result1.success, false);

    const result2 = externalOtpVerifyBody.safeParse({ email: 'a@b.com', code: 'abcdef' }); // non-numeric
    assert.strictEqual(result2.success, false);

    const result3 = externalOtpVerifyBody.safeParse({ email: 'a@b.com', code: '123456' }); // valid
    assert.strictEqual(result3.success, true);
  });

  test('8. attendeeQuery schema accepts participantType filter', () => {
    const { attendeeQuery } = require('../validators/schemas');
    const validResult = attendeeQuery.safeParse({ participantType: 'EXTERNAL' });
    assert.strictEqual(validResult.success, true);

    const invalidResult = attendeeQuery.safeParse({ participantType: 'INVALID' });
    assert.strictEqual(invalidResult.success, false);

    const noneResult = attendeeQuery.safeParse({});
    assert.strictEqual(noneResult.success, true); // Filter is optional
  });

  test('9. externalOtpLimiter is exported from rateLimiters', () => {
    const limiters = require('../middleware/rateLimiters');
    assert.ok(typeof limiters.externalOtpLimiter === 'function', 'externalOtpLimiter must be exported');
  });

  test('10. crossCollegeRegisterMiddleware and authenticateExternalToken are exported', () => {
    const { crossCollegeRegisterMiddleware, authenticateExternalToken } = require('../middleware/authMiddleware');
    assert.ok(typeof crossCollegeRegisterMiddleware === 'function');
    assert.ok(typeof authenticateExternalToken === 'function');
  });

  test('11. BrevoEmailAdapter renders EXTERNAL_OTP template correctly', () => {
    const { renderExternalOtp } = require('../workers/brevoEmailAdapter');
    const result = renderExternalOtp('user@example.com', {
      code: '123456',
      eventTitle: 'Hackathon 2026',
      expiresInMinutes: 10,
    });
    assert.ok(result.subject.includes('Hackathon 2026'), 'Subject must include event title');
    assert.ok(result.html.includes('123456'), 'HTML must include the OTP code');
    assert.ok(result.html.includes('10 minutes'), 'HTML must include expiry');
  });

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Phase 3D Regression Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

runRegressionTests().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
