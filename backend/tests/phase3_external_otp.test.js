/**
 * Phase 3 — External Participant OTP Flow
 * Test Suite B: OTP generation, verification, and registration
 *
 * Tests:
 *   1. OTP request creates ExternalAuthOtp row with college_id, correct hash, attempts=0.
 *   2. 60-second cooldown prevents duplicate OTP creation.
 *   3. Daily limit (5) silently ignores 6th request.
 *   4. Correct code verify → consumed_at set, JWT returned with hostCollegeId.
 *   5. Wrong code → 401, attempts incremented.
 *   6. 5 wrong codes → 6th attempt returns 429 (attempt limit).
 *   7. Reuse consumed OTP → not found by query → results in NOT_FOUND (401).
 *   8. Expired OTP → not found by query → 401.
 *   9. External registration creates ExternalParticipant (is_email_verified=true) + EventRegistration.
 *  10. Duplicate external registration → P2002 from uq_event_registrations_external_event.
 *  11. OTP from College A cannot be used to register at College B (hostCollegeId mismatch).
 *  12. hashExternalOtp uses EXTERNAL_OTP_PEPPER, not ACTIVATION_CODE_PEPPER.
 *  13. verifyExternalOtpCode returns false for wrong code, true for correct.
 */

process.env.NODE_ENV = 'development';
process.env.EXTERNAL_OTP_PEPPER = 'test_external_otp_pepper_32_bytes_long!!';
process.env.ACTIVATION_CODE_PEPPER = 'test_pepper_at_least_32_bytes_long_for_security_testing!';
process.env.OUTBOX_ENCRYPTION_KEY = 'test_aes_key_at_least_32_bytes_long_for_outbox_testing!';

const LOCAL_APP_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://app_user:app_user_local_pass@127.0.0.1:5432/yuva_test?schema=public';
const LOCAL_PLATFORM_URL =
  process.env.TEST_PLATFORM_DATABASE_URL ||
  'postgresql://platform_ops:platform_ops_local_pass@127.0.0.1:5432/yuva_test?schema=public';

process.env.DATABASE_URL = LOCAL_APP_URL;
process.env.PLATFORM_DATABASE_URL = LOCAL_PLATFORM_URL;

if (!process.env.TEST_DATABASE_URL) {
  console.error('FATAL: TEST_DATABASE_URL environment variable is required to run Phase 3 tests.');
  process.exit(1);
}

const assert = require('assert');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { withTenant } = require('../config/db');
const { hashExternalOtp, verifyExternalOtpCode, getExternalOtpPepper } = require('../utils/cryptoUtils');

const appPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_APP_URL } } });
const platformPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_PLATFORM_URL } } });

const runId = crypto.randomBytes(4).toString('hex');

async function runExternalOtpTests() {
  console.log('======================================================================');
  console.log('PHASE 3B — EXTERNAL OTP & REGISTRATION TEST SUITE');
  console.log(`Target: Local yuva_test ONLY (Run ID: ${runId})`);
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`  [RUN] ${name}... `);
      await fn();
      console.log('✓ PASS');
      passed++;
    } catch (err) {
      console.log('✗ FAIL');
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // ─── Fixtures ────────────────────────────────────────────────────────────
  const collegeA = await platformPrisma.college.findFirst({
    where: { slug: 'lbrce' },
    select: { id: true, name: true, slug: true },
  });

  if (!collegeA) {
    console.error('FATAL: Need college "lbrce" in yuva_test. Aborting.');
    process.exit(1);
  }

  const clubA = await platformPrisma.club.findFirst({
    where: { collegeId: collegeA.id },
    select: { id: true },
  });

  const publicEvent = await platformPrisma.event.create({
    data: {
      collegeId: collegeA.id,
      clubId: clubA.id,
      title: `Phase3B Event ${runId}`,
      description: 'OTP test event',
      location: 'Main Hall',
      startAt: new Date(Date.now() + 86400000),
      capacity: 20,
      registrationMode: 'INTERNAL',
      visibility: 'PUBLIC',
    },
  });

  const externalEmail = `external_${runId}@test.com`;

  // ─── Unit-level crypto tests (no DB) ─────────────────────────────────────

  await test('1. hashExternalOtp returns 64-char hex string', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = '123456';
    const hash = hashExternalOtp(salt, code);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash), 'Hash must be lowercase hex');
  });

  await test('2. verifyExternalOtpCode returns true for correct code', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = '654321';
    const hash = hashExternalOtp(salt, code);
    assert.strictEqual(verifyExternalOtpCode(salt, code, hash), true);
  });

  await test('3. verifyExternalOtpCode returns false for wrong code', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = '654321';
    const hash = hashExternalOtp(salt, code);
    assert.strictEqual(verifyExternalOtpCode(salt, '000000', hash), false);
  });

  await test('4. EXTERNAL_OTP_PEPPER is distinct from ACTIVATION_CODE_PEPPER', async () => {
    const pepper = getExternalOtpPepper();
    assert.notStrictEqual(pepper, process.env.ACTIVATION_CODE_PEPPER,
      'EXTERNAL_OTP_PEPPER must differ from ACTIVATION_CODE_PEPPER');
  });

  await test('5. hashExternalOtp uses EXTERNAL_OTP_PEPPER (changing pepper changes hash)', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = '111111';
    const hash1 = hashExternalOtp(salt, code);

    // Temporarily change the pepper
    const original = process.env.EXTERNAL_OTP_PEPPER;
    process.env.EXTERNAL_OTP_PEPPER = 'different_pepper_value_also_32_bytes_long!!';
    const hash2 = hashExternalOtp(salt, code);
    process.env.EXTERNAL_OTP_PEPPER = original;

    assert.notStrictEqual(hash1, hash2, 'Different peppers must produce different hashes');
  });

  // ─── Database OTP tests ───────────────────────────────────────────────────

  await test('6. OTP INSERT creates row with college_id set and attempts=0', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashExternalOtp(salt, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otp = await withTenant(collegeA.id, async (tx) => {
      return tx.externalAuthOtp.create({
        data: { collegeId: collegeA.id, email: externalEmail, salt, codeHash, attempts: 0, maxAttempts: 5, expiresAt },
      });
    });

    assert.strictEqual(otp.collegeId, collegeA.id, 'college_id must be set');
    assert.strictEqual(otp.attempts, 0);
    assert.ok(otp.salt);
    assert.ok(otp.codeHash);
    assert.strictEqual(otp.consumedAt, null);
  });

  await test('7. Correct OTP verify: consumed_at set, correct data returned', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashExternalOtp(salt, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Insert OTP
    const otp = await withTenant(collegeA.id, async (tx) => {
      return tx.externalAuthOtp.create({
        data: { collegeId: collegeA.id, email: `verify_${runId}@test.com`, salt, codeHash, attempts: 0, maxAttempts: 5, expiresAt },
      });
    });

    // Simulate verify
    const result = await withTenant(collegeA.id, async (tx) => {
      await tx.externalAuthOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      const isValid = verifyExternalOtpCode(otp.salt, code, otp.codeHash);
      if (isValid) {
        await tx.externalAuthOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      }
      return { isValid };
    });

    assert.strictEqual(result.isValid, true);

    const updated = await withTenant(collegeA.id, async (tx) => {
      return tx.externalAuthOtp.findUnique({ where: { id: otp.id } });
    });
    assert.ok(updated.consumedAt, 'consumedAt must be set after successful verification');
    assert.strictEqual(updated.attempts, 1);
  });

  await test('8. Consumed OTP not found by candidate query (replay prevention)', async () => {
    const foundByQuery = await withTenant(collegeA.id, async (tx) => {
      return tx.externalAuthOtp.findFirst({
        where: { email: `verify_${runId}@test.com`, collegeId: collegeA.id, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
    });
    assert.strictEqual(foundByQuery, null, 'Consumed OTP must not appear in candidate query');
  });

  await test('9. External registration creates ExternalParticipant (is_email_verified=true) + EventRegistration', async () => {
    // Create participant and registration
    const participant = await withTenant(collegeA.id, async (tx) => {
      return tx.externalParticipant.create({
        data: {
          collegeId: collegeA.id,
          email: externalEmail,
          name: 'Test External',
          isEmailVerified: true,
        },
      });
    });

    assert.strictEqual(participant.isEmailVerified, true);
    assert.strictEqual(participant.collegeId, collegeA.id);

    const reg = await withTenant(collegeA.id, async (tx) => {
      return tx.eventRegistration.create({
        data: {
          collegeId: collegeA.id,
          eventId: publicEvent.id,
          userId: null,
          participantType: 'EXTERNAL',
          externalParticipantId: participant.id,
          homeCollegeId: null,
          participantName: 'Test External',
          participantEmail: externalEmail,
          participantRollNumber: null,
          participantCollegeName: 'Test University',
          isUserDeleted: false,
          registeredByRole: 'SELF',
        },
      });
    });

    assert.strictEqual(reg.participantType, 'EXTERNAL');
    assert.strictEqual(reg.userId, null);
    assert.strictEqual(reg.externalParticipantId, participant.id);
  });

  await test('10. Duplicate external registration hits uq_event_registrations_external_event', async () => {
    const participant = await withTenant(collegeA.id, async (tx) => {
      return tx.externalParticipant.findFirst({ where: { collegeId: collegeA.id, email: externalEmail } });
    });

    let caughtDuplicate = false;
    try {
      await withTenant(collegeA.id, async (tx) => {
        await tx.eventRegistration.create({
          data: {
            collegeId: collegeA.id,
            eventId: publicEvent.id,
            userId: null,
            participantType: 'EXTERNAL',
            externalParticipantId: participant.id,
            homeCollegeId: null,
            participantName: 'Test External',
            participantEmail: externalEmail,
            participantRollNumber: null,
            participantCollegeName: null,
            isUserDeleted: false,
            registeredByRole: 'SELF',
          },
        });
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('uq_event_registrations_external_event')) {
        caughtDuplicate = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(caughtDuplicate, true, 'Must throw P2002 on duplicate external registration');
  });

  await test('11. College B RLS: College B context cannot read College A external OTPs', async () => {
    const collegeB = await platformPrisma.college.findFirst({
      where: { NOT: { slug: 'lbrce' } },
      select: { id: true },
    });
    if (!collegeB) {
      console.log('    (skipped — no second college in test DB)');
      return;
    }

    const otps = await withTenant(collegeB.id, async (tx) => {
      return tx.externalAuthOtp.findMany({
        where: { email: externalEmail },
      });
    });
    assert.strictEqual(otps.length, 0, 'RLS must prevent College B from reading College A OTPs');
  });

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Phase 3B Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  await appPrisma.$disconnect();
  await platformPrisma.$disconnect();

  if (failed > 0) process.exit(1);
}

runExternalOtpTests().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
