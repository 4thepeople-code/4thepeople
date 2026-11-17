/**
 * Phase 3 — Cross-College Registration & External Participant Identity
 * Test Suite A: Cross-college student registration
 *
 * Tests:
 *   1. Cross-college student can register for a PUBLIC INTERNAL event at another college.
 *   2. Home college (homeCollegeId) is preserved correctly on the registration row.
 *   3. Snapshot identity fields populated from home-college user record.
 *   4. Second registration for same student+event → P2002 unique constraint violation.
 *   5. Cross-college registration for COLLEGE-visibility event → 403 at application layer.
 *   6. Event at capacity → trigger raises exception → maps to capacity error.
 *   7. trg_user_pre_delete: nullifies user_id on cross-college registration, snapshot intact.
 *   8. registered_count incremented on INSERT, decremented on DELETE.
 *   9. Same-college student registration (regression) still works correctly.
 *  10. College B admin cannot view College A's event attendees.
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
  console.error('Refusing to run tests or fallback to DATABASE_URL.');
  process.exit(1);
}

const assert = require('assert');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { withTenant } = require('../config/db');

const appPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_APP_URL } } });
const platformPrisma = new PrismaClient({ datasources: { db: { url: LOCAL_PLATFORM_URL } } });

const runId = crypto.randomBytes(4).toString('hex');

async function runCrossCollegeTests() {
  console.log('======================================================================');
  console.log('PHASE 3A — CROSS-COLLEGE REGISTRATION TEST SUITE');
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
  const collegeB = await platformPrisma.college.findFirst({
    where: { NOT: { slug: 'lbrce' } },
    select: { id: true, name: true, slug: true },
  });

  if (!collegeA || !collegeB) {
    console.error('FATAL: Need at least two active colleges in yuva_test. Aborting.');
    await appPrisma.$disconnect();
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  console.log(`  College A (host): ${collegeA.slug} (${collegeA.id})`);
  console.log(`  College B (student home): ${collegeB.slug} (${collegeB.id})\n`);

  // Ensure an admin user exists in College A to own the test club
  let adminA = await platformPrisma.user.findFirst({
    where: { collegeId: collegeA.id },
    select: { id: true },
  });
  if (!adminA) {
    adminA = await platformPrisma.user.create({
      data: {
        collegeId: collegeA.id,
        name: `Phase3A Admin ${runId}`,
        email: `p3admin_${runId}@lbrce.ac.in`,
        isActive: true,
      },
      select: { id: true },
    });
  }

  // Create test club in College A
  const clubA = await platformPrisma.club.create({
    data: {
      collegeId: collegeA.id,
      name: `Phase3A TestClub ${runId}`,
      description: 'Phase 3 test club',
      createdByUserId: adminA.id,
    },
    select: { id: true },
  });

  // Create a PUBLIC INTERNAL event in College A
  const publicEvent = await platformPrisma.event.create({
    data: {
      collegeId: collegeA.id,
      clubId: clubA.id,
      title: `Phase3A Public Event ${runId}`,
      description: 'Cross-college test event',
      location: 'Seminar Hall',
      startAt: new Date(Date.now() + 86400000),
      capacity: 10,
      registrationMode: 'INTERNAL',
      visibility: 'PUBLIC',
    },
  });

  // Create a COLLEGE-visibility event in College A
  const privateEvent = await platformPrisma.event.create({
    data: {
      collegeId: collegeA.id,
      clubId: clubA.id,
      title: `Phase3A College Event ${runId}`,
      description: 'College-only test event',
      location: 'Lecture Hall',
      startAt: new Date(Date.now() + 86400000),
      registrationMode: 'INTERNAL',
      visibility: 'COLLEGE',
    },
  });

  // Create a student in College B
  const studentB = await platformPrisma.user.create({
    data: {
      collegeId: collegeB.id,
      name: `Phase3A Student ${runId}`,
      email: `p3student_${runId}@student.local`,
      rollNumber: `P3A${runId.toUpperCase()}`,
      isActive: true,
    },
  });

  // Create a student in College A (same-college regression)
  const studentA = await platformPrisma.user.create({
    data: {
      collegeId: collegeA.id,
      name: `Phase3A StudentA ${runId}`,
      email: `p3studenta_${runId}@student.local`,
      rollNumber: `P3AA${runId.toUpperCase()}`,
      isActive: true,
    },
  });

  // Create dedicated fixture for genuine middleware+controller pipeline verification
  const publicEventForPipeline = await platformPrisma.event.create({
    data: {
      collegeId: collegeA.id,
      clubId: clubA.id,
      title: `Phase3A Pipeline Event ${runId}`,
      description: 'Pipeline cross-college test event',
      location: 'Auditorium',
      startAt: new Date(Date.now() + 86400000),
      capacity: 10,
      registrationMode: 'INTERNAL',
      visibility: 'PUBLIC',
    },
  });

  const studentB2 = await platformPrisma.user.create({
    data: {
      collegeId: collegeB.id,
      name: `Pipeline Student B2 ${runId}`,
      email: `p3student_b2_${runId}@student.local`,
      rollNumber: `P3AB2${runId.toUpperCase()}`,
      isActive: true,
    },
  });

  // ─── Tests ────────────────────────────────────────────────────────────────

  await test('1. Cross-college student creates registration with correct collegeId and homeCollegeId', async () => {
    const reg = await withTenant(collegeA.id, async (tx) => {
      return tx.eventRegistration.create({
        data: {
          collegeId: collegeA.id,
          eventId: publicEvent.id,
          userId: studentB.id,
          participantType: 'STUDENT',
          homeCollegeId: collegeB.id,
          participantName: studentB.name,
          participantEmail: studentB.email,
          participantRollNumber: studentB.rollNumber,
          participantCollegeName: collegeB.name,
          isUserDeleted: false,
          registeredByRole: 'SELF',
        },
      });
    });

    assert.strictEqual(reg.collegeId, collegeA.id, 'Registration college_id must be host college (A)');
    assert.strictEqual(reg.homeCollegeId, collegeB.id, 'home_college_id must be student home college (B)');
    assert.strictEqual(reg.participantType, 'STUDENT');
    assert.strictEqual(reg.userId, studentB.id);
  });

  await test('2. Snapshot fields are correct on the cross-college registration', async () => {
    const reg = await withTenant(collegeA.id, async (tx) => {
      return tx.eventRegistration.findFirst({
        where: { eventId: publicEvent.id, userId: studentB.id, collegeId: collegeA.id },
      });
    });

    assert.ok(reg, 'Registration row must exist');
    assert.strictEqual(reg.participantName, studentB.name);
    assert.strictEqual(reg.participantEmail, studentB.email);
    assert.strictEqual(reg.participantRollNumber, studentB.rollNumber);
    assert.strictEqual(reg.participantCollegeName, collegeB.name);
    assert.strictEqual(reg.isUserDeleted, false);
  });

  await test('3. Second registration for same student+event hits unique constraint (P2002)', async () => {
    let caughtDuplicate = false;
    try {
      await withTenant(collegeA.id, async (tx) => {
        await tx.eventRegistration.create({
          data: {
            collegeId: collegeA.id,
            eventId: publicEvent.id,
            userId: studentB.id,
            participantType: 'STUDENT',
            homeCollegeId: collegeB.id,
            participantName: studentB.name,
            participantEmail: studentB.email,
            participantRollNumber: studentB.rollNumber,
            participantCollegeName: collegeB.name,
            isUserDeleted: false,
            registeredByRole: 'SELF',
          },
        });
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('uq_event_registrations_user_event')) {
        caughtDuplicate = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(caughtDuplicate, true, 'Must throw P2002 for duplicate registration');
  });

  await test('4. registered_count incremented by trigger on INSERT', async () => {
    const ev = await platformPrisma.event.findUnique({
      where: { id: publicEvent.id },
      select: { registeredCount: true },
    });
    assert.strictEqual(ev.registeredCount, 1, 'registered_count must be 1 after one registration');
  });

  function callHandler(handler, req) {
    return new Promise((resolve, reject) => {
      let statusCode = 200;
      const res = {
        status(code) { statusCode = code; return this; },
        json(data) { resolve({ statusCode, body: data }); return this; },
      };
      const next = (err) => {
        if (err) reject(err);
        else resolve({ statusCode, body: null });
      };
      Promise.resolve(handler(req, res, next)).catch(next);
    });
  }

  await test('4b. getMyRegistrationStatus: cross-college student sees own registration for public event', async () => {
    const { getMyRegistrationStatus } = require('../controllers/registrationController');
    const req = {
      collegeId: collegeA.id,
      user: { id: studentB.id },
      isCrossCollege: true,
      params: { eventId: publicEvent.id },
    };
    const result = await callHandler(getMyRegistrationStatus, req);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.isRegistered, true);
    assert.strictEqual(result.body.registration.userId, studentB.id);
  });

  await test('4c. getMyRegistrationStatus: cross-college student blocked from querying private event (403)', async () => {
    const { getMyRegistrationStatus } = require('../controllers/registrationController');
    const req = {
      collegeId: collegeA.id,
      user: { id: studentB.id },
      isCrossCollege: true,
      params: { eventId: privateEvent.id },
    };
    let caught403 = false;
    try {
      await callHandler(getMyRegistrationStatus, req);
    } catch (err) {
      if (err.statusCode === 403 || (err.message && err.message.includes('only available for public events'))) {
        caught403 = true;
      }
    }
    assert.strictEqual(caught403, true, 'Must return 403 when cross-college student queries private event status');
  });

  await test('4d. getMyRegistrationStatus: unregistered student receives isRegistered: false', async () => {
    const { getMyRegistrationStatus } = require('../controllers/registrationController');
    const req = {
      collegeId: collegeA.id,
      user: { id: studentA.id },
      isCrossCollege: false,
      params: { eventId: publicEvent.id },
    };
    const result = await callHandler(getMyRegistrationStatus, req);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.isRegistered, false);
    assert.strictEqual(result.body.registration, null);
  });

  await test('5. Same-college student can register (regression)', async () => {
    await withTenant(collegeA.id, async (tx) => {
      await tx.eventRegistration.create({
        data: {
          collegeId: collegeA.id,
          eventId: publicEvent.id,
          userId: studentA.id,
          participantType: 'STUDENT',
          homeCollegeId: collegeA.id,
          participantName: studentA.name,
          participantEmail: studentA.email,
          participantRollNumber: studentA.rollNumber,
          participantCollegeName: collegeA.name,
          isUserDeleted: false,
          registeredByRole: 'SELF',
        },
      });
    });
    const ev = await platformPrisma.event.findUnique({
      where: { id: publicEvent.id },
      select: { registeredCount: true },
    });
    assert.strictEqual(ev.registeredCount, 2, 'registered_count must be 2 after second registration');
  });

  await test('6. registered_count decremented on DELETE (cancellation)', async () => {
    await withTenant(collegeA.id, async (tx) => {
      const reg = await tx.eventRegistration.findFirst({
        where: { eventId: publicEvent.id, userId: studentA.id, collegeId: collegeA.id },
      });
      await tx.eventRegistration.delete({ where: { id: reg.id } });
    });
    const ev = await platformPrisma.event.findUnique({
      where: { id: publicEvent.id },
      select: { registeredCount: true },
    });
    assert.strictEqual(ev.registeredCount, 1, 'registered_count must be 1 after cancellation');
  });

  await test('7. trg_user_pre_delete: nullifies user_id, sets is_user_deleted=true, snapshot intact', async () => {
    // Delete the student from College B
    await platformPrisma.user.delete({ where: { id: studentB.id } });

    // Verify cross-college registration survived with snapshot preserved
    const reg = await platformPrisma.eventRegistration.findFirst({
      where: { eventId: publicEvent.id, collegeId: collegeA.id, isUserDeleted: true },
    });
    assert.ok(reg, 'Registration must survive student deletion');
    assert.strictEqual(reg.userId, null, 'user_id must be nullified');
    assert.strictEqual(reg.isUserDeleted, true);
    // Snapshot fields must be intact
    assert.ok(reg.participantName, 'participantName must remain after deletion');
    assert.ok(reg.participantEmail, 'participantEmail must remain after deletion');
    assert.strictEqual(reg.homeCollegeId, collegeB.id, 'homeCollegeId must remain after deletion');
  });

  await test('8. College A RLS: College B app context cannot read College A registrations', async () => {
    // Using College B's tenant context — RLS must prevent reading College A's registrations
    const regs = await withTenant(collegeB.id, async (tx) => {
      return tx.eventRegistration.findMany({
        where: { eventId: publicEvent.id },
      });
    });
    assert.strictEqual(regs.length, 0, 'RLS must prevent College B from reading College A registrations');
  });

  await test('9. uq_event_registrations_external_event unique constraint exists', async () => {
    // Verify the constraint was created by migration 006
    const [result] = await platformPrisma.$queryRaw`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'event_registrations'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'uq_event_registrations_external_event';
    `;
    assert.ok(result, 'uq_event_registrations_external_event unique constraint must exist');
  });

  await test('10. external_participants RLS is enabled', async () => {
    const [result] = await platformPrisma.$queryRaw`
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'external_participants';
    `;
    assert.strictEqual(result.relrowsecurity, true, 'RLS must be enabled on external_participants');
  });

  await test('11. external_auth_otps has college_id column and RLS enabled', async () => {
    const [colResult] = await appPrisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'external_auth_otps'
        AND column_name = 'college_id';
    `;
    assert.ok(colResult, 'college_id column must exist on external_auth_otps');

    const [rlsResult] = await platformPrisma.$queryRaw`
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'external_auth_otps';
    `;
    assert.strictEqual(rlsResult.relrowsecurity, true, 'RLS must be enabled on external_auth_otps');
  });

  const jwt = require('jsonwebtoken');
  const { crossCollegeRegisterMiddleware } = require('../middleware/authMiddleware');
  const { registerForEvent, getMyRegistrationStatus } = require('../controllers/registrationController');

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';
  const studentB2Token = jwt.sign(
    {
      id: studentB2.id,
      userId: studentB2.id,
      email: studentB2.email,
      role: 'USER',
      collegeId: collegeB.id,
      type: 'college',
    },
    jwtSecret,
    { expiresIn: '1h' }
  );

  function runMiddlewarePipeline(middlewares, req) {
    return new Promise((resolve, reject) => {
      let statusCode = 200;
      const res = {
        status(code) { statusCode = code; return this; },
        json(data) { resolve({ statusCode, body: data }); return this; },
      };
      let i = 0;
      function next(err) {
        if (err) return reject(err);
        if (i >= middlewares.length) return resolve({ statusCode, body: null });
        const mw = middlewares[i++];
        try {
          Promise.resolve(mw(req, res, next)).catch(next);
        } catch (e) {
          next(e);
        }
      }
      next();
    });
  }

  await test('12. Genuine pipeline: crossCollegeRegisterMiddleware + registerForEvent allows cross-college registration for PUBLIC event', async () => {
    const req = {
      collegeId: collegeA.id, // Host college URL context
      headers: { authorization: `Bearer ${studentB2Token}` },
      params: { eventId: publicEventForPipeline.id },
      body: {},
    };
    const result = await runMiddlewarePipeline([crossCollegeRegisterMiddleware, registerForEvent], req);
    assert.strictEqual(result.statusCode, 201);
    assert.strictEqual(req.isCrossCollege, true, 'Middleware must automatically compute isCrossCollege = true without client hint');
    assert.strictEqual(req.homeCollegeId, collegeB.id, 'Middleware must preserve student homeCollegeId');
    assert.strictEqual(result.body.registration.userId, studentB2.id, 'Registration must be created for student B2');

    const savedReg = await platformPrisma.eventRegistration.findUnique({
      where: { id: result.body.registration.id },
      select: { collegeId: true, homeCollegeId: true, participantType: true },
    });
    assert.strictEqual(savedReg.collegeId, collegeA.id, 'Registration must be assigned to host college');
    assert.strictEqual(savedReg.homeCollegeId, collegeB.id, 'Registration must record student home college');
    assert.strictEqual(savedReg.participantType, 'STUDENT', 'Participant type must be STUDENT');
  });

  await test('13. Tenant URL mismatch: Student B attempting to access/register for College A event through College B tenant URL is rejected (404)', async () => {
    const req = {
      collegeId: collegeB.id, // College B URL context
      headers: { authorization: `Bearer ${studentB2Token}` },
      params: { eventId: publicEventForPipeline.id }, // Belongs to College A
      body: {},
    };
    let caughtErr = null;
    try {
      await runMiddlewarePipeline([crossCollegeRegisterMiddleware, registerForEvent], req);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Should reject when event does not belong to the URL college context');
    assert.strictEqual(caughtErr.statusCode, 404, 'Must return 404 Event not found, proving host college is authoritative');
    assert.strictEqual(req.isCrossCollege, false, 'Middleware computes isCrossCollege = false because home === URL college');
  });

  await test('14. Tenant URL mismatch on status: Student B cannot query College A event through College B tenant URL (404)', async () => {
    const req = {
      collegeId: collegeB.id, // College B URL context
      headers: { authorization: `Bearer ${studentB2Token}` },
      params: { eventId: publicEventForPipeline.id }, // College A event
    };
    let caughtErr = null;
    try {
      await runMiddlewarePipeline([crossCollegeRegisterMiddleware, getMyRegistrationStatus], req);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Should reject status query when event is not owned by the URL college context');
    assert.strictEqual(caughtErr.statusCode, 404);
  });

  await test('15. Genuine pipeline: cross-college student blocked from registering for PRIVATE event via Host College URL (403)', async () => {
    const req = {
      collegeId: collegeA.id, // Host college URL context
      headers: { authorization: `Bearer ${studentB2Token}` },
      params: { eventId: privateEvent.id }, // PRIVATE / COLLEGE event
      body: {},
    };
    let caughtErr = null;
    try {
      await runMiddlewarePipeline([crossCollegeRegisterMiddleware, registerForEvent], req);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Should throw 403 error for private event');
    assert.strictEqual(caughtErr.statusCode, 403, 'Must return 403 Forbidden for cross-college registration on private event');
    assert.strictEqual(req.isCrossCollege, true);
  });

  const { createEvent, updateEvent } = require('../controllers/eventController');

  await test('16. createEvent defaults visibility to COLLEGE and supports explicit PUBLIC', async () => {
    // 1. Create with omitted visibility
    const req1 = {
      collegeId: collegeA.id,
      params: { clubId: clubA.id },
      body: {
        title: `Default Visibility Event ${runId}`,
        description: 'Testing default visibility assignment',
        location: 'Hall 1',
        startAt: new Date(Date.now() + 86400000).toISOString(),
      },
    };
    const res1 = await runMiddlewarePipeline([createEvent], req1);
    assert.strictEqual(res1.statusCode, 201);
    assert.strictEqual(res1.body.event.visibility, 'COLLEGE');

    // 2. Create with explicit PUBLIC
    const req2 = {
      collegeId: collegeA.id,
      params: { clubId: clubA.id },
      body: {
        title: `Explicit Public Event ${runId}`,
        description: 'Testing explicit public visibility assignment',
        location: 'Main Amphitheater',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        visibility: 'PUBLIC',
      },
    };
    const res2 = await runMiddlewarePipeline([createEvent], req2);
    assert.strictEqual(res2.statusCode, 201);
    assert.strictEqual(res2.body.event.visibility, 'PUBLIC');
  });

  await test('17. updateEvent updates visibility, preserves on partial update, and retains existing registrations', async () => {
    // Create an event as COLLEGE
    const eventCreated = await withTenant(collegeA.id, async (tx) => {
      return tx.event.create({
        data: {
          collegeId: collegeA.id,
          clubId: clubA.id,
          title: `Visibility Lifecycle Event ${runId}`,
          description: 'Lifecycle visibility testing',
          location: 'Seminar Room',
          startAt: new Date(Date.now() + 86400000),
          visibility: 'COLLEGE',
        },
      });
    });

    // 1. Switch COLLEGE -> PUBLIC
    const reqUpdatePub = {
      collegeId: collegeA.id,
      params: { clubId: clubA.id, eventId: eventCreated.id },
      body: { visibility: 'PUBLIC' },
    };
    const resUpdatePub = await runMiddlewarePipeline([updateEvent], reqUpdatePub);
    assert.strictEqual(resUpdatePub.statusCode, 200);
    assert.strictEqual(resUpdatePub.body.event.visibility, 'PUBLIC');

    // Register a student to verify registrations are not deleted on subsequent visibility change
    const reg = await withTenant(collegeA.id, async (tx) => {
      return tx.eventRegistration.create({
        data: {
          collegeId: collegeA.id,
          eventId: eventCreated.id,
          userId: studentA.id,
          participantType: 'STUDENT',
          participantName: studentA.name,
          participantEmail: studentA.email,
        },
      });
    });
    assert.ok(reg.id, 'Registration should be created');

    // 2. Partial update without visibility preserves PUBLIC
    const reqPartial = {
      collegeId: collegeA.id,
      params: { clubId: clubA.id, eventId: eventCreated.id },
      body: { description: 'Updated description without touching visibility' },
    };
    const resPartial = await runMiddlewarePipeline([updateEvent], reqPartial);
    assert.strictEqual(resPartial.statusCode, 200);
    assert.strictEqual(resPartial.body.event.visibility, 'PUBLIC');
    assert.strictEqual(resPartial.body.event.description, 'Updated description without touching visibility');

    // 3. Switch PUBLIC -> COLLEGE
    const reqUpdateCol = {
      collegeId: collegeA.id,
      params: { clubId: clubA.id, eventId: eventCreated.id },
      body: { visibility: 'COLLEGE' },
    };
    const resUpdateCol = await runMiddlewarePipeline([updateEvent], reqUpdateCol);
    assert.strictEqual(resUpdateCol.statusCode, 200);
    assert.strictEqual(resUpdateCol.body.event.visibility, 'COLLEGE');

    // 4. Verify existing registration is NOT deleted
    const regStillExists = await withTenant(collegeA.id, async (tx) => {
      return tx.eventRegistration.findUnique({
        where: { id: reg.id },
      });
    });
    assert.ok(regStillExists, 'Existing registration must NOT be deleted when visibility changes');
  });

  await test('18. updateEvent rejects invalid visibility enum values (400)', async () => {
    let caughtErr = null;
    try {
      const reqInvalid = {
        collegeId: collegeA.id,
        params: { clubId: clubA.id, eventId: publicEventForPipeline.id },
        body: { visibility: 'COLLEGE_RESTRICTED' },
      };
      await runMiddlewarePipeline([updateEvent], reqInvalid);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Should throw error for invalid visibility enum value');
    assert.strictEqual(caughtErr.statusCode, 400);
  });

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Phase 3A Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  await appPrisma.$disconnect();
  await platformPrisma.$disconnect();

  if (failed > 0) process.exit(1);
}

runCrossCollegeTests().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
