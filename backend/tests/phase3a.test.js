process.env.NODE_ENV = 'test';

// Strict requirement: TEST_DATABASE_URL and TEST_PLATFORM_DATABASE_URL must be explicitly provided.
if (!process.env.TEST_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_DATABASE_URL environment variable is required to run Phase 3a tests.');
  console.error('Refusing to run tests or fallback to DATABASE_URL.\n');
  process.exit(1);
}

if (!process.env.TEST_PLATFORM_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_PLATFORM_DATABASE_URL environment variable is required to run Phase 3a tests.');
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
  process.env.JWT_SECRET = 'test_jwt_secret_phase3a_super_secure_key_123';
}

const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');
const app = require('../index');

const FIXTURE_EMAILS = {
  ADMIN_LBRCE: 'admin_lbrce_p3a@example.test',
  ADMIN_VRSEC: 'admin_vrsec_p3a@example.test',
};

async function cleanupFixtures(collegeA, collegeB) {
  if (collegeA && collegeA.id) {
    await withTenant(collegeA.id, async (tx) => {
      await tx.clubDepartment.deleteMany({
        where: { collegeId: collegeA.id },
      });
      await tx.membership.deleteMany({
        where: { collegeId: collegeA.id, user: { email: { endsWith: '@example.test' } } },
      });
      await tx.club.deleteMany({
        where: { collegeId: collegeA.id, name: { startsWith: 'P3A ' } },
      });
      await tx.department.deleteMany({
        where: { collegeId: collegeA.id, name: { startsWith: 'P3A ' } },
      });
      await tx.user.deleteMany({
        where: { collegeId: collegeA.id, email: { endsWith: '@example.test' } },
      });
    });
  }

  if (collegeB && collegeB.id) {
    await withTenant(collegeB.id, async (tx) => {
      await tx.clubDepartment.deleteMany({
        where: { collegeId: collegeB.id },
      });
      await tx.membership.deleteMany({
        where: { collegeId: collegeB.id, user: { email: { endsWith: '@example.test' } } },
      });
      await tx.club.deleteMany({
        where: { collegeId: collegeB.id, name: { startsWith: 'P3A ' } },
      });
      await tx.department.deleteMany({
        where: { collegeId: collegeB.id, name: { startsWith: 'P3A ' } },
      });
      await tx.user.deleteMany({
        where: { collegeId: collegeB.id, email: { endsWith: '@example.test' } },
      });
    });
  }
}

async function runPhase3aTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 3A: DEPARTMENTS & CLUBS MULTI-TENANT TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 0. Database Safety Guard & DB Role Privileges Check
  // -------------------------------------------------------------------------
  console.log('\n[TEST 0] Verifying database safety guard and DB role privileges...');
  const [dbMeta] = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log(`  Current Database : ${dbMeta.current_database}`);
  console.log(`  Current User     : ${dbMeta.current_user}`);

  let endpointType = 'Direct Database Endpoint';
  try {
    const parsedUrl = new URL(process.env.TEST_DATABASE_URL);
    if (parsedUrl.hostname.includes('-pooler') || parsedUrl.searchParams.get('pgbouncer') === 'true') {
      endpointType = 'PgBouncer Pooler Endpoint (pgbouncer=true)';
    }
  } catch {
    if (process.env.TEST_DATABASE_URL.includes('-pooler') || process.env.TEST_DATABASE_URL.includes('pgbouncer=true')) {
      endpointType = 'PgBouncer Pooler Endpoint (pgbouncer=true)';
    }
  }
  console.log(`  Endpoint Type    : ${endpointType}`);

  assert.strictEqual(
    dbMeta.current_database,
    'yuva_test',
    `FAIL: Refusing to run tests: current_database() must be "yuva_test", got "${dbMeta.current_database}"`
  );
  assert.strictEqual(dbMeta.current_user, 'app_user', 'FAIL: current_user must be "app_user"');

  const [roleMeta] = await prisma.$queryRaw`
    SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
  `;
  assert.strictEqual(roleMeta.rolbypassrls, false, 'FAIL: app_user must have rolbypassrls=false');
  console.log('  ✔ Database safety guard passed (yuva_test, app_user NOBYPASSRLS).');

  // -------------------------------------------------------------------------
  // 1. Setup Test Fixtures (Colleges, Users, Departments, Clubs)
  // -------------------------------------------------------------------------
  console.log('\n[SETUP] Preparing Phase 3a test fixtures in College A (lbrce) and College B (vrsec)...');
  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');
  assert.ok(collegeA, 'FAIL: College A (lbrce) must exist');
  assert.ok(collegeB, 'FAIL: College B (vrsec) must exist');

  await cleanupFixtures(collegeA, collegeB);

  const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

  let adminUserA, adminUserB;
  let deptA1, deptA2;
  let deptB1, deptB2;
  let clubDeptA, clubCentralA;
  let clubDeptB, clubCentralB;

  // Setup College A fixtures
  await withTenant(collegeA.id, async (tx) => {
    adminUserA = await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Admin P3A',
        email: FIXTURE_EMAILS.ADMIN_LBRCE,
        passwordHash,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });

    deptA1 = await tx.department.create({
      data: {
        collegeId: collegeA.id,
        name: 'P3A Computer Science A',
        shortCode: 'P3A_CSA',
        description: 'CS Dept College A',
      },
    });

    deptA2 = await tx.department.create({
      data: {
        collegeId: collegeA.id,
        name: 'P3A Electronics A',
        shortCode: 'P3A_ECA',
        description: 'EC Dept College A',
      },
    });

    clubDeptA = await tx.club.create({
      data: {
        collegeId: collegeA.id,
        name: 'P3A Tech Club A',
        description: 'Departmental Tech Club A',
        clubType: 'DEPARTMENTAL',
        createdByUserId: adminUserA.id,
      },
    });

    clubCentralA = await tx.club.create({
      data: {
        collegeId: collegeA.id,
        name: 'P3A Sports Club A',
        description: 'Central Sports Club A',
        clubType: 'CENTRAL',
        createdByUserId: adminUserA.id,
      },
    });

    // Link deptA1 to clubDeptA
    await tx.clubDepartment.create({
      data: {
        collegeId: collegeA.id,
        clubId: clubDeptA.id,
        departmentId: deptA1.id,
      },
    });
  });

  // Setup College B fixtures
  await withTenant(collegeB.id, async (tx) => {
    adminUserB = await tx.user.create({
      data: {
        collegeId: collegeB.id,
        name: 'VRSEC Admin P3A',
        email: FIXTURE_EMAILS.ADMIN_VRSEC,
        passwordHash,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });

    deptB1 = await tx.department.create({
      data: {
        collegeId: collegeB.id,
        name: 'P3A Computer Science B',
        shortCode: 'P3A_CSB',
        description: 'CS Dept College B',
      },
    });

    deptB2 = await tx.department.create({
      data: {
        collegeId: collegeB.id,
        name: 'P3A Mechanical B',
        shortCode: 'P3A_MEB',
        description: 'ME Dept College B',
      },
    });

    clubDeptB = await tx.club.create({
      data: {
        collegeId: collegeB.id,
        name: 'P3A Robotics Club B',
        description: 'Departmental Robotics Club B',
        clubType: 'DEPARTMENTAL',
        createdByUserId: adminUserB.id,
      },
    });

    clubCentralB = await tx.club.create({
      data: {
        collegeId: collegeB.id,
        name: 'P3A Cultural Club B',
        description: 'Central Cultural Club B',
        clubType: 'CENTRAL',
        createdByUserId: adminUserB.id,
      },
    });

    // Link deptB1 to clubDeptB
    await tx.clubDepartment.create({
      data: {
        collegeId: collegeB.id,
        clubId: clubDeptB.id,
        departmentId: deptB1.id,
      },
    });
  });

  // Generate scoped JWT tokens for Admins
  const tokenAdminA = jwt.sign(
    { userId: adminUserA.id, collegeId: collegeA.id, role: 'COLLEGE_ADMIN' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenAdminB = jwt.sign(
    { userId: adminUserB.id, collegeId: collegeB.id, role: 'COLLEGE_ADMIN' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('  ✔ Fixtures initialized successfully using @example.test data.');

  // Start ephemeral Express HTTP server
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  ✔ Ephemeral test server active on ${baseUrl}`);

  async function apiFetch(reqPath, options = {}) {
    const host = options.tenantHost || 'lbrce.localhost';
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...options.headers,
    };
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }
    const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;

    const res = await fetch(`${baseUrl}${reqPath}`, {
      method: options.method || 'GET',
      headers,
      body,
    });

    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, headers: res.headers, data };
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Admin Tenant Isolation (Admin A sees only A; Admin B sees only B)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Admin Tenant Isolation (Every endpoint sees only its own college rows)...');

    // 1a. List clubs as Admin A on lbrce host
    const clubsARes = await apiFetch('/admin/clubs', {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(clubsARes.status, 200);
    const clubsA = clubsARes.data.data;
    assert.ok(Array.isArray(clubsA), 'clubsA must be an array');
    const checkedClubsACount = clubsA.length;
    console.log(`    Admin A retrieved ${checkedClubsACount} clubs from College A (lbrce)`);
    assert.ok(checkedClubsACount > 0, 'FAIL: Expected > 0 clubs for College A');
    for (const c of clubsA) {
      assert.strictEqual(c.collegeId, collegeA.id, 'Cross-tenant leak: non-College A club in College A query!');
      assert.notStrictEqual(c.id, clubDeptB.id, 'Cross-tenant leak: College B club returned to College A admin!');
      assert.notStrictEqual(c.id, clubCentralB.id, 'Cross-tenant leak: College B club returned to College A admin!');
    }

    // 1b. List clubs as Admin B on vrsec host
    const clubsBRes = await apiFetch('/admin/clubs', {
      tenantHost: 'vrsec.localhost',
      token: tokenAdminB,
    });
    assert.strictEqual(clubsBRes.status, 200);
    const clubsB = clubsBRes.data.data;
    assert.ok(Array.isArray(clubsB), 'clubsB must be an array');
    const checkedClubsBCount = clubsB.length;
    console.log(`    Admin B retrieved ${checkedClubsBCount} clubs from College B (vrsec)`);
    assert.ok(checkedClubsBCount > 0, 'FAIL: Expected > 0 clubs for College B');
    for (const c of clubsB) {
      assert.strictEqual(c.collegeId, collegeB.id, 'Cross-tenant leak: non-College B club in College B query!');
      assert.notStrictEqual(c.id, clubDeptA.id, 'Cross-tenant leak: College A club returned to College B admin!');
      assert.notStrictEqual(c.id, clubCentralA.id, 'Cross-tenant leak: College A club returned to College B admin!');
    }

    // 1c. List departments as Admin A on lbrce host
    const deptsARes = await apiFetch('/departments', {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(deptsARes.status, 200);
    const deptsA = deptsARes.data.data.departments;
    const checkedDeptsACount = deptsA.length;
    console.log(`    Admin A retrieved ${checkedDeptsACount} departments from College A (lbrce)`);
    assert.ok(checkedDeptsACount > 0, 'FAIL: Expected > 0 departments for College A');
    for (const d of deptsA) {
      assert.strictEqual(d.collegeId, collegeA.id);
      assert.notStrictEqual(d.id, deptB1.id);
      assert.notStrictEqual(d.id, deptB2.id);
    }

    // 1d. List departments as Admin B on vrsec host
    const deptsBRes = await apiFetch('/departments', {
      tenantHost: 'vrsec.localhost',
      token: tokenAdminB,
    });
    assert.strictEqual(deptsBRes.status, 200);
    const deptsB = deptsBRes.data.data.departments;
    const checkedDeptsBCount = deptsB.length;
    console.log(`    Admin B retrieved ${checkedDeptsBCount} departments from College B (vrsec)`);
    assert.ok(checkedDeptsBCount > 0, 'FAIL: Expected > 0 departments for College B');
    for (const d of deptsB) {
      assert.strictEqual(d.collegeId, collegeB.id);
      assert.notStrictEqual(d.id, deptA1.id);
      assert.notStrictEqual(d.id, deptA2.id);
    }

    // 1e. Get single club & department for own tenant
    const getClubARes = await apiFetch(`/admin/clubs/${clubDeptA.id}`, {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(getClubARes.status, 200);
    assert.strictEqual(getClubARes.data.data.id, clubDeptA.id);
    assert.strictEqual(getClubARes.data.data.isCentral, false);
    assert.strictEqual(getClubARes.data.data.clubType, 'DEPARTMENTAL');
    console.log(`    Verified GET /admin/clubs/:clubId: id=${clubDeptA.id}, name='${getClubARes.data.data.name}'`);

    const getDeptARes = await apiFetch(`/departments/${deptA1.id}`, {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(getDeptARes.status, 200);
    assert.strictEqual(getDeptARes.data.data.department.id, deptA1.id);
    console.log(`    Verified GET /departments/:departmentId: id=${deptA1.id}, shortCode='${getDeptARes.data.data.department.shortCode}'`);

    console.log('  ✔ Every endpoint as A admin on lbrce host and B admin on vrsec host sees only its own rows.');

    // -------------------------------------------------------------------------
    // Test 2: Cross-Tenant ID Boundary (A's token with B's IDs gets 404)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Cross-Tenant ID Boundary (A token with B IDs receives HTTP 404)...');

    // 2a. GET /admin/clubs/:clubId with College B's clubId
    const crossClubRes = await apiFetch(`/admin/clubs/${clubDeptB.id}`, {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(crossClubRes.status, 404, 'Admin A accessing College B club must return HTTP 404');

    // 2b. PATCH /admin/clubs/:clubId with College B's clubId
    const crossUpdateClubRes = await apiFetch(`/admin/clubs/${clubDeptB.id}`, {
      method: 'PATCH',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { name: 'Attempted Cross-Tenant Rename' },
    });
    assert.strictEqual(crossUpdateClubRes.status, 404, 'Admin A updating College B club must return HTTP 404');

    // 2c. GET /admin/viewClub/:id with College B's clubId
    const crossViewClubRes = await apiFetch(`/admin/viewClub/${clubDeptB.id}`, {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(crossViewClubRes.status, 404, 'Admin A viewing College B club must return HTTP 404');

    // 2d. GET /departments/:departmentId with College B's departmentId
    const crossDeptRes = await apiFetch(`/departments/${deptB1.id}`, {
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
    });
    assert.strictEqual(crossDeptRes.status, 404, 'Accessing College B department on College A must return HTTP 404');

    // 2e. PATCH /admin/departments/:departmentId with College B's departmentId
    const crossUpdateDeptRes = await apiFetch(`/admin/departments/${deptB1.id}`, {
      method: 'PATCH',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { name: 'Attempted Cross-Tenant Dept Rename' },
    });
    assert.strictEqual(crossUpdateDeptRes.status, 404, 'Admin A updating College B department must return HTTP 404');

    console.log('    Tested 5 cross-tenant ID access vectors; all strictly returned HTTP 404.');
    console.log('  ✔ A token with B IDs strictly returns HTTP 404 under RLS tenant scoping.');

    // -------------------------------------------------------------------------
    // Test 3: Token Host Mismatch (A's admin on B's host gets 403)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Token Host Mismatch (A's admin on B's host receives HTTP 403)...");

    const hostMismatchRes1 = await apiFetch('/admin/clubs', {
      tenantHost: 'vrsec.localhost', // Host is College B!
      token: tokenAdminA, // Token belongs to College A!
    });
    assert.strictEqual(hostMismatchRes1.status, 403, "College A token on College B host must return HTTP 403");

    const hostMismatchRes2 = await apiFetch('/admin/create-club', {
      method: 'POST',
      tenantHost: 'vrsec.localhost',
      token: tokenAdminA,
      body: { name: 'Sneaky Club On Other Tenant' },
    });
    assert.strictEqual(hostMismatchRes2.status, 403, "College A token creating club on College B host must return HTTP 403");

    console.log('    Tested GET /admin/clubs and POST /admin/create-club with mismatched host; both returned HTTP 403.');
    console.log("  ✔ A admin on B host strictly rejected with HTTP 403 (host tenant claim mismatch).");

    // -------------------------------------------------------------------------
    // Test 4: Unauthenticated Public Listings Return Only That Host's College
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Unauthenticated Public Listings (/clubs and /clubs/:clubId)...');

    // 4a. Public clubs on lbrce host (no token)
    const publicClubsARes = await apiFetch('/clubs', {
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(publicClubsARes.status, 200);
    const publicClubsA = (publicClubsARes.data.data && publicClubsARes.data.data.clubs) || publicClubsARes.data.clubs;
    const publicClubsACount = publicClubsA.length;
    console.log(`    Public visitor retrieved ${publicClubsACount} clubs on lbrce.localhost`);
    assert.ok(publicClubsACount > 0, 'FAIL: Expected > 0 public clubs on lbrce');
    for (const c of publicClubsA) {
      assert.strictEqual(c.collegeId, collegeA.id);
      assert.notStrictEqual(c.id, clubDeptB.id);
      assert.notStrictEqual(c.id, clubCentralB.id);
    }

    // 4b. Public clubs on vrsec host (no token)
    const publicClubsBRes = await apiFetch('/clubs', {
      tenantHost: 'vrsec.localhost',
    });
    assert.strictEqual(publicClubsBRes.status, 200);
    const publicClubsB = (publicClubsBRes.data.data && publicClubsBRes.data.data.clubs) || publicClubsBRes.data.clubs;
    const publicClubsBCount = publicClubsB.length;
    console.log(`    Public visitor retrieved ${publicClubsBCount} clubs on vrsec.localhost`);
    assert.ok(publicClubsBCount > 0, 'FAIL: Expected > 0 public clubs on vrsec');
    for (const c of publicClubsB) {
      assert.strictEqual(c.collegeId, collegeB.id);
      assert.notStrictEqual(c.id, clubDeptA.id);
      assert.notStrictEqual(c.id, clubCentralA.id);
    }

    // 4c. Single public club serialization check
    const publicSingleClubRes = await apiFetch(`/clubs/${clubDeptA.id}`, {
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(publicSingleClubRes.status, 200);
    const publicClub = (publicSingleClubRes.data.data && publicSingleClubRes.data.data.club) || publicSingleClubRes.data.club;
    assert.strictEqual(publicClub.id, clubDeptA.id);
    assert.strictEqual(publicClub.isCentral, false);
    assert.strictEqual(publicClub.clubType, 'DEPARTMENTAL');
    assert.strictEqual(publicClub.logo, null);
    assert.strictEqual(publicClub.coverImage, null);
    assert.ok(Array.isArray(publicClub.departments), 'Public club must include departments array');
    assert.ok(publicClub.departments.some((d) => d.id === deptA1.id), 'Club A1 must include dept A1');
    console.log(`    Verified public club serialization: isCentral=${publicClub.isCentral}, clubType='${publicClub.clubType}'`);

    // 4d. Cross-tenant public single club -> 404
    const publicCrossClubRes = await apiFetch(`/clubs/${clubDeptB.id}`, {
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(publicCrossClubRes.status, 404, 'Public request for College B club on College A host must 404');

    // 4e. Non-UUID format -> 400
    const invalidIdRes = await apiFetch('/clubs/not-a-valid-uuid', {
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(invalidIdRes.status, 400, 'Invalid UUID on public club route must return HTTP 400');

    console.log('  ✔ Unauthenticated public listings return only that host college with valid serialization.');

    // -------------------------------------------------------------------------
    // Test 5: Central Club Cannot Be Linked to a Department
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Central Club Constraint Enforcement...');

    // 5a. Attempt PUT /admin/departments/:departmentId/clubs with a CENTRAL club -> 409
    const linkCentralDeptClubsRes = await apiFetch(`/admin/departments/${deptA1.id}/clubs`, {
      method: 'PUT',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { clubIds: [clubCentralA.id] }, // Central Club!
    });
    assert.strictEqual(linkCentralDeptClubsRes.status, 409, 'Linking CENTRAL club to department must return HTTP 409');
    assert.ok(linkCentralDeptClubsRes.data.message.includes('Central clubs cannot be linked to a department'));
    console.log('    PUT /admin/departments/:departmentId/clubs with CENTRAL club correctly returned HTTP 409.');

    // 5b. Attempt PUT /admin/clubs/:clubId/departments on a CENTRAL club -> 409
    const linkCentralClubDeptsRes = await apiFetch(`/admin/clubs/${clubCentralA.id}/departments`, {
      method: 'PUT',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { departmentIds: [deptA1.id] },
    });
    assert.strictEqual(linkCentralClubDeptsRes.status, 409, 'Linking department to CENTRAL club must return HTTP 409');
    assert.ok(linkCentralClubDeptsRes.data.message.includes('Central clubs cannot be linked to a department'));
    console.log('    PUT /admin/clubs/:clubId/departments on CENTRAL club correctly returned HTTP 409.');

    // 5c. Attempt PATCH /admin/clubs/:clubId changing DEPARTMENTAL club with links to CENTRAL -> 409
    const convertToCentralRes = await apiFetch(`/admin/clubs/${clubDeptA.id}`, {
      method: 'PATCH',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { isCentral: true }, // ClubDeptA already has link to DeptA1!
    });
    assert.strictEqual(convertToCentralRes.status, 409, 'Changing linked club to CENTRAL must return HTTP 409');
    assert.ok(convertToCentralRes.data.message.includes('cannot be marked central') || convertToCentralRes.data.message.includes('Central clubs cannot be linked'));
    console.log('    PATCH /admin/clubs/:clubId converting linked club to CENTRAL correctly returned HTTP 409.');

    console.log('  ✔ Central club constraints verified across all 3 assignment and update vectors.');

    // -------------------------------------------------------------------------
    // Test 6: Duplicate shortCode and Name Returns HTTP 409
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Duplicate Uniqueness Constraints (HTTP 409)...');

    // 6a. Duplicate shortCode on department creation -> 409
    const dupShortCodeCreateRes = await apiFetch('/admin/departments', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: {
        name: 'P3A Another Computer Science',
        shortCode: 'P3A_CSA', // Duplicate of deptA1!
        description: 'Duplicate short code test',
      },
    });
    assert.strictEqual(dupShortCodeCreateRes.status, 409, 'Creating department with duplicate shortCode must return HTTP 409');
    assert.ok(dupShortCodeCreateRes.data.message.includes('already exists for this college'));
    console.log('    POST /admin/departments with duplicate shortCode returned HTTP 409.');

    // 6b. Duplicate shortCode on department update -> 409
    const dupShortCodeUpdateRes = await apiFetch(`/admin/departments/${deptA2.id}`, {
      method: 'PATCH',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: {
        shortCode: 'P3A_CSA', // Updating deptA2 to deptA1's shortCode!
      },
    });
    assert.strictEqual(dupShortCodeUpdateRes.status, 409, 'Updating department to duplicate shortCode must return HTTP 409');
    assert.ok(dupShortCodeUpdateRes.data.message.includes('already exists for this college'));
    console.log('    PATCH /admin/departments/:departmentId with duplicate shortCode returned HTTP 409.');

    // 6c. Duplicate club name on club creation -> 409
    const dupClubCreateRes = await apiFetch('/admin/create-club', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: {
        name: 'P3A Tech Club A', // Duplicate name of clubDeptA!
        description: 'Duplicate name test',
      },
    });
    assert.strictEqual(dupClubCreateRes.status, 409, 'Creating club with duplicate name must return HTTP 409');
    assert.ok(dupClubCreateRes.data.message.includes('already exists for this college'));
    console.log('    POST /admin/create-club with duplicate name returned HTTP 409.');

    console.log('  ✔ Duplicate shortCode and club name constraints verified (HTTP 409).');

    // -------------------------------------------------------------------------
    // Test 7: Linking Another Tenant's Department Fails
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing Cross-Tenant Linking Rejection (Linking another tenant's department fails)...");

    // 7a. Try PUT /admin/clubs/:clubId/departments linking Dept B1 (College B) to Club A1 (College A)
    const crossLinkClubDeptsRes = await apiFetch(`/admin/clubs/${clubDeptA.id}/departments`, {
      method: 'PUT',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { departmentIds: [deptB1.id] }, // DeptB1 belongs to College B!
    });
    assert.strictEqual(crossLinkClubDeptsRes.status, 400, "Linking College B department to College A club must fail with HTTP 400");
    assert.ok(crossLinkClubDeptsRes.data.message.includes('One or more departments do not exist for this college'));
    console.log('    PUT /admin/clubs/:clubId/departments with other tenant department ID rejected with HTTP 400.');

    // 7b. Try PUT /admin/departments/:departmentId/clubs linking Club B1 (College B) to Dept A1 (College A)
    const crossLinkDeptClubsRes = await apiFetch(`/admin/departments/${deptA1.id}/clubs`, {
      method: 'PUT',
      tenantHost: 'lbrce.localhost',
      token: tokenAdminA,
      body: { clubIds: [clubDeptB.id] }, // ClubDeptB belongs to College B!
    });
    assert.strictEqual(crossLinkDeptClubsRes.status, 400, "Linking College B club to College A department must fail with HTTP 400");
    assert.ok(crossLinkDeptClubsRes.data.message.includes('One or more clubs do not exist for this college'));
    console.log('    PUT /admin/departments/:departmentId/clubs with other tenant club ID rejected with HTTP 400.');

    console.log("  ✔ Cross-tenant department and club linking attempts strictly rejected.");

    // -------------------------------------------------------------------------
    // Test 8: Serialization & Non-Zero Rows Checked Verification Summary
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Final Row Count Verification & Serializer Contract Assertions...');
    const totalRowsChecked = checkedClubsACount + checkedClubsBCount + checkedDeptsACount + checkedDeptsBCount + publicClubsACount + publicClubsBCount;
    console.log(`    Total rows checked across Phase 3a verification suite : ${totalRowsChecked}`);
    console.log(`      - College A admin clubs       : ${checkedClubsACount}`);
    console.log(`      - College B admin clubs       : ${checkedClubsBCount}`);
    console.log(`      - College A admin departments : ${checkedDeptsACount}`);
    console.log(`      - College B admin departments : ${checkedDeptsBCount}`);
    console.log(`      - College A public clubs      : ${publicClubsACount}`);
    console.log(`      - College B public clubs      : ${publicClubsBCount}`);

    assert.ok(checkedClubsACount > 0, 'FAIL: checkedClubsACount must be > 0');
    assert.ok(checkedClubsBCount > 0, 'FAIL: checkedClubsBCount must be > 0');
    assert.ok(checkedDeptsACount > 0, 'FAIL: checkedDeptsACount must be > 0');
    assert.ok(checkedDeptsBCount > 0, 'FAIL: checkedDeptsBCount must be > 0');
    assert.ok(publicClubsACount > 0, 'FAIL: publicClubsACount must be > 0');
    assert.ok(publicClubsBCount > 0, 'FAIL: publicClubsBCount must be > 0');
    assert.ok(totalRowsChecked >= 6, 'FAIL: Insufficient rows checked across tests');

    console.log('  ✔ All tests asserted rows checked > 0 with verified non-vacuous results.');

    console.log('\n======================================================================');
    console.log('ALL PHASE 3A TESTS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================\n');
  } finally {
    console.log('[CLEANUP] Cleaning up Phase 3a test fixtures from database...');
    try {
      await cleanupFixtures(collegeA, collegeB);
      console.log('  ✔ Fixtures cleaned up successfully.');
    } catch (cleanupErr) {
      console.error('  ⚠ Warning: Error during fixture cleanup:', cleanupErr.message);
    }
    server.close();
  }
}

runPhase3aTests().catch((err) => {
  console.error('\n❌ PHASE 3A TEST RUNNER FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
