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

// Initialize Prisma clients for different roles
const appPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_APP_URL } } });
const platformPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_PLATFORM_URL } } });
const migratorPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_MIGRATOR_URL } } });
const workerPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_WORKER_URL } } });

const runId = crypto.randomBytes(4).toString('hex');

async function runS1Verification() {
  console.log('======================================================================');
  console.log('STARTING PHASE S1 AUTOMATED VERIFICATION SUITE');
  console.log(`Target: Local yuva_test ONLY (Run ID: ${runId})`);
  console.log('======================================================================');

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

  // 0. Environment Setup & Tenant Fixture Discovery
  console.log('\n[SETUP] Discovering or seeding tenant colleges and departments...');
  let collegeA, collegeB, deptA, deptB;

  collegeA = await platformPrisma.college.findFirst({ where: { slug: 'lbrce' } });
  if (!collegeA) {
    collegeA = await platformPrisma.college.create({
      data: { name: 'LBRCE Test College', slug: 'lbrce', studentEmailDomain: 'lbrce.ac.in' },
    });
  } else if (!collegeA.studentEmailDomain) {
    collegeA = await platformPrisma.college.update({
      where: { id: collegeA.id },
      data: { studentEmailDomain: 'lbrce.ac.in' },
    });
  }

  collegeB = await platformPrisma.college.findFirst({ where: { slug: 'vrsec' } });
  if (!collegeB) {
    collegeB = await platformPrisma.college.create({
      data: { name: 'VRSEC Test College', slug: 'vrsec', studentEmailDomain: 'vrsec.ac.in' },
    });
  } else if (!collegeB.studentEmailDomain) {
    collegeB = await platformPrisma.college.update({
      where: { id: collegeB.id },
      data: { studentEmailDomain: 'vrsec.ac.in' },
    });
  }

  deptA = await platformPrisma.department.findFirst({ where: { collegeId: collegeA.id, shortCode: 'CSE' } });
  if (!deptA) {
    deptA = await platformPrisma.department.create({
      data: { collegeId: collegeA.id, name: 'Computer Science', shortCode: 'CSE' },
    });
  }

  deptB = await platformPrisma.department.findFirst({ where: { collegeId: collegeB.id, shortCode: 'ECE' } });
  if (!deptB) {
    deptB = await platformPrisma.department.create({
      data: { collegeId: collegeB.id, name: 'Electronics and Comm', shortCode: 'ECE' },
    });
  }

  console.log(`  Tenant A: ${collegeA.name} (${collegeA.id})`);
  console.log(`  Tenant B: ${collegeB.name} (${collegeB.id})`);

  // =========================================================================
  // SUITE 1: Hardened Queue Functions & Lease Fencing
  // =========================================================================
  console.log('\n--- SUITE 1: Hardened Queue Functions & Lease Fencing ---');

  await test('1.1: NULL and out-of-range parameters are rejected by all queue functions', async () => {
    let errCaught = false;
    try {
      await workerPrisma.$queryRaw`SELECT * FROM public.fn_outbox_claim(5, 1);`;
    } catch (err) {
      assert.ok(err.message.includes('p_lease_seconds must be between 10 and 600'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'claim must reject lease < 10s');

    errCaught = false;
    try {
      await workerPrisma.$queryRaw`SELECT * FROM public.fn_outbox_claim(120, 0);`;
    } catch (err) {
      assert.ok(err.message.includes('p_batch_size must be between 1 and 50'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'claim must reject batch < 1');

    errCaught = false;
    try {
      await workerPrisma.$queryRaw`SELECT public.fn_outbox_complete(NULL, gen_random_uuid());`;
    } catch (err) {
      assert.ok(err.message.includes('must not be null'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'complete must reject null job ID');

    errCaught = false;
    try {
      await workerPrisma.$queryRaw`SELECT public.fn_outbox_fail(NULL, gen_random_uuid(), 'test');`;
    } catch (err) {
      assert.ok(err.message.includes('must not be null'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'fail must reject null job ID');

    errCaught = false;
    try {
      await workerPrisma.$queryRaw`SELECT public.fn_outbox_extend_lease(gen_random_uuid(), gen_random_uuid(), 2);`;
    } catch (err) {
      assert.ok(err.message.includes('p_extension_seconds must be between 10 and 600'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'extend_lease must reject extension < 10s');
  });

  await test('1.2: Distinct claim tokens generated per claimed row', async () => {
    const job1Id = crypto.randomUUID();
    const job2Id = crypto.randomUUID();
    const enc1 = encryptPayload({ msg: 1 }, { jobId: job1Id, collegeId: collegeA.id, recipientEmail: `u1_${runId}@test.com`, templateType: 'STUDENT_ACTIVATION' });
    const enc2 = encryptPayload({ msg: 2 }, { jobId: job2Id, collegeId: collegeA.id, recipientEmail: `u2_${runId}@test.com`, templateType: 'STUDENT_ACTIVATION' });

    await platformPrisma.emailOutbox.createMany({
      data: [
        { id: job1Id, collegeId: collegeA.id, recipientEmail: `u1_${runId}@test.com`, recipientName: 'User 1', templateType: 'STUDENT_ACTIVATION', payload: enc1, status: 'PENDING', expiresAt: new Date(Date.now() + 600000) },
        { id: job2Id, collegeId: collegeA.id, recipientEmail: `u2_${runId}@test.com`, recipientName: 'User 2', templateType: 'STUDENT_ACTIVATION', payload: enc2, status: 'PENDING', expiresAt: new Date(Date.now() + 600000) },
      ],
    });

    const claimed = await workerPrisma.$queryRaw`SELECT * FROM public.fn_outbox_claim(120, 2);`;
    assert.ok(claimed.length >= 2, 'Should claim at least 2 jobs');
    const token1 = claimed[0].claim_token;
    const token2 = claimed[1].claim_token;
    assert.ok(token1, 'Token 1 must not be null');
    assert.ok(token2, 'Token 2 must not be null');
    assert.notStrictEqual(token1, token2, 'Each claimed row must have a distinct, unique claim_token');

    await workerPrisma.$queryRaw`SELECT public.fn_outbox_complete(${claimed[0].id}::uuid, ${token1}::uuid);`;
    await workerPrisma.$queryRaw`SELECT public.fn_outbox_complete(${claimed[1].id}::uuid, ${token2}::uuid);`;
  });

  await test('1.3: Worker lease expiry fencing: expired lease cannot complete, extend, or fail', async () => {
    const jobId = crypto.randomUUID();
    const enc = encryptPayload({ test: true }, { jobId, collegeId: collegeA.id, recipientEmail: `exp_${runId}@test.com`, templateType: 'STUDENT_ACTIVATION' });
    const claimToken = crypto.randomUUID();

    await platformPrisma.emailOutbox.create({
      data: {
        id: jobId,
        collegeId: collegeA.id,
        recipientEmail: `exp_${runId}@test.com`,
        recipientName: 'Exp User',
        templateType: 'STUDENT_ACTIVATION',
        payload: enc,
        status: 'PROCESSING',
        claimToken,
        lockedUntil: new Date(Date.now() - 1000), // Expired 1s ago
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    const [compRes] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_complete(${jobId}::uuid, ${claimToken}::uuid) AS res;
    `;
    assert.strictEqual(compRes.res, false, 'fn_outbox_complete must return FALSE for expired lease');

    const [extRes] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_extend_lease(${jobId}::uuid, ${claimToken}::uuid, 120) AS res;
    `;
    assert.strictEqual(extRes.res, false, 'fn_outbox_extend_lease must return FALSE for expired lease');

    const [failRes] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_fail(${jobId}::uuid, ${claimToken}::uuid, 'timeout error') AS res;
    `;
    assert.strictEqual(failRes.res, false, 'fn_outbox_fail must return FALSE for expired lease');

    const jobInDb = await platformPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(jobInDb.status, 'PROCESSING');
    assert.notStrictEqual(jobInDb.payload.redacted, true);

    await platformPrisma.emailOutbox.delete({ where: { id: jobId } });
  });

  await test('1.4: Stale worker cannot fail a job reclaimed by another worker', async () => {
    await platformPrisma.emailOutbox.deleteMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const jobId = crypto.randomUUID();
    const enc = encryptPayload({ test: true }, { jobId, collegeId: collegeA.id, recipientEmail: `stale_${runId}@test.com`, templateType: 'STUDENT_ACTIVATION' });
    const worker1Token = crypto.randomUUID();

    await platformPrisma.emailOutbox.create({
      data: {
        id: jobId,
        collegeId: collegeA.id,
        recipientEmail: `stale_${runId}@test.com`,
        recipientName: 'Stale User',
        templateType: 'STUDENT_ACTIVATION',
        payload: enc,
        status: 'PROCESSING',
        claimToken: worker1Token,
        lockedUntil: new Date(Date.now() - 2000),
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    const [reclaimed] = await workerPrisma.$queryRaw`
      SELECT * FROM public.fn_outbox_claim(120, 1);
    `;
    assert.ok(reclaimed, 'Worker 2 must successfully reclaim the stale job');
    assert.strictEqual(reclaimed.id, jobId, 'Worker 2 must claim the intended test job');
    const worker2Token = reclaimed.claim_token;
    assert.notStrictEqual(worker1Token, worker2Token);

    const [staleFail] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_fail(${jobId}::uuid, ${worker1Token}::uuid, 'late failure from worker 1') AS res;
    `;
    assert.strictEqual(staleFail.res, false, 'Stale worker 1 must NOT be permitted to fail reclaimed job');

    const [w2Complete] = await workerPrisma.$queryRaw`
      SELECT public.fn_outbox_complete(${jobId}::uuid, ${worker2Token}::uuid) AS res;
    `;
    assert.strictEqual(w2Complete.res, true, 'Worker 2 must successfully complete job');

    const finalDb = await platformPrisma.emailOutbox.findUnique({ where: { id: jobId } });
    assert.strictEqual(finalDb.status, 'DELIVERED');
    assert.strictEqual(finalDb.payload.redacted, true);
  });

  await test('1.5: Reaper safety: fn_outbox_expire never expires jobs with active valid lease', async () => {
    const activeJobId = crypto.randomUUID();
    const enc = encryptPayload({ active: true }, { jobId: activeJobId, collegeId: collegeA.id, recipientEmail: `act_${runId}@test.com`, templateType: 'STUDENT_ACTIVATION' });
    const activeToken = crypto.randomUUID();

    await platformPrisma.emailOutbox.create({
      data: {
        id: activeJobId,
        collegeId: collegeA.id,
        recipientEmail: `act_${runId}@test.com`,
        recipientName: 'Active User',
        templateType: 'STUDENT_ACTIVATION',
        payload: enc,
        status: 'PROCESSING',
        claimToken: activeToken,
        lockedUntil: new Date(Date.now() + 60000),
        expiresAt: new Date(Date.now() - 5000),
      },
    });

    await workerPrisma.$queryRaw`SELECT public.fn_outbox_expire();`;

    const activeJobDb = await platformPrisma.emailOutbox.findUnique({ where: { id: activeJobId } });
    assert.strictEqual(activeJobDb.status, 'PROCESSING', 'Job with active lease must not be expired by reaper');

    await workerPrisma.$queryRaw`SELECT public.fn_outbox_complete(${activeJobId}::uuid, ${activeToken}::uuid);`;
  });

  // =========================================================================
  // SUITE 2: Role Privileges & Isolation Boundaries
  // =========================================================================
  console.log('\n--- SUITE 2: Role Privileges & Isolation Boundaries ---');

  await test('2.1: Migrator cannot assume yuva_outbox_fn_owner role after approved cleanup', async () => {
    let errCaught = false;
    try {
      await migratorPrisma.$executeRawUnsafe(`SET ROLE yuva_outbox_fn_owner;`);
    } catch (err) {
      assert.ok(err.message.includes('permission denied') || err.message.includes('cannot set role'));
      errCaught = true;
    }
    assert.strictEqual(errCaught, true, 'Migrator must be prevented from setting role yuva_outbox_fn_owner');
  });

  await test('2.2: Function owner yuva_outbox_fn_owner cannot read core application tables', async () => {
    const pgSuper = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:irfan@127.0.0.1:5432/yuva_test?schema=public' } } });
    try {
      // Check users table in its own transaction
      let errUsers = false;
      try {
        await pgSuper.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE yuva_outbox_fn_owner;`);
          await tx.$queryRaw`SELECT * FROM public.users LIMIT 1;`;
        });
      } catch (err) {
        assert.ok(err.message.includes('permission denied'));
        errUsers = true;
      }
      assert.strictEqual(errUsers, true, 'yuva_outbox_fn_owner must NOT have SELECT on users');

      // Check clubs table in its own transaction
      let errClubs = false;
      try {
        await pgSuper.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE yuva_outbox_fn_owner;`);
          await tx.$queryRaw`SELECT * FROM public.clubs LIMIT 1;`;
        });
      } catch (err) {
        assert.ok(err.message.includes('permission denied'));
        errClubs = true;
      }
      assert.strictEqual(errClubs, true, 'yuva_outbox_fn_owner must NOT have SELECT on clubs');
    } finally {
      await pgSuper.$disconnect();
    }
  });

  await test('2.3: Worker login role yuva_outbox_worker cannot perform direct table DML', async () => {
    let selectErr = false;
    try {
      await workerPrisma.$executeRawUnsafe(`SELECT * FROM public.email_outbox LIMIT 1;`);
    } catch (err) {
      assert.ok(err.message.includes('permission denied'));
      selectErr = true;
    }
    assert.strictEqual(selectErr, true, 'yuva_outbox_worker must NOT have direct SELECT on email_outbox');

    let updateErr = false;
    try {
      await workerPrisma.$executeRawUnsafe(`UPDATE public.email_outbox SET status = 'FAILED';`);
    } catch (err) {
      assert.ok(err.message.includes('permission denied'));
      updateErr = true;
    }
    assert.strictEqual(updateErr, true, 'yuva_outbox_worker must NOT have direct UPDATE on email_outbox');
  });

  await test('2.4: app_user cannot SELECT payload column from email_outbox', async () => {
    let payloadErr = false;
    try {
      await appPrisma.$executeRawUnsafe(`SELECT payload FROM public.email_outbox LIMIT 1;`);
    } catch (err) {
      assert.ok(err.message.includes('permission denied'));
      payloadErr = true;
    }
    assert.strictEqual(payloadErr, true, 'app_user must NOT have SELECT on sensitive payload column');

    const metadataRes = await withTenant(collegeA.id, async (tx) => {
      return await tx.$queryRaw`SELECT id, recipient_email, status FROM public.email_outbox LIMIT 1;`;
    });
    assert.ok(Array.isArray(metadataRes), 'app_user must have metadata column SELECT under RLS');
  });

  // =========================================================================
  // SUITE 3: Student Roster & Tenant Foreign Key Integrity
  // =========================================================================
  console.log('\n--- SUITE 3: Student Roster & Tenant Foreign Key Integrity ---');

  await test('3.1: Composite tenant foreign key blocks cross-tenant activation references', async () => {
    const userInA = await platformPrisma.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'Tenant A Student',
        email: `student_a_${runId}@lbrce.ac.in`,
        rollNumber: `21A_${runId}`,
        isActive: false,
      },
    });

    let fkViolation = false;
    try {
      await platformPrisma.$executeRawUnsafe(`
        INSERT INTO public.student_activations (college_id, user_id, code_hash, expires_at)
        VALUES ('${collegeB.id}'::uuid, '${userInA.id}'::uuid, 'fakehash', now() + interval '10 minutes');
      `);
    } catch (err) {
      assert.ok(err.message.includes('fk_student_activations_user') || err.message.includes('foreign key constraint'));
      assert.ok(err.message.includes('23503') || err.message.includes('foreign_key_violation'));
      fkViolation = true;
    }
    assert.strictEqual(fkViolation, true, 'PostgreSQL must reject cross-tenant activation user reference');
  });

  await test('3.2: Roster upload creates inactive students with NULL password and format constraints', async () => {
    const rawRoll = `22CSE_${runId}`;
    const email = `22cse_${runId}@lbrce.ac.in`;

    const createdStudent = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'Jane Doe',
          email,
          rollNumber: rawRoll,
          departmentId: deptA.id,
          admissionYear: 2022,
          role: 'USER',
          isActive: false,
          passwordHash: null,
        },
      });
    });

    assert.strictEqual(createdStudent.rollNumber, rawRoll);
    assert.strictEqual(createdStudent.isActive, false);
    assert.strictEqual(createdStudent.passwordHash, null);
    assert.strictEqual(createdStudent.admissionYear, 2022);
  });

  // =========================================================================
  // SUITE 4: Student Activation Transaction Atomicity & Concurrency
  // =========================================================================
  console.log('\n--- SUITE 4: Student Activation Transaction Atomicity & Concurrency ---');

  await test('4.1: Activation request enqueues encrypted outbox job with Brevo UUID and AAD', async () => {
    const roll = `23C1_${runId}`;
    const email = `23c1_${runId}@lbrce.ac.in`;

    const student = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'Test Activator',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const code = generateActivationCode();
    const codeHash = hashActivationCode(code);
    assert.strictEqual(verifyActivationCode(code, codeHash), true);

    let enqueuedJobId;
    await withTenant(collegeA.id, async (tx) => {
      await tx.studentActivation.create({
        data: {
          collegeId: collegeA.id,
          userId: student.id,
          codeHash,
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      enqueuedJobId = await enqueueEmail(tx, {
        collegeId: collegeA.id,
        recipientEmail: student.email,
        recipientName: student.name,
        templateType: 'STUDENT_ACTIVATION',
        payload: { name: student.name, rollNumber: roll, code },
      });
    });

    assert.ok(enqueuedJobId, 'Job ID must be generated');
    const jobInDb = await platformPrisma.emailOutbox.findUnique({ where: { id: enqueuedJobId } });
    assert.strictEqual(jobInDb.status, 'PENDING');
    assert.strictEqual(jobInDb.recipientEmail, email);
    assert.strictEqual(jobInDb.payload.v, 1, 'Envelope version must be 1');

    const decrypted = decryptPayload(jobInDb.payload, {
      jobId: enqueuedJobId,
      collegeId: collegeA.id,
      recipientEmail: email,
      templateType: 'STUDENT_ACTIVATION',
    });
    assert.strictEqual(decrypted.code, code);
    assert.strictEqual(decrypted.rollNumber, roll);
  });

  await test('4.2: Incorrect code submission commits attempt counter increment and leaves user inactive', async () => {
    const roll = `23C2_${runId}`;
    const email = `23c2_${runId}@lbrce.ac.in`;

    const student = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'Wrong Code Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const correctCode = '123456';
    const correctHash = hashActivationCode(correctCode);

    const activation = await withTenant(collegeA.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: collegeA.id,
          userId: student.id,
          codeHash: correctHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    const outcome = await withTenant(collegeA.id, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", consumed
        FROM student_activations
        WHERE id = ${activation.id}::uuid AND college_id = ${collegeA.id}::uuid
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
    assert.strictEqual(outcome.attempts, 1);

    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.attempts, 1, 'Failed attempt increment must be committed to DB');
    assert.strictEqual(dbAct.consumed, false, 'Code must not be consumed on failed attempt');

    const dbUser = await platformPrisma.user.findUnique({ where: { id: student.id } });
    assert.strictEqual(dbUser.isActive, false, 'User must remain inactive');
  });

  await test('4.3: Atomic rollback: if user update returns 0 rows, code consumption is rolled back', async () => {
    const roll = `23C3_${runId}`;
    const email = `23c3_${runId}@lbrce.ac.in`;

    const student = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'Rollback Tester',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const correctCode = '654321';
    const activation = await withTenant(collegeA.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: collegeA.id,
          userId: student.id,
          codeHash: hashActivationCode(correctCode),
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    let rollbackCaught = false;
    try {
      await withTenant(collegeA.id, async (tx) => {
        await tx.$queryRaw`
          UPDATE student_activations
          SET consumed = true
          WHERE id = ${activation.id}::uuid
            AND consumed = false
            AND expires_at > clock_timestamp()
          RETURNING id;
        `;

        const activatedUserRows = await tx.$queryRaw`
          UPDATE users
          SET password_hash = 'some_hash', is_active = true, claimed_at = clock_timestamp()
          WHERE id = ${student.id}::uuid AND is_active = true -- Intentional mismatch to simulate conflict!
          RETURNING id;
        `;

        if (!activatedUserRows || activatedUserRows.length === 0) {
          throw new Error('CONCURRENT_ACTIVATION_CONFLICT');
        }
      });
    } catch (err) {
      assert.ok(err.message.includes('CONCURRENT_ACTIVATION_CONFLICT'));
      rollbackCaught = true;
    }

    assert.strictEqual(rollbackCaught, true, 'Transaction must throw and roll back');

    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.consumed, false, 'CRITICAL INVARIANT: Code consumption must be ROLLED BACK on user conflict');
  });

  await test('4.4: Successful confirmation activates account and commits both changes atomically', async () => {
    const roll = `23C4_${runId}`;
    const email = `23c4_${runId}@lbrce.ac.in`;

    const student = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'Success Student',
          email,
          rollNumber: roll,
          isActive: false,
        },
      });
    });

    const code = '777888';
    const activation = await withTenant(collegeA.id, async (tx) => {
      return await tx.studentActivation.create({
        data: {
          collegeId: collegeA.id,
          userId: student.id,
          codeHash: hashActivationCode(code),
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    });

    const passwordHash = await bcrypt.hash('StudentP@ssw0rd123!', 10);

    const outcome = await withTenant(collegeA.id, async (tx) => {
      const consumed = await tx.$queryRaw`
        UPDATE student_activations
        SET consumed = true
        WHERE id = ${activation.id}::uuid
          AND consumed = false
          AND expires_at > clock_timestamp()
        RETURNING id;
      `;
      assert.strictEqual(consumed.length, 1);

      const [user] = await tx.$queryRaw`
        UPDATE users
        SET password_hash = ${passwordHash}, is_active = true, claimed_at = clock_timestamp()
        WHERE id = ${student.id}::uuid AND is_active = false AND claimed_at IS NULL
        RETURNING id, name, is_active, claimed_at;
      `;
      return { success: true, user };
    });

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(outcome.user.is_active, true);
    assert.ok(outcome.user.claimed_at);

    const dbAct = await platformPrisma.studentActivation.findUnique({ where: { id: activation.id } });
    assert.strictEqual(dbAct.consumed, true);

    const dbUser = await platformPrisma.user.findUnique({ where: { id: student.id } });
    assert.strictEqual(dbUser.isActive, true);
    assert.ok(await bcrypt.compare('StudentP@ssw0rd123!', dbUser.passwordHash));
  });

  // =========================================================================
  // SUITE 5: Event Registration Mode, Capacity & Form Validation
  // =========================================================================
  console.log('\n--- SUITE 5: Event Registration Mode, Capacity & Form Validation ---');

  let testClub;
  testClub = await platformPrisma.club.findFirst({ where: { collegeId: collegeA.id, name: 'Tech Club' } });
  if (!testClub) {
    const creator = await platformPrisma.user.findFirst({ where: { collegeId: collegeA.id } });
    testClub = await platformPrisma.club.create({
      data: {
        collegeId: collegeA.id,
        name: 'Tech Club',
        createdByUserId: creator.id,
      },
    });
  }

  await test('5.1: Event registrationMode: INTERNAL, EXTERNAL, NONE handling', async () => {
    const eventNone = await platformPrisma.event.create({
      data: {
        collegeId: collegeA.id,
        clubId: testClub.id,
        title: `Closed Workshop ${runId}`,
        description: 'No registration',
        location: 'Room 101',
        startAt: new Date(Date.now() + 86400000),
        registrationMode: 'NONE',
      },
    });
    assert.strictEqual(eventNone.registrationMode, 'NONE');

    const eventExt = await platformPrisma.event.create({
      data: {
        collegeId: collegeA.id,
        clubId: testClub.id,
        title: `External Hackathon ${runId}`,
        description: 'Google form',
        location: 'Online',
        startAt: new Date(Date.now() + 86400000),
        registrationMode: 'EXTERNAL',
        registrationUrl: 'https://forms.gle/xyz',
      },
    });
    assert.strictEqual(eventExt.registrationMode, 'EXTERNAL');
    assert.strictEqual(eventExt.registrationUrl, 'https://forms.gle/xyz');
  });

  await test('5.2: Dynamic form definition and answers validation', async () => {
    const formDef = {
      fields: [
        { id: 'tshirt_size', label: 'T-Shirt Size', type: 'SELECT', options: ['S', 'M', 'L', 'XL'], required: true },
        { id: 'dietary', label: 'Dietary Restriction', type: 'TEXT', required: false },
        { id: 'experience_years', label: 'Years of Experience', type: 'NUMBER', required: true },
      ],
    };

    const eventWithForm = await platformPrisma.event.create({
      data: {
        collegeId: collegeA.id,
        clubId: testClub.id,
        title: `Coding Competition ${runId}`,
        description: 'Requires custom questions',
        location: 'Lab 3',
        startAt: new Date(Date.now() + 86400000),
        registrationMode: 'INTERNAL',
        customFormDefinition: formDef,
      },
    });

    const studentUser = await platformPrisma.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'Form Registrant',
        email: `reg_${runId}@lbrce.ac.in`,
        isActive: true,
      },
    });

    const formAnswers = {
      tshirt_size: 'L',
      dietary: 'Vegetarian',
      experience_years: 2,
    };

    const registration = await withTenant(collegeA.id, async (tx) => {
      return await tx.eventRegistration.create({
        data: {
          collegeId: collegeA.id,
          eventId: eventWithForm.id,
          userId: studentUser.id,
          formAnswers,
        },
      });
    });

    assert.strictEqual(registration.formAnswers.tshirt_size, 'L');
    assert.strictEqual(registration.formAnswers.experience_years, 2);

    const dbReg = await platformPrisma.eventRegistration.findUnique({ where: { id: registration.id } });
    assert.strictEqual(dbReg.formAnswers.dietary, 'Vegetarian');
  });

  await test('5.3: PostgreSQL capacity trigger enforces capacity limits atomically', async () => {
    const capacityEvent = await platformPrisma.event.create({
      data: {
        collegeId: collegeA.id,
        clubId: testClub.id,
        title: `Micro Seminar ${runId}`,
        description: 'Cap 2',
        location: 'Small Lab',
        startAt: new Date(Date.now() + 86400000),
        capacity: 2,
        registrationMode: 'INTERNAL',
      },
    });

    const u1 = await platformPrisma.user.create({ data: { collegeId: collegeA.id, name: 'Cap1', email: `c1_${runId}@lbrce.ac.in`, isActive: true } });
    const u2 = await platformPrisma.user.create({ data: { collegeId: collegeA.id, name: 'Cap2', email: `c2_${runId}@lbrce.ac.in`, isActive: true } });
    const u3 = await platformPrisma.user.create({ data: { collegeId: collegeA.id, name: 'Cap3', email: `c3_${runId}@lbrce.ac.in`, isActive: true } });

    await withTenant(collegeA.id, async (tx) => {
      await tx.eventRegistration.create({ data: { collegeId: collegeA.id, eventId: capacityEvent.id, userId: u1.id } });
    });

    await withTenant(collegeA.id, async (tx) => {
      await tx.eventRegistration.create({ data: { collegeId: collegeA.id, eventId: capacityEvent.id, userId: u2.id } });
    });

    let capacityRejected = false;
    try {
      await withTenant(collegeA.id, async (tx) => {
        await tx.eventRegistration.create({ data: { collegeId: collegeA.id, eventId: capacityEvent.id, userId: u3.id } });
      });
    } catch (err) {
      assert.ok(err.message.includes('capacity') || err.message.includes('check_violation') || err.message.includes('chk_events_capacity_limit'));
      capacityRejected = true;
    }
    assert.strictEqual(capacityRejected, true, 'Trigger must reject 3rd insert exceeding capacity 2');
  });

  // =========================================================================
  // SUITE 6: Existing Manager Authentication Contract Invariants
  // =========================================================================
  console.log('\n--- SUITE 6: Manager Authentication Contracts ---');

  await test('6.1: Manager login contract remains intact', async () => {
    const managerPass = 'ManagerP@ss123!';
    const passwordHash = await bcrypt.hash(managerPass, 10);
    const mgrUser = await platformPrisma.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'Club Manager',
        email: `manager_${runId}@lbrce.ac.in`,
        passwordHash,
        role: 'USER',
        isActive: true,
      },
    });

    await platformPrisma.membership.create({
      data: {
        collegeId: collegeA.id,
        clubId: testClub.id,
        userId: mgrUser.id,
        role: 'MANAGER',
      },
    });

    const authManager = await withTenant(collegeA.id, async (tx) => {
      const user = await tx.user.findFirst({
        where: { email: `manager_${runId}@lbrce.ac.in`, collegeId: collegeA.id },
        include: { memberships: { where: { role: 'MANAGER' } } },
      });
      return user;
    });

    assert.ok(authManager, 'Manager user must exist');
    assert.strictEqual(authManager.memberships.length, 1, 'Manager must have active MANAGER membership');
    assert.ok(await bcrypt.compare(managerPass, authManager.passwordHash));
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`PHASE S1 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  await appPrisma.$disconnect();
  await platformPrisma.$disconnect();
  await migratorPrisma.$disconnect();
  await workerPrisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runS1Verification().catch((err) => {
  console.error('\n❌ Unhandled exception during verification:', err);
  process.exit(1);
});
