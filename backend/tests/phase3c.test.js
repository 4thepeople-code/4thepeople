process.env.NODE_ENV = 'development';

// Strict requirement: TEST_DATABASE_URL and TEST_PLATFORM_DATABASE_URL must be explicitly provided.
if (!process.env.TEST_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_DATABASE_URL environment variable is required to run Phase 3c tests.');
  console.error('Refusing to run tests or fallback to DATABASE_URL.\n');
  process.exit(1);
}

if (!process.env.TEST_PLATFORM_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_PLATFORM_DATABASE_URL environment variable is required to run Phase 3c tests.');
  console.error('Refusing to run tests or fallback to PLATFORM_DATABASE_URL.\n');
  process.exit(1);
}

let testDbUrl = process.env.TEST_DATABASE_URL;
if (process.env.TEST_CONNECTION_LIMIT) {
  try {
    const parsed = new URL(testDbUrl);
    parsed.searchParams.set('connection_limit', process.env.TEST_CONNECTION_LIMIT);
    testDbUrl = parsed.toString();
  } catch {
    const sep = testDbUrl.includes('?') ? '&' : '?';
    testDbUrl = `${testDbUrl}${sep}connection_limit=${process.env.TEST_CONNECTION_LIMIT}`;
  }
}
process.env.DATABASE_URL = testDbUrl;
process.env.PLATFORM_DATABASE_URL = process.env.TEST_PLATFORM_DATABASE_URL;

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_phase3c_super_secure_key_123';
}

const proxySecret = process.env.PROXY_SHARED_SECRET || 'test_shared_proxy_secret_for_local_development_only';
process.env.PROXY_SHARED_SECRET = proxySecret;

const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');
const app = require('../index');

// Exact fixture email registry
const FIXTURE_EMAILS = {
  ADMIN_LBRCE: 'admin_lbrce_p3c@example.test',
  MANAGER_A1: 'manager_a1_p3c@example.test',
  MANAGER_A2: 'manager_a2_p3c@example.test',
  USER_A1: 'user_a1_p3c@example.test',
  USER_A2: 'user_a2_p3c@example.test',
  USER_A3: 'user_a3_p3c@example.test',
  ADMIN_VRSEC: 'admin_vrsec_p3c@example.test',
  MANAGER_B1: 'manager_b1_p3c@example.test',
  USER_B1: 'user_b1_p3c@example.test',
};

// Tracked exact IDs for Phase 3c cleanup
const trackedUserIdsA = [];
const trackedClubIdsA = [];
const trackedEventIdsA = [];
const trackedRegistrationIdsA = [];
const trackedMembershipIdsA = [];

const trackedUserIdsB = [];
const trackedClubIdsB = [];
const trackedEventIdsB = [];
const trackedRegistrationIdsB = [];
const trackedMembershipIdsB = [];

// Pre-registered list of exact fixture emails for safe fallback
const exactFixtureEmailsA = [
  FIXTURE_EMAILS.ADMIN_LBRCE,
  FIXTURE_EMAILS.MANAGER_A1,
  FIXTURE_EMAILS.MANAGER_A2,
  FIXTURE_EMAILS.USER_A1,
  FIXTURE_EMAILS.USER_A2,
  FIXTURE_EMAILS.USER_A3,
];
for (let i = 1; i <= 35; i++) {
  exactFixtureEmailsA.push(`burst_p3c_${i}@example.test`);
}

const exactFixtureEmailsB = [
  FIXTURE_EMAILS.ADMIN_VRSEC,
  FIXTURE_EMAILS.MANAGER_B1,
  FIXTURE_EMAILS.USER_B1,
];

async function cleanupFixtures(collegeA, collegeB) {
  if (collegeA && collegeA.id) {
    await withTenant(collegeA.id, async (tx) => {
      // 1. Delete registrations
      await tx.eventRegistration.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { id: { in: trackedRegistrationIdsA } },
            { user: { email: { in: exactFixtureEmailsA } } },
            { event: { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_LBRCE } } } },
          ],
        },
      });

      // 2. Delete gallery images and events
      await tx.eventGalleryImage.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { eventId: { in: trackedEventIdsA } },
            { event: { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_LBRCE } } } },
          ],
        },
      });
      await tx.event.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { id: { in: trackedEventIdsA } },
            { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_LBRCE } } },
          ],
        },
      });

      // 3. Delete memberships
      await tx.membership.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { id: { in: trackedMembershipIdsA } },
            { user: { email: { in: exactFixtureEmailsA } } },
            { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_LBRCE } } },
          ],
        },
      });

      // 4. Delete clubs
      await tx.club.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { id: { in: trackedClubIdsA } },
            { createdBy: { email: FIXTURE_EMAILS.ADMIN_LBRCE } },
          ],
        },
      });

      // 5. Delete users
      await tx.user.deleteMany({
        where: {
          collegeId: collegeA.id,
          OR: [
            { id: { in: trackedUserIdsA } },
            { email: { in: exactFixtureEmailsA } },
          ],
        },
      });
    });
  }

  if (collegeB && collegeB.id) {
    await withTenant(collegeB.id, async (tx) => {
      await tx.eventRegistration.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { id: { in: trackedRegistrationIdsB } },
            { user: { email: { in: exactFixtureEmailsB } } },
            { event: { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_VRSEC } } } },
          ],
        },
      });

      await tx.eventGalleryImage.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { eventId: { in: trackedEventIdsB } },
            { event: { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_VRSEC } } } },
          ],
        },
      });
      await tx.event.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { id: { in: trackedEventIdsB } },
            { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_VRSEC } } },
          ],
        },
      });

      await tx.membership.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { id: { in: trackedMembershipIdsB } },
            { user: { email: { in: exactFixtureEmailsB } } },
            { club: { createdBy: { email: FIXTURE_EMAILS.ADMIN_VRSEC } } },
          ],
        },
      });

      await tx.club.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { id: { in: trackedClubIdsB } },
            { createdBy: { email: FIXTURE_EMAILS.ADMIN_VRSEC } },
          ],
        },
      });

      await tx.user.deleteMany({
        where: {
          collegeId: collegeB.id,
          OR: [
            { id: { in: trackedUserIdsB } },
            { email: { in: exactFixtureEmailsB } },
          ],
        },
      });
    });
  }
}

async function runPhase3cTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 3C: EVENT REGISTRATIONS & CAPACITY TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 0. Database Safety Guard & DB Role Privileges Check
  // -------------------------------------------------------------------------
  console.log('\n[TEST 0] Verifying database safety guard and DB role privileges...');
  const [dbMeta] = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log(`  Current Database : ${dbMeta.current_database}`);
  console.log(`  Current User     : ${dbMeta.current_user}`);

  let endpointType = 'Direct';
  try {
    const parsedUrl = new URL(process.env.TEST_DATABASE_URL);
    const host = parsedUrl.hostname.toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost') {
      endpointType = 'Local';
    } else if (host.includes('-pooler')) {
      endpointType = 'Pooler';
    } else {
      endpointType = 'Direct';
    }
  } catch {
    const raw = process.env.TEST_DATABASE_URL || '';
    if (raw.includes('127.0.0.1') || raw.includes('localhost')) {
      endpointType = 'Local';
    } else if (raw.includes('-pooler')) {
      endpointType = 'Pooler';
    } else {
      endpointType = 'Direct';
    }
  }
  console.log(`  Endpoint Type    : ${endpointType}`);

  assert.strictEqual(
    dbMeta.current_database,
    'yuva_test',
    `FAIL: Safety guard: tests must run strictly against "yuva_test", got "${dbMeta.current_database}"`
  );
  assert.strictEqual(
    dbMeta.current_user,
    'app_user',
    `FAIL: Expected current_user to be "app_user", got "${dbMeta.current_user}"`
  );

  const [rolePriv] = await prisma.$queryRaw`
    SELECT rolname, rolsuper, rolbypassrls 
    FROM pg_roles 
    WHERE rolname = current_user;
  `;
  assert.strictEqual(rolePriv.rolbypassrls, false, 'FAIL: app_user role MUST have rolbypassrls=false');
  console.log('  ✔ Database safety guard passed (yuva_test, app_user NOBYPASSRLS).');

  // -------------------------------------------------------------------------
  // Setup: Resolve colleges and start ephemeral server
  // -------------------------------------------------------------------------
  console.log('\n[SETUP] Preparing Phase 3c test fixtures in College A (lbrce) and College B (vrsec)...');
  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');
  assert(collegeA && collegeA.id, 'College A (lbrce) not found in test database');
  assert(collegeB && collegeB.id, 'College B (vrsec) not found in test database');

  await cleanupFixtures(collegeA, collegeB);

  let server;
  let baseUrl;
  let adminUserA, managerUserA1, managerUserA2, userA1, userA2, userA3;
  let adminUserB, managerUserB1, userB1;
  let clubA1, clubA2, clubB1;
  let tokenAdminA, tokenManagerA1, tokenManagerA2, tokenUserA1, tokenUserA2, tokenUserA3;
  let tokenAdminB, tokenManagerB1, tokenUserB1;

  try {
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Create fixtures in College A
    await withTenant(collegeA.id, async (tx) => {
      adminUserA = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C Admin A',
          email: FIXTURE_EMAILS.ADMIN_LBRCE,
          passwordHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });
      trackedUserIdsA.push(adminUserA.id);

      managerUserA1 = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C Manager A1',
          email: FIXTURE_EMAILS.MANAGER_A1,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsA.push(managerUserA1.id);

      managerUserA2 = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C Manager A2',
          email: FIXTURE_EMAILS.MANAGER_A2,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsA.push(managerUserA2.id);

      userA1 = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C User A1',
          email: FIXTURE_EMAILS.USER_A1,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsA.push(userA1.id);

      userA2 = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C User A2',
          email: FIXTURE_EMAILS.USER_A2,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsA.push(userA2.id);

      userA3 = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C User A3',
          email: FIXTURE_EMAILS.USER_A3,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsA.push(userA3.id);

      clubA1 = await tx.club.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C Robotics Club A1',
          description: 'Robotics Club in College A',
          clubType: 'DEPARTMENTAL',
          createdByUserId: adminUserA.id,
        },
      });
      trackedClubIdsA.push(clubA1.id);

      clubA2 = await tx.club.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3C Music Club A2',
          description: 'Music Club in College A',
          clubType: 'CENTRAL',
          createdByUserId: adminUserA.id,
        },
      });
      trackedClubIdsA.push(clubA2.id);

      const mem1 = await tx.membership.create({
        data: {
          collegeId: collegeA.id,
          userId: managerUserA1.id,
          clubId: clubA1.id,
          role: 'MANAGER',
        },
      });
      trackedMembershipIdsA.push(mem1.id);

      const mem2 = await tx.membership.create({
        data: {
          collegeId: collegeA.id,
          userId: managerUserA2.id,
          clubId: clubA2.id,
          role: 'MANAGER',
        },
      });
      trackedMembershipIdsA.push(mem2.id);
    });

    // 2. Create fixtures in College B
    await withTenant(collegeB.id, async (tx) => {
      adminUserB = await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3C Admin B',
          email: FIXTURE_EMAILS.ADMIN_VRSEC,
          passwordHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });
      trackedUserIdsB.push(adminUserB.id);

      managerUserB1 = await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3C Manager B1',
          email: FIXTURE_EMAILS.MANAGER_B1,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsB.push(managerUserB1.id);

      userB1 = await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3C User B1',
          email: FIXTURE_EMAILS.USER_B1,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });
      trackedUserIdsB.push(userB1.id);

      clubB1 = await tx.club.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3C Aero Club B1',
          description: 'Aero Club in College B',
          clubType: 'DEPARTMENTAL',
          createdByUserId: adminUserB.id,
        },
      });
      trackedClubIdsB.push(clubB1.id);

      const memB1 = await tx.membership.create({
        data: {
          collegeId: collegeB.id,
          userId: managerUserB1.id,
          clubId: clubB1.id,
          role: 'MANAGER',
        },
      });
      trackedMembershipIdsB.push(memB1.id);
    });

    // 3. Issue JWT tokens
    const signToken = (user, college) => {
      return jwt.sign(
        {
          id: user.id,
          userId: user.id,
          collegeId: college.id,
          collegeSlug: college.slug,
          role: user.role,
          type: 'college',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    };

    tokenAdminA = signToken(adminUserA, collegeA);
    tokenManagerA1 = signToken(managerUserA1, collegeA);
    tokenManagerA2 = signToken(managerUserA2, collegeA);
    tokenUserA1 = signToken(userA1, collegeA);
    tokenUserA2 = signToken(userA2, collegeA);
    tokenUserA3 = signToken(userA3, collegeA);

    tokenAdminB = signToken(adminUserB, collegeB);
    tokenManagerB1 = signToken(managerUserB1, collegeB);
    tokenUserB1 = signToken(userB1, collegeB);

    // 4. Start ephemeral test server
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`  ✔ Fixtures initialized successfully.`);
    console.log(`  ✔ Ephemeral test server active on ${baseUrl}`);

    async function makeRequest({ method = 'GET', path, host = 'lbrce.localhost', token, body, headers = {} }) {
      const reqHeaders = {
        'x-proxy-shared-secret': proxySecret,
        'X-Forwarded-Host': host,
        Origin: `http://${host}`,
        ...headers,
      };

      if (token) {
        reqHeaders['Authorization'] = `Bearer ${token}`;
      }

      const reqOptions = {
        method,
        headers: reqHeaders,
      };

      if (body) {
        reqHeaders['Content-Type'] = 'application/json';
        reqOptions.body = JSON.stringify(body);
      }

      const res = await fetch(`${baseUrl}${path}`, reqOptions);
      let json;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      let dataPayload;
      if (json && typeof json === 'object') {
        if (json.data !== undefined) {
          if (Array.isArray(json.data)) {
            dataPayload = json.data;
            dataPayload.message = json.message;
          } else if (json.data && typeof json.data === 'object') {
            dataPayload = { ...json.data, message: json.message };
          } else {
            dataPayload = json.data;
          }
        } else {
          dataPayload = json;
        }
      } else {
        dataPayload = json;
      }

      return { status: res.status, data: dataPayload, message: json?.message || '', raw: json };
    }

    // -------------------------------------------------------------------------
    // TEST 1: Event Capacity Creation & Updates
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing event capacity creation and updates...');
    const futureStart = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();

    const createRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C AI Workshop',
        description: 'Hands-on AI workshop',
        location: 'Lab 3',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 5,
      },
    });

    assert.strictEqual(createRes.status, 201, `Failed to create event: ${JSON.stringify(createRes.data)}`);
    assert(createRes.data.event && createRes.data.event.id, 'Created event missing ID');
    assert.strictEqual(createRes.data.event.capacity, 5, 'Event capacity mismatch in create response');
    const event1Id = createRes.data.event.id;
    trackedEventIdsA.push(event1Id);

    // Update capacity to 10
    const updateRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${event1Id}`,
      token: tokenManagerA1,
      body: {
        capacity: 10,
      },
    });
    assert.strictEqual(updateRes.status, 200, `Failed to update event capacity: ${JSON.stringify(updateRes.data)}`);
    assert.strictEqual(updateRes.data.event.capacity, 10, 'Updated capacity mismatch');

    // Update capacity with negative/invalid value -> 400
    const invalidCapRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${event1Id}`,
      token: tokenManagerA1,
      body: {
        capacity: -2,
      },
    });
    assert.strictEqual(invalidCapRes.status, 400, 'Expected 400 for negative capacity');

    // Set capacity to null (unlimited)
    const nullCapRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${event1Id}`,
      token: tokenManagerA1,
      body: {
        capacity: null,
      },
    });
    assert.strictEqual(nullCapRes.status, 200, `Failed to set capacity to null: ${JSON.stringify(nullCapRes.data)}`);
    assert.strictEqual(nullCapRes.data.event.capacity, null, 'Expected capacity to be null');
    console.log('  ✔ Test 1 passed: Capacity creation, updates, validation, and nullification verified.');

    // -------------------------------------------------------------------------
    // TEST 2: Invalid Capacity Reduction Below Registered Count (Mandatory Correction 1)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing capacity reduction guard against current registered count...');
    // Create an event with capacity 3
    const capEventRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C Limited Cap Event',
        description: 'Event for capacity reduction testing',
        location: 'Room 101',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 3,
      },
    });
    assert.strictEqual(capEventRes.status, 201);
    const capEventId = capEventRes.data.event.id;
    trackedEventIdsA.push(capEventId);

    // Register userA1 and userA2 (registeredCount becomes 2)
    const regU1 = await makeRequest({
      method: 'POST',
      path: `/events/${capEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(regU1.status, 201, `Failed reg U1: ${JSON.stringify(regU1.data)}`);
    trackedRegistrationIdsA.push(regU1.data.registration.id);

    const regU2 = await makeRequest({
      method: 'POST',
      path: `/events/${capEventId}/register`,
      token: tokenUserA2,
    });
    assert.strictEqual(regU2.status, 201, `Failed reg U2: ${JSON.stringify(regU2.data)}`);
    trackedRegistrationIdsA.push(regU2.data.registration.id);

    // Verify current registeredCount is 2
    const statusBefore = await makeRequest({
      method: 'GET',
      path: `/clubs/${clubA1.id}/events/${capEventId}`,
    });
    assert.strictEqual(statusBefore.status, 200);
    assert.strictEqual(statusBefore.data.event.registeredCount, 2);

    // Attempt to reduce capacity to 1 (below registeredCount 2) -> must return HTTP 400
    const reduceInvalidRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${capEventId}`,
      token: tokenManagerA1,
      body: {
        capacity: 1,
      },
    });
    assert.strictEqual(reduceInvalidRes.status, 400, `Expected 400 for capacity < registeredCount, got ${reduceInvalidRes.status}`);
    assert(
      reduceInvalidRes.data.message && reduceInvalidRes.data.message.includes('Capacity cannot be reduced below current registered count'),
      `Unexpected error message: ${reduceInvalidRes.data.message}`
    );

    // Valid reduction to exactly 2 (equal to registeredCount) -> must succeed (HTTP 200)
    const reduceValidRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${capEventId}`,
      token: tokenManagerA1,
      body: {
        capacity: 2,
      },
    });
    assert.strictEqual(reduceValidRes.status, 200, `Expected 200 for capacity == registeredCount: ${JSON.stringify(reduceValidRes.data)}`);
    assert.strictEqual(reduceValidRes.data.event.capacity, 2);
    console.log('  ✔ Test 2 passed: Capacity reduction below registered count rejected with HTTP 400; equal capacity allowed.');

    // -------------------------------------------------------------------------
    // TEST 3: Standard Registration & Cancellation Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing standard registration & cancellation lifecycle...');
    // Create new event
    const lifeEventRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C Lifecycle Event',
        description: 'Event for registration lifecycle',
        location: 'Auditorium',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 10,
      },
    });
    assert.strictEqual(lifeEventRes.status, 201);
    const lifeEventId = lifeEventRes.data.event.id;
    trackedEventIdsA.push(lifeEventId);

    // 1. Initial status: isRegistered = false
    const initialStatus = await makeRequest({
      method: 'GET',
      path: `/events/${lifeEventId}/my-registration`,
      token: tokenUserA1,
    });
    assert.strictEqual(initialStatus.status, 200);
    assert.strictEqual(initialStatus.data.isRegistered, false);
    assert.strictEqual(initialStatus.data.registration, null);

    // 2. Register for event
    const regRes = await makeRequest({
      method: 'POST',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(regRes.status, 201, `Failed to register: ${JSON.stringify(regRes.data)}`);
    assert(regRes.data.registration && regRes.data.registration.id, 'Missing registration ID');
    trackedRegistrationIdsA.push(regRes.data.registration.id);

    // 3. Status after register: isRegistered = true
    const postRegStatus = await makeRequest({
      method: 'GET',
      path: `/events/${lifeEventId}/my-registration`,
      token: tokenUserA1,
    });
    assert.strictEqual(postRegStatus.status, 200);
    assert.strictEqual(postRegStatus.data.isRegistered, true);
    assert.strictEqual(postRegStatus.data.registration.eventId, lifeEventId);

    // 4. List my registrations: includes this event
    const myListRes = await makeRequest({
      method: 'GET',
      path: '/events/my-registrations',
      token: tokenUserA1,
    });
    assert.strictEqual(myListRes.status, 200);
    const foundMyReg = myListRes.data.registrations.find((r) => r.eventId === lifeEventId);
    assert(foundMyReg, 'Registered event missing from my-registrations list');

    // 5. Cancel registration
    const cancelRegRes = await makeRequest({
      method: 'DELETE',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(cancelRegRes.status, 200, `Failed to cancel registration: ${JSON.stringify(cancelRegRes.data)}`);

    // 6. Status after cancel: isRegistered = false
    const postCancelStatus = await makeRequest({
      method: 'GET',
      path: `/events/${lifeEventId}/my-registration`,
      token: tokenUserA1,
    });
    assert.strictEqual(postCancelStatus.status, 200);
    assert.strictEqual(postCancelStatus.data.isRegistered, false);
    assert.strictEqual(postCancelStatus.data.registration, null);

    // 7. Verify registeredCount is back to 0
    const eventAfterCancel = await makeRequest({
      method: 'GET',
      path: `/clubs/${clubA1.id}/events/${lifeEventId}`,
    });
    assert.strictEqual(eventAfterCancel.data.event.registeredCount, 0);
    console.log('  ✔ Test 3 passed: Registration and cancellation lifecycle verified.');

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Registration Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing duplicate registration rejection...');
    const dupReg1 = await makeRequest({
      method: 'POST',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(dupReg1.status, 201);
    trackedRegistrationIdsA.push(dupReg1.data.registration.id);

    const dupReg2 = await makeRequest({
      method: 'POST',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(dupReg2.status, 409, `Expected 409 for duplicate registration, got ${dupReg2.status}`);
    assert(dupReg2.data.message && dupReg2.data.message.includes('already registered'), 'Unexpected message for duplicate registration');
    console.log('  ✔ Test 4 passed: Duplicate registration rejected with HTTP 409 Conflict.');

    // -------------------------------------------------------------------------
    // TEST 5: Registration Blocked on Cancelled and Past Events
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing registration guard on cancelled and past events...');
    // Create and cancel an event
    const cancelEvRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C Cancelled Event',
        description: 'Cancelled event test',
        location: 'Hall B',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 10,
      },
    });
    assert.strictEqual(cancelEvRes.status, 201);
    const cancelEvId = cancelEvRes.data.event.id;
    trackedEventIdsA.push(cancelEvId);

    const cancelActionRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${cancelEvId}/cancel`,
      token: tokenManagerA1,
    });
    assert.strictEqual(cancelActionRes.status, 200);

    // Attempt registration on cancelled event
    const regCancelledRes = await makeRequest({
      method: 'POST',
      path: `/events/${cancelEvId}/register`,
      token: tokenUserA2,
    });
    assert.strictEqual(regCancelledRes.status, 400, 'Expected 400 for cancelled event registration');
    assert(regCancelledRes.data.message.includes('cancelled event'));

    // Create a past event directly in DB
    const pastStart = new Date(Date.now() - 48 * 3600 * 1000);
    const pastEnd = new Date(Date.now() - 24 * 3600 * 1000);
    let pastEvent;
    await withTenant(collegeA.id, async (tx) => {
      pastEvent = await tx.event.create({
        data: {
          collegeId: collegeA.id,
          clubId: clubA1.id,
          title: 'P3C Past Event',
          description: 'Historical past event',
          location: 'Old Hall',
          startAt: pastStart,
          endAt: pastEnd,
          capacity: 20,
        },
      });
      trackedEventIdsA.push(pastEvent.id);
    });

    // Attempt registration on past event
    const regPastRes = await makeRequest({
      method: 'POST',
      path: `/events/${pastEvent.id}/register`,
      token: tokenUserA2,
    });
    assert.strictEqual(regPastRes.status, 400, 'Expected 400 for past event registration');
    assert(regPastRes.data.message.includes('past event'));
    console.log('  ✔ Test 5 passed: Registration blocked on cancelled and past events with HTTP 400.');

    // -------------------------------------------------------------------------
    // TEST 6: Registration Reassignment Prevention (Mandatory Correction 2)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing registration reassignment prevention...');
    // Confirm there is no PATCH or PUT endpoint on /events/:eventId/register or /events/register
    const patchRes = await makeRequest({
      method: 'PATCH',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
      body: { eventId: capEventId },
    });
    assert.strictEqual(patchRes.status, 404, 'Registration reassignment PATCH route must not exist (404)');

    const putRes = await makeRequest({
      method: 'PUT',
      path: `/events/${lifeEventId}/register`,
      token: tokenUserA1,
      body: { eventId: capEventId },
    });
    assert.strictEqual(putRes.status, 404, 'Registration reassignment PUT route must not exist (404)');
    console.log('  ✔ Test 6 passed: Registration reassignment across events is forbidden.');

    // -------------------------------------------------------------------------
    // TEST 7: High-Concurrency Burst Test (Overbooking Prevention)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing high-concurrency burst: 30 concurrent requests for capacity=3...');
    // Create an event with capacity = 3
    const burstEventRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C Burst Test Event',
        description: 'High concurrency burst test',
        location: 'Main Auditorium',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 3,
      },
    });
    assert.strictEqual(burstEventRes.status, 201);
    const burstEventId = burstEventRes.data.event.id;
    trackedEventIdsA.push(burstEventId);

    // Create 30 distinct users in College A
    const burstUsers = [];
    const burstTokens = [];
    await withTenant(collegeA.id, async (tx) => {
      for (let i = 1; i <= 30; i++) {
        const u = await tx.user.create({
          data: {
            collegeId: collegeA.id,
            name: `Burst User ${i}`,
            email: `burst_p3c_${i}@example.test`,
            passwordHash,
            role: 'USER',
            isActive: true,
          },
        });
        burstUsers.push(u);
        trackedUserIdsA.push(u.id);
        burstTokens.push(signToken(u, collegeA));
      }
    });

    // Fire 30 simultaneous registration requests
    const burstPromises = burstTokens.map((token) =>
      makeRequest({
        method: 'POST',
        path: `/events/${burstEventId}/register`,
        token,
      })
    );
    const burstResults = await Promise.all(burstPromises);

    const successCount = burstResults.filter((r) => r.status === 201).length;
    const non201 = burstResults.filter((r) => r.status !== 201);
    console.log('  Non-201 status distribution:', non201.map((r) => ({ status: r.status, msg: r.message || r.data?.message })));
    const capacityFullCount = burstResults.filter((r) => r.status === 409 && (r.message || r.data?.message || '').toLowerCase().includes('capacity')).length;
    console.log(`  Burst Results: ${successCount} succeeded (201), ${capacityFullCount} rejected for capacity (409)`);

    assert.strictEqual(successCount, 3, `Expected exactly 3 registrations to succeed, got ${successCount}`);
    assert.strictEqual(capacityFullCount, 27, `Expected exactly 27 requests to be rejected for capacity, got ${capacityFullCount}`);

    // Verify DB count directly
    const [burstEventInDb] = await withTenant(collegeA.id, async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: burstEventId } });
      const regCount = await tx.eventRegistration.count({ where: { eventId: burstEventId } });
      return [{ ev, regCount }];
    });
    assert.strictEqual(burstEventInDb.ev.registeredCount, 3, 'DB registered_count must be exactly 3');
    assert.strictEqual(burstEventInDb.regCount, 3, 'DB actual registration row count must be exactly 3');
    console.log('  ✔ Test 7 passed: Serialized locking prevented overbooking; exactly 3 succeeded, 27 rejected.');

    // -------------------------------------------------------------------------
    // TEST 8: Order-Independent Concurrent Cancellation + Registration (Mandatory Correction 3)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing order-independent concurrent cancellation and registration...');
    // Create an event with capacity = 1
    const raceEventRes = await makeRequest({
      method: 'POST',
      path: `/manager/clubs/${clubA1.id}/events`,
      token: tokenManagerA1,
      body: {
        title: 'P3C Slot Swap Event',
        description: 'Single capacity slot swap test',
        location: 'Room 5',
        startAt: futureStart,
        endAt: futureEnd,
        capacity: 1,
      },
    });
    assert.strictEqual(raceEventRes.status, 201);
    const raceEventId = raceEventRes.data.event.id;
    trackedEventIdsA.push(raceEventId);

    // userA1 registers -> slot is now full (1/1)
    const initialReg = await makeRequest({
      method: 'POST',
      path: `/events/${raceEventId}/register`,
      token: tokenUserA1,
    });
    assert.strictEqual(initialReg.status, 201);
    trackedRegistrationIdsA.push(initialReg.data.registration.id);

    // Concurrently: userA1 cancels AND userA2 attempts to register
    const [cancelOp, regOp] = await Promise.all([
      makeRequest({
        method: 'DELETE',
        path: `/events/${raceEventId}/register`,
        token: tokenUserA1,
      }),
      makeRequest({
        method: 'POST',
        path: `/events/${raceEventId}/register`,
        token: tokenUserA2,
      }),
    ]);

    console.log(`  Concurrent Op Results: Cancel Status=${cancelOp.status}, Register Status=${regOp.status}`);
    assert.strictEqual(cancelOp.status, 200, 'Cancellation must succeed with 200');

    // Register op either succeeded (201) if cancel committed first, or received 409 if register lock preceded cancel
    assert(
      regOp.status === 201 || regOp.status === 409,
      `Register status must be 201 or 409, got ${regOp.status}`
    );

    // Check DB state after concurrent operations
    const [postRaceState] = await withTenant(collegeA.id, async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: raceEventId } });
      const regCount = await tx.eventRegistration.count({ where: { eventId: raceEventId } });
      return [{ ev, regCount }];
    });
    // Capacity invariant: count never exceeds 1
    assert(
      postRaceState.ev.registeredCount <= 1,
      `Invariant violation: registered_count ${postRaceState.ev.registeredCount} > capacity 1`
    );
    assert.strictEqual(postRaceState.ev.registeredCount, postRaceState.regCount);

    // Verify that the freed slot can subsequently be claimed:
    if (regOp.status === 409) {
      // Since cancel succeeded, slot is now open; userA2 retrying registration must succeed!
      const retryReg = await makeRequest({
        method: 'POST',
        path: `/events/${raceEventId}/register`,
        token: tokenUserA2,
      });
      assert.strictEqual(retryReg.status, 201, `Failed to claim freed slot on retry: ${JSON.stringify(retryReg.data)}`);
      trackedRegistrationIdsA.push(retryReg.data.registration.id);
    } else {
      trackedRegistrationIdsA.push(regOp.data.registration.id);
    }

    // Confirm final registeredCount is 1
    const [finalRaceState] = await withTenant(collegeA.id, async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: raceEventId } });
      return [ev.registeredCount];
    });
    assert.strictEqual(finalRaceState, 1, 'Event final registered count should be 1');
    console.log('  ✔ Test 8 passed: Capacity invariant held and freed slot claimed.');

    // -------------------------------------------------------------------------
    // TEST 9: Attendee Roster RBAC & Pagination
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing attendee roster RBAC and pagination...');
    // Authorized Club Manager A1 accesses roster for event in Club A1
    const rosterMgrA1 = await makeRequest({
      method: 'GET',
      path: `/manager/clubs/${clubA1.id}/events/${lifeEventId}/registrations`,
      token: tokenManagerA1,
    });
    assert.strictEqual(rosterMgrA1.status, 200, `Manager A1 failed to get roster: ${JSON.stringify(rosterMgrA1.data)}`);
    assert(Array.isArray(rosterMgrA1.data.registrations), 'Roster registrations must be an array');
    assert(rosterMgrA1.data.total >= 1, 'Total registrations should be >= 1');

    // College Admin accesses roster
    const rosterAdmin = await makeRequest({
      method: 'GET',
      path: `/manager/clubs/${clubA1.id}/events/${lifeEventId}/registrations`,
      token: tokenAdminA,
    });
    assert.strictEqual(rosterAdmin.status, 200, 'College Admin should have access to attendee roster');

    // Unauthorized Manager A2 (manager of Club A2, not Club A1) attempts to access roster
    const rosterMgrA2 = await makeRequest({
      method: 'GET',
      path: `/manager/clubs/${clubA1.id}/events/${lifeEventId}/registrations`,
      token: tokenManagerA2,
    });
    assert.strictEqual(rosterMgrA2.status, 403, `Expected 403 for unauthorized manager, got ${rosterMgrA2.status}`);

    // Regular student attempts to access roster
    const rosterUser = await makeRequest({
      method: 'GET',
      path: `/manager/clubs/${clubA1.id}/events/${lifeEventId}/registrations`,
      token: tokenUserA1,
    });
    assert.strictEqual(rosterUser.status, 403, 'Regular user must be denied access to attendee roster');

    // Pagination test on burst event (which has 3 registrations)
    const pageRes = await makeRequest({
      method: 'GET',
      path: `/manager/clubs/${clubA1.id}/events/${burstEventId}/registrations?page=1&limit=2`,
      token: tokenManagerA1,
    });
    assert.strictEqual(pageRes.status, 200);
    assert.strictEqual(pageRes.data.limit, 2);
    assert.strictEqual(pageRes.data.page, 1);
    assert.strictEqual(pageRes.data.registrations.length, 2);
    assert.strictEqual(pageRes.data.total, 3);
    console.log('  ✔ Test 9 passed: Attendee roster RBAC and pagination verified.');

    // -------------------------------------------------------------------------
    // TEST 10: Cross-Tenant Isolation (Mandatory Correction 4)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing cross-tenant isolation and unauthorized access...');
    // Create an event in College B
    let eventB1;
    await withTenant(collegeB.id, async (tx) => {
      eventB1 = await tx.event.create({
        data: {
          collegeId: collegeB.id,
          clubId: clubB1.id,
          title: 'P3C College B Event',
          description: 'College B event',
          location: 'Hall B',
          startAt: futureStart,
          endAt: futureEnd,
          capacity: 10,
        },
      });
      trackedEventIdsB.push(eventB1.id);
    });

    // 10a: Cross-Tenant Event Access (RLS isolation: College A user querying College B event under College A host)
    console.log('  [10a] Cross-tenant event access: User A querying Event B under College A host...');
    const crossTenantEventRes = await makeRequest({
      method: 'POST',
      path: `/events/${eventB1.id}/register`,
      token: tokenUserA1,
      host: 'lbrce.localhost',
    });
    assert.strictEqual(
      crossTenantEventRes.status,
      404,
      `Expected 404 for cross-tenant event access (RLS isolation), got ${crossTenantEventRes.status}`
    );
    assert.strictEqual(crossTenantEventRes.data.message, 'Event not found');

    // 10b: Cross-Tenant JWT Rejection (Host/Token College Mismatch)
    console.log('  [10b] Cross-tenant JWT rejection: User B token on College A host...');
    const crossTenantTokenRes = await makeRequest({
      method: 'POST',
      path: `/events/${event1Id}/register`,
      token: tokenUserB1,
      host: 'lbrce.localhost',
    });
    assert.strictEqual(
      crossTenantTokenRes.status,
      403,
      `Expected 403 for token/tenant mismatch, got ${crossTenantTokenRes.status}`
    );
    assert(
      crossTenantTokenRes.data.message.includes('Token belongs to a different college tenant') ||
        crossTenantTokenRes.data.message.includes('Cross-tenant access forbidden') ||
        crossTenantTokenRes.data.message.includes('forbidden'),
      `Unexpected cross-tenant error message: ${crossTenantTokenRes.data.message}`
    );

    // 10c: Unauthorized Same-College Club-Manager Access
    console.log('  [10c] Unauthorized same-college manager access: Manager A2 attempting to modify Club A1 event...');
    const unauthorizedMgrRes = await makeRequest({
      method: 'PATCH',
      path: `/manager/clubs/${clubA1.id}/events/${event1Id}`,
      token: tokenManagerA2,
      body: { title: 'Hijacked Event Title' },
    });
    assert.strictEqual(
      unauthorizedMgrRes.status,
      403,
      `Expected 403 for unauthorized same-college manager, got ${unauthorizedMgrRes.status}`
    );
    console.log('  ✔ Test 10 passed: Cross-tenant RLS 404, token mismatch 403, and same-college manager 403 verified.');

    // -------------------------------------------------------------------------
    // TEST 11: Fixture Cleanup (Mandatory Correction 5)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 11] Performing exact fixture ID cleanup...');
    await cleanupFixtures(collegeA, collegeB);

    // Verify cleanup
    await withTenant(collegeA.id, async (tx) => {
      const remainingEvents = await tx.event.count({ where: { id: { in: trackedEventIdsA } } });
      const remainingUsers = await tx.user.count({ where: { id: { in: trackedUserIdsA } } });
      const remainingClubs = await tx.club.count({ where: { id: { in: trackedClubIdsA } } });
      assert.strictEqual(remainingEvents, 0, `Expected 0 remaining events in College A, found ${remainingEvents}`);
      assert.strictEqual(remainingUsers, 0, `Expected 0 remaining users in College A, found ${remainingUsers}`);
      assert.strictEqual(remainingClubs, 0, `Expected 0 remaining clubs in College A, found ${remainingClubs}`);
    });
    console.log('  ✔ Test 11 passed: All exact fixture IDs successfully cleaned up from test database.');

    console.log('\n======================================================================');
    console.log('ALL PHASE 3C TESTS PASSED SUCCESSFULLY! (11/11)');
    console.log('======================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runPhase3cTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ PHASE 3C TEST SUITE FAILED:\n', err);
    process.exit(1);
  });
