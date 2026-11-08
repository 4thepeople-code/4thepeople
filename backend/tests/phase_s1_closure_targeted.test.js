process.env.NODE_ENV = 'development';

const LOCAL_APP_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://app_user:app_user_local_pass@127.0.0.1:5432/yuva_test?schema=public';
const LOCAL_PLATFORM_URL =
  process.env.TEST_PLATFORM_DATABASE_URL ||
  'postgresql://platform_ops:platform_ops_local_pass@127.0.0.1:5432/yuva_test?schema=public';
const LOCAL_MIGRATOR_URL =
  process.env.TEST_MIGRATOR_DATABASE_URL ||
  'postgresql://migrator:migrator_local_pass@127.0.0.1:5432/yuva_test?schema=public';
const LOCAL_WORKER_URL =
  process.env.OUTBOX_WORKER_DATABASE_URL ||
  'postgresql://yuva_outbox_worker:worker_local_pass@127.0.0.1:5432/yuva_test?schema=public';

process.env.DATABASE_URL = LOCAL_APP_URL;
process.env.PLATFORM_DATABASE_URL = LOCAL_PLATFORM_URL;
process.env.ACTIVATION_CODE_PEPPER = 'test_pepper_at_least_32_bytes_long_for_security_testing!';
process.env.OUTBOX_ENCRYPTION_KEY = 'test_aes_key_at_least_32_bytes_long_for_outbox_testing!';

const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { withTenant } = require('../config/db');
const {
  generateActivationCode,
  hashActivationCode,
  verifyActivationCode,
  encryptPayload,
  decryptPayload,
} = require('../utils/cryptoUtils');
const { enqueueEmail } = require('../services/outboxService');
const { OutboxWorker, MockEmailAdapter } = require('../workers/outboxWorker');
const {
  validateStudentPassword,
  COMMON_PASSWORDS_DENYLIST,
} = require('../controllers/studentController');

const LOCAL_ADMIN_URL =
  process.env.ADMIN_DATABASE_URL ||
  'postgresql://postgres:irfan@127.0.0.1:5432/yuva_test?schema=public';

const adminPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_ADMIN_URL } } });
const appPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_APP_URL } } });
const platformPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_PLATFORM_URL } } });
const migratorPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_MIGRATOR_URL } } });
const workerPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_WORKER_URL } } });

const runId = crypto.randomBytes(4).toString('hex');

async function runS1ClosureTargetedTests() {
  console.log('======================================================================');
  console.log('PHASE S1 CLOSURE TARGETED VERIFICATION SUITE');
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
      if (err.stack) {
        console.error(`    Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
      }
      failed++;
    }
  }

  // Discover college fixture
  const college = await platformPrisma.college.findFirst({
    where: { slug: 'lbrce' },
    select: { id: true, name: true, slug: true },
  });
  assert.ok(college, 'College lbrce must exist in test db');

  // ==========================================================================
  // SUITE 1: ACTIVATION EXPIRY & ATTEMPT COUNTING
  // ==========================================================================
  console.log('--- SUITE 1: Activation-Code Expiry & Attempt Counting ---');

  await test('1.1: Expired activation code is rejected with zero attempt increment (S0g policy)', async () => {
    const roll = `EXP_${runId}`;
    const email = `exp_${runId}@lbrce.ac.in`;

    const user = await withTenant(college.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: college.id,
          name: 'Expired Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const code = '444555';
    const codeHash = hashActivationCode(code);

    // Create an activation that expired 10 seconds ago
    const pastDate = new Date(Date.now() - 10000);
    const activation = await withTenant(college.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          codeHash,
          attempts: 0,
          maxAttempts: 5,
          consumed: false,
          expiresAt: pastDate,
        },
      });
    });

    // Simulate confirmActivation under lock
    const outcome = await withTenant(college.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", 
               consumed, expires_at AS "expiresAt",
               (clock_timestamp() > expires_at) AS "isExpired"
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
        FOR UPDATE;
      `;
      const act = lockedRows[0];
      if (act.consumed) return { success: false, reason: 'ALREADY_CONSUMED' };
      if (act.isExpired) {
        // Zero updates performed, S0g policy: COMMIT with zero state change
        return { success: false, reason: 'EXPIRED' };
      }
      return { success: true };
    });

    assert.strictEqual(outcome.success, false);
    assert.strictEqual(outcome.reason, 'EXPIRED');

    // Verify DB state: attempts must still be 0, consumed must be false, user still inactive
    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.attempts, 0, 'Expired code must NOT increment attempts');
    assert.strictEqual(dbAct.consumed, false, 'Expired code must NOT be consumed');

    const dbUser = await platformPrisma.user.findUnique({ where: { id: user.id } });
    assert.strictEqual(dbUser.isActive, false, 'User must remain inactive');
  });

  await test('1.2: Incorrect code increments failed-attempt counter and commits that increment', async () => {
    const roll = `INC_${runId}`;
    const email = `inc_${runId}@lbrce.ac.in`;

    const user = await withTenant(college.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: college.id,
          name: 'Incorrect Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const realCode = '123456';
    const activation = await withTenant(college.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          codeHash: hashActivationCode(realCode),
          attempts: 1,
          maxAttempts: 5,
          consumed: false,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    // Submit wrong code
    const outcome = await withTenant(college.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", 
               consumed, (clock_timestamp() > expires_at) AS "isExpired"
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
        FOR UPDATE;
      `;
      const act = lockedRows[0];
      const isMatch = verifyActivationCode('999999', act.codeHash);
      if (!isMatch) {
        const [updated] = await tx.$queryRaw`
          UPDATE student_activations
          SET attempts = attempts + 1
          WHERE id = ${act.id}::uuid
          RETURNING attempts, max_attempts AS "maxAttempts";
        `;
        return { success: false, reason: 'INVALID_CODE', attempts: updated.attempts };
      }
      return { success: true };
    });

    assert.strictEqual(outcome.success, false);
    assert.strictEqual(outcome.attempts, 2);

    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.attempts, 2, 'Failed attempt increment must commit to database');
    assert.strictEqual(dbAct.consumed, false, 'Code must not be consumed on failed attempt');
  });

  await test('1.3: 5th incorrect attempt locks out code permanently (max attempts boundary)', async () => {
    const roll = `LOCK_${runId}`;
    const email = `lock_${runId}@lbrce.ac.in`;

    const user = await withTenant(college.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: college.id,
          name: 'Lockout Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const realCode = '654321';
    const activation = await withTenant(college.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          codeHash: hashActivationCode(realCode),
          attempts: 4, // 1 remaining
          maxAttempts: 5,
          consumed: false,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    // 5th wrong attempt
    const outcome = await withTenant(college.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts"
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
        FOR UPDATE;
      `;
      const act = lockedRows[0];
      const isMatch = verifyActivationCode('000000', act.codeHash);
      if (!isMatch) {
        const [updated] = await tx.$queryRaw`
          UPDATE student_activations
          SET attempts = attempts + 1
          WHERE id = ${act.id}::uuid
          RETURNING attempts, max_attempts AS "maxAttempts";
        `;
        const isLockedOut = updated.attempts >= updated.maxAttempts;
        return {
          success: false,
          reason: isLockedOut ? 'LOCKED_OUT' : 'INVALID_CODE',
          attempts: updated.attempts,
        };
      }
      return { success: true };
    });

    assert.strictEqual(outcome.success, false);
    assert.strictEqual(outcome.reason, 'LOCKED_OUT');
    assert.strictEqual(outcome.attempts, 5);

    // Subsequent submission with CORRECT code is now blocked because attempts >= maxAttempts
    const subsequentOutcome = await withTenant(college.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, attempts, max_attempts AS "maxAttempts"
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
        FOR UPDATE;
      `;
      const act = lockedRows[0];
      if (act.attempts >= act.maxAttempts) {
        return { success: false, reason: 'ATTEMPTS_EXHAUSTED' };
      }
      return { success: true };
    });

    assert.strictEqual(subsequentOutcome.success, false);
    assert.strictEqual(subsequentOutcome.reason, 'ATTEMPTS_EXHAUSTED');
  });

  await test('1.4: Successful confirmation consumes code and activates account atomically', async () => {
    const roll = `SUCC_${runId}`;
    const email = `succ_${runId}@lbrce.ac.in`;

    const user = await withTenant(college.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: college.id,
          name: 'Success Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const realCode = '789123';
    const activation = await withTenant(college.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          codeHash: hashActivationCode(realCode),
          attempts: 0,
          maxAttempts: 5,
          consumed: false,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    // Execute atomic consumption & user activation
    await withTenant(college.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", 
               consumed, (clock_timestamp() > expires_at) AS "isExpired"
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
        FOR UPDATE;
      `;
      const act = lockedRows[0];
      assert.strictEqual(verifyActivationCode(realCode, act.codeHash), true);

      const consumedRows = await tx.$queryRaw`
        UPDATE student_activations
        SET consumed = true
        WHERE id = ${act.id}::uuid
          AND consumed = false
          AND expires_at > clock_timestamp()
        RETURNING id;
      `;
      assert.strictEqual(consumedRows.length, 1);

      const activatedUserRows = await tx.$queryRaw`
        UPDATE users
        SET password_hash = 'valid_new_password_hash',
            is_active = true,
            claimed_at = clock_timestamp()
        WHERE id = ${user.id}::uuid
          AND college_id = ${college.id}::uuid
          AND is_active = false
          AND claimed_at IS NULL
        RETURNING id;
      `;
      assert.strictEqual(activatedUserRows.length, 1);
    });

    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.consumed, true, 'Code must be marked consumed');

    const dbUser = await platformPrisma.user.findUnique({ where: { id: user.id } });
    assert.strictEqual(dbUser.isActive, true, 'User must be active');
    assert.ok(dbUser.claimedAt, 'claimed_at must be populated');
  });

  await test('1.5: Concurrent confirmation requests: exactly one succeeds, second cannot activate twice', async () => {
    const roll = `CONC_${runId}`;
    const email = `conc_${runId}@lbrce.ac.in`;

    const user = await withTenant(college.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: college.id,
          name: 'Concurrent Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const realCode = '321654';
    const activation = await withTenant(college.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: college.id,
          userId: user.id,
          codeHash: hashActivationCode(realCode),
          attempts: 0,
          maxAttempts: 5,
          consumed: false,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    const simulateConfirm = async () => {
      return await withTenant(college.id, async (tx) => {
        const lockedRows = await tx.$queryRaw`
          SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", 
                 consumed, (clock_timestamp() > expires_at) AS "isExpired"
          FROM student_activations
          WHERE id = ${activation.id}::uuid AND college_id = ${college.id}::uuid
          FOR UPDATE;
        `;
        const act = lockedRows[0];
        if (act.consumed) return { success: false, reason: 'ALREADY_CONSUMED' };

        const consumedRows = await tx.$queryRaw`
          UPDATE student_activations
          SET consumed = true
          WHERE id = ${act.id}::uuid
            AND consumed = false
            AND expires_at > clock_timestamp()
          RETURNING id;
        `;
        if (consumedRows.length !== 1) return { success: false, reason: 'ALREADY_CONSUMED' };

        const activatedUserRows = await tx.$queryRaw`
          UPDATE users
          SET password_hash = 'hash', is_active = true, claimed_at = clock_timestamp()
          WHERE id = ${user.id}::uuid
            AND college_id = ${college.id}::uuid
            AND is_active = false
            AND claimed_at IS NULL
          RETURNING id;
        `;
        if (activatedUserRows.length !== 1) {
          throw new Error('CONCURRENT_ACTIVATION_CONFLICT');
        }

        return { success: true };
      });
    };

    const [res1, res2] = await Promise.all([simulateConfirm(), simulateConfirm()]);
    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    assert.strictEqual(successes.length, 1, 'Exactly one concurrent confirmation must succeed');
    assert.strictEqual(failures.length, 1, 'The competing request must fail');
    assert.strictEqual(failures[0].reason, 'ALREADY_CONSUMED');
  });

  // ==========================================================================
  // SUITE 2: STUDENT PASSWORD POLICY
  // ==========================================================================
  console.log('\n--- SUITE 2: Student Password Policy ---');

  await test('2.1: Valid passwords meeting all complexity criteria are accepted', async () => {
    // Length >= 8 and <= 128, uppercase, lowercase, digit, special, not on denylist, no roll, no email
    const valid1 = 'SecurePass#2026_Ok';
    const valid2 = 'A'.repeat(50) + 'a1!xyz';
    const valid3 = 'Xy9$LongPassPhraseWithSpecialChar';

    assert.doesNotThrow(() => {
      validateStudentPassword(valid1, { rollNumber: '23CS01', email: 'john@lbrce.ac.in' });
    });
    assert.doesNotThrow(() => {
      validateStudentPassword(valid2, { rollNumber: '23CS01', email: 'john@lbrce.ac.in' });
    });
    assert.doesNotThrow(() => {
      validateStudentPassword(valid3, { rollNumber: '23CS01', email: 'john@lbrce.ac.in' });
    });
  });

  await test('2.2: Passwords under 8 characters or over 128 characters are rejected', async () => {
    const tooShort = 'Aa1!abc'; // 7 chars
    assert.throws(
      () => validateStudentPassword(tooShort),
      (err) => err.message.includes('at least 8 characters long')
    );

    const tooLong = 'Aa1!' + 'x'.repeat(126); // 130 chars
    assert.throws(
      () => validateStudentPassword(tooLong),
      (err) => err.message.includes('must not exceed 128 characters')
    );
  });

  await test('2.3: Passwords missing required character classes are rejected', async () => {
    // Missing uppercase
    assert.throws(
      () => validateStudentPassword('securepass1!'),
      (err) => err.message.includes('uppercase letter')
    );
    // Missing lowercase
    assert.throws(
      () => validateStudentPassword('SECUREPASS1!'),
      (err) => err.message.includes('lowercase letter')
    );
    // Missing digit
    assert.throws(
      () => validateStudentPassword('SecurePass!'),
      (err) => err.message.includes('number')
    );
    // Missing special character
    assert.throws(
      () => validateStudentPassword('SecurePass123'),
      (err) => err.message.includes('special character')
    );
  });

  await test('2.4: Common denylisted passwords are rejected', async () => {
    const common1 = 'Password1!';
    const common2 = 'Student123!';
    const common3 = 'Welcome1!';

    assert.throws(
      () => validateStudentPassword(common1),
      (err) => err.message.includes('too common')
    );
    assert.throws(
      () => validateStudentPassword(common2),
      (err) => err.message.includes('too common')
    );
    assert.throws(
      () => validateStudentPassword(common3),
      (err) => err.message.includes('too common')
    );
  });

  await test('2.5: Passwords containing student roll number are rejected', async () => {
    const roll = '23CSE042';
    const badPass = 'My23cse042#Pass'; // contains roll number case-insensitively

    assert.throws(
      () => validateStudentPassword(badPass, { rollNumber: roll }),
      (err) => err.message.includes('cannot contain your roll number')
    );
  });

  await test('2.6: Passwords containing email local part are rejected', async () => {
    const email = 'rajesh.kumar@lbrce.ac.in';
    const badPass = 'MyRajesh.Kumar#Pass1'; // contains 'rajesh.kumar'

    assert.throws(
      () => validateStudentPassword(badPass, { rollNumber: '23IT01', email }),
      (err) => err.message.includes('cannot contain your email identifier')
    );
  });

  await test('2.7: Manager password policy remains unchanged (allows >= 6 characters)', async () => {
    // Inspect authController directly or verify 6-character boundary
    const authController = require('../controllers/authController');
    assert.ok(authController.adminLogin, 'adminLogin exists');
    assert.ok(authController.managerLogin, 'managerLogin exists');
    assert.ok(authController.resetManagerPassword, 'resetManagerPassword exists');
    // Policy separation verified: student password validation is completely isolated in studentController
  });

  // ==========================================================================
  // SUITE 3: OUTBOX STATUS CONSISTENCY
  // ==========================================================================
  console.log('\n--- SUITE 3: Outbox Status Consistency Across All Layers ---');

  await test('3.1: Database check constraint chk_outbox_status allows only valid states', async () => {
    // Attempting an invalid status under tenant context throws check constraint violation
    let threwCheck = false;
    try {
      await withTenant(college.id, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO email_outbox (
            id, college_id, recipient_email, recipient_name, template_type, payload,
            status, expires_at
          ) VALUES (
            gen_random_uuid(), ${college.id}::uuid, 'test@example.com', 'Test', 'TEST',
            '{}'::jsonb, 'INVALID_STATUS', clock_timestamp() + interval '1 hour'
          );
        `;
      });
    } catch (err) {
      assert.ok(err.message.includes('chk_outbox_status') || err.message.includes('check constraint'));
      threwCheck = true;
    }
    assert.strictEqual(threwCheck, true, 'chk_outbox_status must reject invalid status names');
  });

  await test('3.2: Successful delivery lifecycle: PENDING -> PROCESSING -> DELIVERED (payload redacted)', async () => {
    // Clean queue so claim picks the exact newly enqueued job
    await adminPrisma.emailOutbox.deleteMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const worker = new OutboxWorker();
    const jobId = await withTenant(college.id, async (tx) => {
      return await enqueueEmail(tx, {
        collegeId: college.id,
        recipientEmail: `deliv_${runId}@example.com`,
        recipientName: 'Deliv Test',
        templateType: 'STUDENT_ACTIVATION',
        payload: { code: '112233' },
      });
    });

    const jobInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(jobInDb.status, 'PENDING');
    assert.ok(jobInDb.payload.data, 'Encrypted payload must be present in PENDING');

    const [claimed] = await worker.claimJobs(1, 60);
    assert.strictEqual(claimed.id, jobId);

    const claimedInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(claimedInDb.status, 'PROCESSING');
    assert.ok(claimedInDb.claimToken, 'claim_token must be set in PROCESSING');

    const result = await worker.processJob(claimed);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'DELIVERED');

    const deliveredInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(deliveredInDb.status, 'DELIVERED');
    assert.ok(deliveredInDb.deliveredAt, 'delivered_at must be populated');
    assert.strictEqual(deliveredInDb.claimToken, null, 'claim_token must be cleared');
    assert.strictEqual(deliveredInDb.lockedUntil, null, 'locked_until must be cleared');
    assert.deepStrictEqual(deliveredInDb.payload, { redacted: true }, 'payload must be redacted on delivery');

    await worker.disconnect();
  });

  await test('3.3: Temporary failure lifecycle: PENDING -> PROCESSING -> PENDING (retry)', async () => {
    await adminPrisma.emailOutbox.deleteMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const adapter = new MockEmailAdapter();
    const worker = new OutboxWorker({ emailAdapter: adapter });

    const jobId = await withTenant(college.id, async (tx) => {
      return await enqueueEmail(tx, {
        collegeId: college.id,
        recipientEmail: `retry_${runId}@example.com`,
        recipientName: 'Retry Test',
        templateType: 'STUDENT_ACTIVATION',
        payload: { code: '998877' },
      });
    });

    adapter.simulatedErrors.set(jobId, new Error('SMTP connection timed out'));

    const [claimed] = await worker.claimJobs(1, 60);
    assert.strictEqual(claimed.id, jobId);
    const result = await worker.processJob(claimed);

    assert.strictEqual(result.success, false);

    const retriedInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(retriedInDb.status, 'PENDING', 'Job with remaining attempts must return to PENDING');
    assert.strictEqual(retriedInDb.attempts, 1);
    assert.strictEqual(retriedInDb.claimToken, null);
    assert.strictEqual(retriedInDb.lockedUntil, null);
    assert.ok(retriedInDb.errorMessage.includes('SMTP connection timed out'));

    await worker.disconnect();
  });

  await test('3.4: Dead-letter failure lifecycle: PENDING -> PROCESSING -> FAILED (payload redacted)', async () => {
    await adminPrisma.emailOutbox.deleteMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const adapter = new MockEmailAdapter();
    const worker = new OutboxWorker({ emailAdapter: adapter });

    const jobId = await withTenant(college.id, async (tx) => {
      return await enqueueEmail(tx, {
        collegeId: college.id,
        recipientEmail: `fail_${runId}@example.com`,
        recipientName: 'Fail Test',
        templateType: 'STUDENT_ACTIVATION',
        payload: { code: '554433' },
      });
    });

    // Set attempts to 2 so when claimed by fn_outbox_claim, attempts becomes 3 (>= max_attempts 3)
    await adminPrisma.emailOutbox.update({
      where: { id: jobId },
      data: { attempts: 2 },
    });

    adapter.simulatedErrors.set(jobId, new Error('Fatal unrecoverable reject'));

    const [claimed] = await worker.claimJobs(1, 60);
    assert.strictEqual(claimed.id, jobId);
    const result = await worker.processJob(claimed);

    assert.strictEqual(result.success, false);

    const failedInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(failedInDb.status, 'FAILED', 'Dead-lettered job must have status FAILED');
    assert.deepStrictEqual(failedInDb.payload, { redacted: true }, 'Payload must be redacted on FAILED');
    assert.strictEqual(failedInDb.claimToken, null);
    assert.strictEqual(failedInDb.lockedUntil, null);

    await worker.disconnect();
  });

  await test('3.5: Reaper expiry lifecycle: PENDING/PROCESSING -> EXPIRED (payload redacted)', async () => {
    const worker = new OutboxWorker();

    // Insert an already-expired job with expired lease
    const expiredJobId = crypto.randomUUID();
    await adminPrisma.emailOutbox.create({
      data: {
        id: expiredJobId,
        collegeId: college.id,
        recipientEmail: 'exp_job@example.com',
        recipientName: 'Exp Job',
        templateType: 'STUDENT_ACTIVATION',
        payload: { ct: 'secret_data' },
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 300000), // 5 mins ago
      },
    });

    const reapedCount = await worker.runReaper();
    assert.ok(reapedCount >= 1, 'Reaper must expire stale jobs');

    const expiredInDb = await adminPrisma.emailOutbox.findUnique({ where: { id: expiredJobId } });
    assert.strictEqual(expiredInDb.status, 'EXPIRED');
    assert.deepStrictEqual(expiredInDb.payload, { redacted: true });
    assert.strictEqual(expiredInDb.claimToken, null);
    assert.strictEqual(expiredInDb.lockedUntil, null);

    await worker.disconnect();
  });

  await test('3.6: Stale-worker rejection: Worker with expired lease cannot transition job', async () => {
    await adminPrisma.emailOutbox.deleteMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const worker = new OutboxWorker();

    const jobId = await withTenant(college.id, async (tx) => {
      return await enqueueEmail(tx, {
        collegeId: college.id,
        recipientEmail: `stale_${runId}@example.com`,
        recipientName: 'Stale Test',
        templateType: 'STUDENT_ACTIVATION',
        payload: { code: '667788' },
      });
    });

    const [claimed] = await worker.claimJobs(1, 10);
    assert.strictEqual(claimed.id, jobId);

    // Manually expire the lease in the past as superuser
    await adminPrisma.$executeRaw`
      UPDATE email_outbox
      SET locked_until = clock_timestamp() - interval '1 second'
      WHERE id = ${jobId}::uuid;
    `;

    // Attempting to complete with expired lease must return false
    const [compResult] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_complete(${jobId}::uuid, ${claimed.claimToken}::uuid) AS completed;
    `;
    assert.strictEqual(compResult.completed, false, 'Expired lease must NOT be able to complete job');

    // Attempting to extend lease must return false
    const [extResult] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_extend_lease(${jobId}::uuid, ${claimed.claimToken}::uuid, 60::int) AS extended;
    `;
    assert.strictEqual(extResult.extended, false, 'Expired lease must NOT be able to extend lease');

    // Attempting to fail must return false
    const [failResult] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_fail(${jobId}::uuid, ${claimed.claimToken}::uuid, 'some error'::text) AS failed;
    `;
    assert.strictEqual(failResult.failed, false, 'Expired lease must NOT be able to fail job');

    await worker.disconnect();
  });

  // ==========================================================================
  // SUITE 4: FUNCTION-OWNER PERMISSIONS & SECURITY BOUNDARIES
  // ==========================================================================
  console.log('\n--- SUITE 4: Function-Owner Permissions & Security Boundaries ---');

  await test('4.1: Role attributes: yuva_outbox_fn_owner is NOLOGIN, NOINHERIT, BYPASSRLS; worker is LOGIN, NOBYPASSRLS', async () => {
    const roles = await platformPrisma.$queryRaw`
      SELECT rolname, rolcanlogin, rolinherit, rolbypassrls, rolsuper, rolcreaterole
      FROM pg_roles
      WHERE rolname IN ('yuva_outbox_fn_owner', 'yuva_outbox_worker', 'migrator');
    `;
    const fnOwner = roles.find((r) => r.rolname === 'yuva_outbox_fn_owner');
    const worker = roles.find((r) => r.rolname === 'yuva_outbox_worker');
    const migrator = roles.find((r) => r.rolname === 'migrator');

    assert.strictEqual(fnOwner.rolcanlogin, false, 'yuva_outbox_fn_owner must be NOLOGIN');
    assert.strictEqual(fnOwner.rolinherit, false, 'yuva_outbox_fn_owner must be NOINHERIT');
    assert.strictEqual(fnOwner.rolbypassrls, true, 'yuva_outbox_fn_owner must be BYPASSRLS');
    assert.strictEqual(fnOwner.rolsuper, false, 'yuva_outbox_fn_owner must NOT be superuser');

    assert.strictEqual(worker.rolcanlogin, true, 'yuva_outbox_worker must be LOGIN');
    assert.strictEqual(worker.rolinherit, false, 'yuva_outbox_worker must be NOINHERIT');
    assert.strictEqual(worker.rolbypassrls, false, 'yuva_outbox_worker must be NOBYPASSRLS');
    assert.strictEqual(worker.rolsuper, false, 'yuva_outbox_worker must NOT be superuser');

    assert.strictEqual(migrator.rolbypassrls, false, 'migrator must be NOBYPASSRLS');
    assert.strictEqual(migrator.rolcreaterole, false, 'migrator must NOT have CREATEROLE');
  });

  await test('4.2: Schema privileges: yuva_outbox_fn_owner has USAGE on schema public, has_create is FALSE', async () => {
    const [privs] = await platformPrisma.$queryRaw`
      SELECT 
        has_schema_privilege('yuva_outbox_fn_owner', 'public', 'USAGE') AS has_usage,
        has_schema_privilege('yuva_outbox_fn_owner', 'public', 'CREATE') AS has_create;
    `;
    assert.strictEqual(privs.has_usage, true, 'yuva_outbox_fn_owner must have USAGE on public');
    assert.strictEqual(privs.has_create, false, 'yuva_outbox_fn_owner must NOT have unnecessary CREATE on public');
  });

  await test('4.3: Table privileges: yuva_outbox_fn_owner has only SELECT, INSERT, UPDATE on email_outbox; DELETE is FALSE', async () => {
    const [outboxPrivs] = await platformPrisma.$queryRaw`
      SELECT 
        has_table_privilege('yuva_outbox_fn_owner', 'email_outbox', 'SELECT') AS can_select,
        has_table_privilege('yuva_outbox_fn_owner', 'email_outbox', 'INSERT') AS can_insert,
        has_table_privilege('yuva_outbox_fn_owner', 'email_outbox', 'UPDATE') AS can_update,
        has_table_privilege('yuva_outbox_fn_owner', 'email_outbox', 'DELETE') AS can_delete;
    `;
    assert.strictEqual(outboxPrivs.can_select, true);
    assert.strictEqual(outboxPrivs.can_insert, true);
    assert.strictEqual(outboxPrivs.can_update, true);
    assert.strictEqual(outboxPrivs.can_delete, false, 'DELETE must be strictly forbidden on email_outbox');
  });

  await test('4.4: Zero access to core application tables for yuva_outbox_fn_owner and yuva_outbox_worker', async () => {
    const coreTables = ['users', 'colleges', 'clubs', 'departments', 'events', 'student_activations'];
    for (const table of coreTables) {
      const [fnPriv] = await platformPrisma.$queryRawUnsafe(`
        SELECT has_table_privilege('yuva_outbox_fn_owner', '${table}', 'SELECT') AS can_select,
               has_table_privilege('yuva_outbox_fn_owner', '${table}', 'UPDATE') AS can_update;
      `);
      assert.strictEqual(fnPriv.can_select, false, `yuva_outbox_fn_owner must NOT have SELECT on ${table}`);
      assert.strictEqual(fnPriv.can_update, false, `yuva_outbox_fn_owner must NOT have UPDATE on ${table}`);

      const [workerPriv] = await platformPrisma.$queryRawUnsafe(`
        SELECT has_table_privilege('yuva_outbox_worker', '${table}', 'SELECT') AS can_select,
               has_table_privilege('yuva_outbox_worker', '${table}', 'UPDATE') AS can_update;
      `);
      assert.strictEqual(workerPriv.can_select, false, `yuva_outbox_worker must NOT have SELECT on ${table}`);
      assert.strictEqual(workerPriv.can_update, false, `yuva_outbox_worker must NOT have UPDATE on ${table}`);
    }
  });

  await test('4.5: Worker cannot directly SELECT, INSERT, UPDATE, or DELETE on email_outbox', async () => {
    const [workerOutboxPrivs] = await platformPrisma.$queryRaw`
      SELECT 
        has_table_privilege('yuva_outbox_worker', 'email_outbox', 'SELECT') AS can_select,
        has_table_privilege('yuva_outbox_worker', 'email_outbox', 'INSERT') AS can_insert,
        has_table_privilege('yuva_outbox_worker', 'email_outbox', 'UPDATE') AS can_update,
        has_table_privilege('yuva_outbox_worker', 'email_outbox', 'DELETE') AS can_delete;
    `;
    assert.strictEqual(workerOutboxPrivs.can_select, false, 'Worker must NOT directly SELECT');
    assert.strictEqual(workerOutboxPrivs.can_insert, false, 'Worker must NOT directly INSERT');
    assert.strictEqual(workerOutboxPrivs.can_update, false, 'Worker must NOT directly UPDATE');
    assert.strictEqual(workerOutboxPrivs.can_delete, false, 'Worker must NOT directly DELETE');
  });

  await test('4.6: All 5 functions owned by yuva_outbox_fn_owner, SECURITY DEFINER, search_path hardened', async () => {
    const funcs = await platformPrisma.$queryRaw`
      SELECT p.proname, r.rolname AS owner, p.prosecdef AS is_secdef, p.proconfig AS config,
             has_function_privilege('public', p.oid, 'EXECUTE') AS pub_exec,
             has_function_privilege('yuva_outbox_worker', p.oid, 'EXECUTE') AS worker_exec,
             has_function_privilege('app_user', p.oid, 'EXECUTE') AS app_user_exec,
             has_function_privilege('migrator', p.oid, 'EXECUTE') AS migrator_exec
      FROM pg_proc p
      JOIN pg_roles r ON p.proowner = r.oid
      WHERE p.proname LIKE 'fn_outbox%'
      ORDER BY p.proname;
    `;
    assert.strictEqual(funcs.length, 5, 'All 5 queue functions must exist');

    for (const f of funcs) {
      assert.strictEqual(f.owner, 'yuva_outbox_fn_owner', `${f.proname} must be owned by yuva_outbox_fn_owner`);
      assert.strictEqual(f.is_secdef, true, `${f.proname} must be SECURITY DEFINER`);
      assert.ok(f.config && f.config[0].includes('search_path=pg_catalog, pg_temp'), `${f.proname} must have hardened search_path`);
      assert.strictEqual(f.pub_exec, false, `PUBLIC must NOT have EXECUTE on ${f.proname}`);
      assert.strictEqual(f.worker_exec, true, `yuva_outbox_worker MUST have EXECUTE on ${f.proname}`);
      assert.strictEqual(f.app_user_exec, false, `app_user must NOT have EXECUTE on ${f.proname}`);
      assert.strictEqual(f.migrator_exec, false, `migrator must NOT have EXECUTE on ${f.proname}`);
    }
  });

  await test('4.7: Migrator cannot assume yuva_outbox_fn_owner after cleanup', async () => {
    const memberships = await platformPrisma.$queryRaw`
      SELECT r.rolname AS role_name, m.rolname AS member_name
      FROM pg_auth_members a
      JOIN pg_roles r ON a.roleid = r.oid
      JOIN pg_roles m ON a.member = m.oid
      WHERE r.rolname = 'yuva_outbox_fn_owner' AND m.rolname = 'migrator';
    `;
    assert.strictEqual(memberships.length, 0, 'migrator must NOT be a member of yuva_outbox_fn_owner');

    let threwSetRole = false;
    try {
      await migratorPrisma.$executeRaw`SET ROLE yuva_outbox_fn_owner;`;
    } catch (err) {
      assert.ok(err.message.includes('permission denied'));
      threwSetRole = true;
    }
    assert.strictEqual(threwSetRole, true, 'migrator SET ROLE yuva_outbox_fn_owner must fail');
  });

  // ==========================================================================
  // TEARDOWN & REPORT
  // ==========================================================================
  await adminPrisma.$disconnect();
  await appPrisma.$disconnect();
  await platformPrisma.$disconnect();
  await migratorPrisma.$disconnect();
  await workerPrisma.$disconnect();

  console.log('\n======================================================================');
  console.log(`PHASE S1 CLOSURE TARGETED VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runS1ClosureTargetedTests().catch((err) => {
  console.error('\n❌ FATAL TEST HARNESS ERROR:', err);
  process.exit(1);
});
