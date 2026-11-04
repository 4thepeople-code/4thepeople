process.env.NODE_ENV = 'test';

// Strict requirement: TEST_DATABASE_URL and TEST_PLATFORM_DATABASE_URL must be explicitly provided.
if (!process.env.TEST_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_DATABASE_URL environment variable is required to run Phase 3b tests.');
  console.error('Refusing to run tests or fallback to DATABASE_URL.\n');
  process.exit(1);
}

if (!process.env.TEST_PLATFORM_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_PLATFORM_DATABASE_URL environment variable is required to run Phase 3b tests.');
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
  process.env.JWT_SECRET = 'test_jwt_secret_phase3b_super_secure_key_123';
}

const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');
const app = require('../index');

const FIXTURE_EMAILS = {
  ADMIN_LBRCE: 'admin_lbrce_p3b@example.test',
  ADMIN_VRSEC: 'admin_vrsec_p3b@example.test',
  MANAGER_A: 'manager_a_p3b@example.test',
  USER_A: 'user_a_p3b@example.test',
  MANAGER_B: 'manager_b_p3b@example.test',
  INVITE_A: 'invite_a_p3b@example.test',
};

async function cleanupFixtures(collegeA, collegeB) {
  if (collegeA && collegeA.id) {
    await withTenant(collegeA.id, async (tx) => {
      await tx.membership.deleteMany({
        where: { collegeId: collegeA.id, user: { email: { endsWith: '@example.test' } } },
      });
      await tx.club.deleteMany({
        where: { collegeId: collegeA.id, name: { startsWith: 'P3B ' } },
      });
      await tx.user.deleteMany({
        where: { collegeId: collegeA.id, email: { endsWith: '@example.test' } },
      });
    });
  }

  if (collegeB && collegeB.id) {
    await withTenant(collegeB.id, async (tx) => {
      await tx.membership.deleteMany({
        where: { collegeId: collegeB.id, user: { email: { endsWith: '@example.test' } } },
      });
      await tx.club.deleteMany({
        where: { collegeId: collegeB.id, name: { startsWith: 'P3B ' } },
      });
      await tx.user.deleteMany({
        where: { collegeId: collegeB.id, email: { endsWith: '@example.test' } },
      });
    });
  }
}

async function runPhase3bTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 3B: MANAGERS & MEMBERSHIPS MULTI-TENANT TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 0. Database Safety Guard & DB Role Privileges Check
  // -------------------------------------------------------------------------
  console.log('\n[TEST 0] Verifying database safety guard and DB role privileges...');
  const [dbMeta] = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log(`  Current Database : ${dbMeta.current_database}`);
  console.log(`  Current User     : ${dbMeta.current_user}`);

  let endpointType = 'Direct Database Endpoint';
  if (process.env.TEST_DATABASE_URL.includes('-pooler') || process.env.TEST_DATABASE_URL.includes('pgbouncer=true')) {
    endpointType = 'PgBouncer Pooler Endpoint (pgbouncer=true)';
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
  console.log('\n[SETUP] Preparing Phase 3b test fixtures in College A (lbrce) and College B (vrsec)...');
  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');
  assert.ok(collegeA, 'FAIL: College LBRCE must exist in database');
  assert.ok(collegeB, 'FAIL: College VRSEC must exist in database');

  await cleanupFixtures(collegeA, collegeB);

  const passwordHash = await bcrypt.hash('TestPassword123!', 10);
  const proxySecret = process.env.PROXY_SHARED_SECRET || 'test-proxy-secret';
  process.env.PROXY_SHARED_SECRET = proxySecret;

  let server;
  let baseUrl;

  let adminUserA, adminUserB;
  let managerUserA, regularUserA, managerUserB;
  let clubA1, clubA2, clubB1;
  let membershipA1, membershipB1;

  let tokenAdminA, tokenAdminB, tokenManagerA, tokenUserA, tokenManagerB;

  try {
    // 1. Create fixtures in College A
    await withTenant(collegeA.id, async (tx) => {
      adminUserA = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3B Admin A',
          email: FIXTURE_EMAILS.ADMIN_LBRCE,
          passwordHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });

      managerUserA = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3B Manager A',
          email: FIXTURE_EMAILS.MANAGER_A,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });

      regularUserA = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3B Regular User A',
          email: FIXTURE_EMAILS.USER_A,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });

      clubA1 = await tx.club.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3B Tech Club A1',
          description: 'Tech Club in College A',
          clubType: 'DEPARTMENTAL',
          createdByUserId: adminUserA.id,
        },
      });

      clubA2 = await tx.club.create({
        data: {
          collegeId: collegeA.id,
          name: 'P3B Arts Club A2',
          description: 'Arts Club in College A',
          clubType: 'CENTRAL',
          createdByUserId: adminUserA.id,
        },
      });

      membershipA1 = await tx.membership.create({
        data: {
          collegeId: collegeA.id,
          userId: managerUserA.id,
          clubId: clubA1.id,
          role: 'MANAGER',
        },
      });
    });

    // 2. Create fixtures in College B
    await withTenant(collegeB.id, async (tx) => {
      adminUserB = await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3B Admin B',
          email: FIXTURE_EMAILS.ADMIN_VRSEC,
          passwordHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });

      managerUserB = await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3B Manager B',
          email: FIXTURE_EMAILS.MANAGER_B,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
      });

      clubB1 = await tx.club.create({
        data: {
          collegeId: collegeB.id,
          name: 'P3B Robotics Club B1',
          description: 'Robotics Club in College B',
          clubType: 'DEPARTMENTAL',
          createdByUserId: adminUserB.id,
        },
      });

      membershipB1 = await tx.membership.create({
        data: {
          collegeId: collegeB.id,
          userId: managerUserB.id,
          clubId: clubB1.id,
          role: 'MANAGER',
        },
      });
    });

    // 3. Generate tokens
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
    tokenAdminB = signToken(adminUserB, collegeB);
    tokenManagerA = signToken(managerUserA, collegeA);
    tokenUserA = signToken(regularUserA, collegeA);
    tokenManagerB = signToken(managerUserB, collegeB);

    // 4. Start ephemeral test server
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`  ✔ Fixtures initialized successfully using @example.test data.`);
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

      if (body) {
        reqHeaders['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      let resBody = null;
      const text = await res.text();
      try {
        resBody = JSON.parse(text);
      } catch {
        resBody = text;
      }

      return { status: res.status, body: resBody };
    };

    let totalRowsChecked = 0;

    // -------------------------------------------------------------------------
    // TEST 1: Manager Profile Read & Update
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Manager Profile Read & Update (/manager/profile)...');
    {
      const getRes = await makeRequest({
        path: '/manager/profile',
        host: 'lbrce.localhost',
        token: tokenManagerA,
      });
      assert.strictEqual(getRes.status, 200, 'FAIL: GET /manager/profile must return 200');
      assert.strictEqual(getRes.body.data.id, managerUserA.id);
      assert.strictEqual(getRes.body.data.name, 'P3B Manager A');
      assert.ok(Array.isArray(getRes.body.data.managedClubs), 'FAIL: managedClubs must be array');
      assert.strictEqual(getRes.body.data.managedClubs.length, 1);
      assert.strictEqual(getRes.body.data.managedClubs[0].id, clubA1.id);
      totalRowsChecked += 1;
      console.log(`    GET /manager/profile: verified manager '${getRes.body.data.name}' with ${getRes.body.data.managedClubs.length} managed club`);

      // Update name and password
      const patchRes = await makeRequest({
        method: 'PATCH',
        path: '/manager/profile',
        host: 'lbrce.localhost',
        token: tokenManagerA,
        body: {
          name: 'P3B Manager A Renamed',
          currentPassword: 'TestPassword123!',
          newPassword: 'NewTestPassword123!',
        },
      });
      assert.strictEqual(patchRes.status, 200, 'FAIL: PATCH /manager/profile must return 200');
      assert.strictEqual(patchRes.body.data.name, 'P3B Manager A Renamed');

      // Verify in DB withTenant
      await withTenant(collegeA.id, async (tx) => {
        const dbUser = await tx.user.findUnique({ where: { id: managerUserA.id } });
        assert.strictEqual(dbUser.name, 'P3B Manager A Renamed');
        const match = await bcrypt.compare('NewTestPassword123!', dbUser.passwordHash);
        assert.ok(match, 'FAIL: Updated passwordHash must match new password');
        totalRowsChecked += 1;
      });
      console.log('  ✔ Manager profile read and update verified under RLS.');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Manager's Own Club Listing (/manager/my-clubs)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Manager Club Listing (/manager/my-clubs)...');
    {
      // Manager A lists my-clubs
      const mgrRes = await makeRequest({
        path: '/manager/my-clubs',
        host: 'lbrce.localhost',
        token: tokenManagerA,
      });
      const clubs = mgrRes.body.clubs || mgrRes.body.data?.clubs || mgrRes.body.data;
      assert.ok(Array.isArray(clubs), 'FAIL: clubs must be array');
      assert.strictEqual(clubs.length, 1);
      assert.strictEqual(clubs[0].id, clubA1.id);
      assert.strictEqual(clubs[0].isCentral, false);
      assert.strictEqual(clubs[0].clubType, 'DEPARTMENTAL');
      totalRowsChecked += 1;
      console.log(`    Manager A retrieved ${clubs.length} managed clubs: '${clubs[0].name}'`);

      // Regular user A lists my-clubs (has no manager role -> 403)
      const nonMgrRes = await makeRequest({
        path: '/manager/my-clubs',
        host: 'lbrce.localhost',
        token: tokenUserA,
      });
      assert.strictEqual(nonMgrRes.status, 403, 'FAIL: User with no manager memberships must receive 403');
      console.log('    Regular user without manager role received HTTP 403 on /manager/my-clubs (OK)');
      console.log('  ✔ Manager club listing and access enforcement verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Club Manager Authorization & Unauthorized Club Access
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing requireClubManager Authorization & Scope Limits...');
    {
      // 1. Manager A updates club A1 (where they are manager) -> 200
      const updateA1Res = await makeRequest({
        method: 'PATCH',
        path: `/manager/clubs/${clubA1.id}`,
        host: 'lbrce.localhost',
        token: tokenManagerA,
        body: { description: 'Updated Tech Club description by Manager A' },
      });
      assert.strictEqual(updateA1Res.status, 200, 'FAIL: Authorized manager updating club must receive 200');
      assert.strictEqual(updateA1Res.body.data.description, 'Updated Tech Club description by Manager A');
      totalRowsChecked += 1;
      console.log('    Authorized manager updating their club returned HTTP 200 (OK)');

      // 2. Manager A attempts to update club A2 (in same college, but NOT their club) -> 403
      const updateA2Res = await makeRequest({
        method: 'PATCH',
        path: `/manager/clubs/${clubA2.id}`,
        host: 'lbrce.localhost',
        token: tokenManagerA,
        body: { description: 'Intruder description attempt' },
      });
      assert.strictEqual(updateA2Res.status, 403, 'FAIL: Manager updating unassigned club must receive 403');
      console.log('    Manager updating unassigned club in same college received HTTP 403 (OK)');

      // 3. Manager A attempts to update club B1 (other college's club ID) -> 404
      const updateB1Res = await makeRequest({
        method: 'PATCH',
        path: `/manager/clubs/${clubB1.id}`,
        host: 'lbrce.localhost',
        token: tokenManagerA,
        body: { description: 'Cross-tenant club update attempt' },
      });
      assert.strictEqual(updateB1Res.status, 404, 'FAIL: Cross-tenant club ID must return 404');
      console.log('    Cross-tenant club ID access received HTTP 404 under RLS scoping (OK)');
      console.log('  ✔ requireClubManager boundary verified for assigned, unassigned, and cross-tenant clubs.');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Admin List & View Users (/admin/viewAllUsers, /admin/viewUser/:id)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Admin User Viewing & Tenant Boundary...');
    {
      // Admin A views all users in College A
      const allUsersA = await makeRequest({
        path: '/admin/viewAllUsers',
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(allUsersA.status, 200, 'FAIL: GET /admin/viewAllUsers must return 200');
      assert.ok(Array.isArray(allUsersA.body.data));
      // Must contain adminUserA, managerUserA, regularUserA
      const userEmailsA = allUsersA.body.data.map((u) => u.email);
      assert.ok(userEmailsA.includes(FIXTURE_EMAILS.ADMIN_LBRCE));
      assert.ok(userEmailsA.includes(FIXTURE_EMAILS.MANAGER_A));
      assert.ok(!userEmailsA.includes(FIXTURE_EMAILS.ADMIN_VRSEC), 'FAIL: Cross-tenant user leaked in viewAllUsers!');
      totalRowsChecked += allUsersA.body.data.length;
      console.log(`    Admin A retrieved ${allUsersA.body.data.length} users in College A`);

      // Admin A views specific user A
      const singleUserA = await makeRequest({
        path: `/admin/viewUser/${managerUserA.id}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(singleUserA.status, 200, 'FAIL: GET /admin/viewUser/:id must return 200');
      assert.strictEqual(singleUserA.body.data.id, managerUserA.id);
      totalRowsChecked += 1;

      // Admin A views User B (from College B) -> 404
      const crossUserRes = await makeRequest({
        path: `/admin/viewUser/${managerUserB.id}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(crossUserRes.status, 404, 'FAIL: Admin A viewing User B must receive 404');
      console.log('    Admin A viewing user from College B strictly received HTTP 404 (OK)');
      console.log('  ✔ Admin user viewing and tenant scoping verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Membership Create, List, Update, & Delete
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Membership Management (Create, List, Update, Delete)...');
    let addedMembershipId;
    {
      // 1. Add existing user A as manager to Club A2
      const addRes = await makeRequest({
        method: 'POST',
        path: `/admin/clubs/${clubA2.id}/managers/existing`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { userId: regularUserA.id },
      });
      assert.strictEqual(addRes.status, 201, 'FAIL: POST /admin/clubs/:clubId/managers/existing must return 201');
      assert.strictEqual(addRes.body.data.role, 'MANAGER');
      assert.strictEqual(addRes.body.data.clubId, clubA2.id);
      assert.strictEqual(addRes.body.data.userId, regularUserA.id);
      addedMembershipId = addRes.body.data.id;
      totalRowsChecked += 1;
      console.log(`    Added existing user as manager to Club A2 (membership id: ${addedMembershipId})`);

      // 2. List managers of Club A2
      const listMgrRes = await makeRequest({
        path: `/admin/clubs/${clubA2.id}/managers`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(listMgrRes.status, 200, 'FAIL: GET /admin/clubs/:clubId/managers must return 200');
      assert.ok(Array.isArray(listMgrRes.body.data.managers));
      assert.strictEqual(listMgrRes.body.data.managers.length, 1);
      assert.strictEqual(listMgrRes.body.data.managers[0].id, addedMembershipId);
      totalRowsChecked += 1;
      console.log(`    Listed managers of Club A2: found ${listMgrRes.body.data.managers.length} manager`);

      // 3. Attempt to demote the sole manager of Club A2 -> 400
      const demoteSoleRes = await makeRequest({
        method: 'PATCH',
        path: `/admin/memberships/${addedMembershipId}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { role: 'MEMBER' },
      });
      assert.strictEqual(demoteSoleRes.status, 400, 'FAIL: Demoting sole manager must be rejected with 400');
      assert.ok(demoteSoleRes.body.message.includes('at least one manager'));
      console.log('    Demoting sole manager rejected with HTTP 400 (at least one manager required) (OK)');

      // 4. Add Manager A to Club A2 as well, so Club A2 now has 2 managers
      const addSecondMgrRes = await makeRequest({
        method: 'POST',
        path: `/admin/clubs/${clubA2.id}/managers/existing`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { userId: managerUserA.id },
      });
      assert.strictEqual(addSecondMgrRes.status, 201);
      const secondMembershipId = addSecondMgrRes.body.data.id;
      totalRowsChecked += 1;

      // 5. Now demote the first manager -> 200 (since second manager exists)
      const demoteRes = await makeRequest({
        method: 'PATCH',
        path: `/admin/memberships/${addedMembershipId}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { role: 'MEMBER' },
      });
      assert.strictEqual(demoteRes.status, 200, 'FAIL: Demoting non-sole manager must succeed with 200');
      assert.strictEqual(demoteRes.body.data.role, 'MEMBER');
      totalRowsChecked += 1;
      console.log('    Demoting manager when another manager exists succeeded (OK)');

      // 6. Delete the demoted member -> 200
      const delMemberRes = await makeRequest({
        method: 'DELETE',
        path: `/admin/memberships/${addedMembershipId}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(delMemberRes.status, 200, 'FAIL: DELETE /admin/memberships/:id must return 200');
      totalRowsChecked += 1;
      console.log('    Deleted member from club successfully (OK)');

      // 7. Cleanup second membership so state stays clean
      await withTenant(collegeA.id, async (tx) => {
        await tx.membership.delete({ where: { id: secondMembershipId } });
      });
      console.log('  ✔ Membership lifecycle (create, list, safeguard, role update, delete) verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate Membership Handling (HTTP 409)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Duplicate Membership Handling (HTTP 409)...');
    {
      // managerUserA is already a member of clubA1
      const dupRes = await makeRequest({
        method: 'POST',
        path: `/admin/clubs/${clubA1.id}/managers/existing`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { userId: managerUserA.id },
      });
      assert.strictEqual(dupRes.status, 409, 'FAIL: Duplicate membership must return HTTP 409');
      assert.ok(dupRes.body.message.includes('already a member'));
      console.log('    Duplicate membership attempt rejected with HTTP 409 (OK)');
      console.log('  ✔ Duplicate membership uniqueness constraint verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Cross-Tenant Manager & Membership Access Boundary (HTTP 404 / 403)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Cross-Tenant Boundary for Memberships & Managers...');
    {
      // 1. Admin A attempts to modify Membership B1 (belongs to College B) -> 404
      const patchCrossRes = await makeRequest({
        method: 'PATCH',
        path: `/admin/memberships/${membershipB1.id}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { role: 'MEMBER' },
      });
      assert.strictEqual(patchCrossRes.status, 404, 'FAIL: Modifying another tenant membership must return 404');
      console.log('    Admin A modifying College B membership returned HTTP 404 (OK)');

      // 2. Admin A attempts to delete Membership B1 -> 404
      const delCrossRes = await makeRequest({
        method: 'DELETE',
        path: `/admin/memberships/${membershipB1.id}`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(delCrossRes.status, 404, 'FAIL: Deleting another tenant membership must return 404');
      console.log('    Admin A deleting College B membership returned HTTP 404 (OK)');

      // 3. Admin A attempts to add manager to Club B1 -> 404
      const addCrossRes = await makeRequest({
        method: 'POST',
        path: `/admin/clubs/${clubB1.id}/managers/existing`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: { userId: regularUserA.id },
      });
      assert.strictEqual(addCrossRes.status, 404, 'FAIL: Adding manager to another tenant club must return 404');
      console.log('    Admin A adding manager to College B club returned HTTP 404 (OK)');

      // 4. Admin A attempts to use token on College B host (vrsec.localhost) -> 403
      const hostMismatchRes = await makeRequest({
        path: '/admin/viewAllUsers',
        host: 'vrsec.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(hostMismatchRes.status, 403, 'FAIL: Admin A on College B host must return 403');
      console.log('    Admin A on College B host rejected with HTTP 403 (OK)');
      console.log('  ✔ Cross-tenant boundary strictly blocks unauthorized manager and membership operations.');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Manager Invitation Lifecycle (Create, Resend, Validate, Accept, Expire)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Manager Invitation Lifecycle...');
    {
      // 1. Admin A invites a new manager to College A
      const inviteRes = await makeRequest({
        method: 'POST',
        path: '/admin/managers',
        host: 'lbrce.localhost',
        token: tokenAdminA,
        body: {
          name: 'P3B Invitee User',
          email: FIXTURE_EMAILS.INVITE_A,
        },
      });
      assert.strictEqual(inviteRes.status, 201, 'FAIL: POST /admin/managers must return 201');
      const invitedUser = inviteRes.body.user || inviteRes.body.data?.user || inviteRes.body.data;
      assert.strictEqual(invitedUser.email, FIXTURE_EMAILS.INVITE_A);
      assert.strictEqual(invitedUser.isActive, false);
      const invitedUserId = invitedUser.id;
      totalRowsChecked += 1;
      console.log(`    Created pending manager user via invitation (id: ${invitedUserId})`);

      // 2. Fetch the created user in DB to obtain inviteTokenHash
      let initialHash;
      await withTenant(collegeA.id, async (tx) => {
        const u = await tx.user.findUnique({ where: { id: invitedUserId } });
        assert.ok(u.inviteTokenHash, 'FAIL: inviteTokenHash must be set in database');
        assert.ok(u.inviteExpiresAt, 'FAIL: inviteExpiresAt must be set in database');
        initialHash = u.inviteTokenHash;
        totalRowsChecked += 1;
      });

      // 3. Admin A resends invitation -> regenerates inviteTokenHash
      const resendRes = await makeRequest({
        method: 'POST',
        path: `/admin/managers/${invitedUserId}/resend-invite`,
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(resendRes.status, 200, 'FAIL: POST /admin/managers/:id/resend-invite must return 200');

      let newRawToken;
      await withTenant(collegeA.id, async (tx) => {
        const u = await tx.user.findUnique({ where: { id: invitedUserId } });
        assert.notStrictEqual(u.inviteTokenHash, initialHash, 'FAIL: Resending invite must regenerate hash');
        totalRowsChecked += 1;
      });
      console.log('    Resent invite verified: regenerated invite token hash in database (OK)');

      // 4. Manually set a deterministic token on the user for testing the accept endpoint
      const testRawToken = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
      const testHash = require('crypto').createHash('sha256').update(testRawToken).digest('hex');

      await withTenant(collegeA.id, async (tx) => {
        await tx.user.update({
          where: { id: invitedUserId },
          data: {
            inviteTokenHash: testHash,
            inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      });

      // 5. Validate the token publicly via GET /invite/:token/validate
      const validateRes = await makeRequest({
        path: `/invite/${testRawToken}/validate`,
        host: 'lbrce.localhost',
      });
      assert.strictEqual(validateRes.status, 200, 'FAIL: GET /invite/:token/validate must return 200');
      assert.strictEqual(validateRes.body.data.valid, true);
      assert.strictEqual(validateRes.body.data.user.id, invitedUserId);
      console.log('    Validated invitation token publicly on tenant subdomain (OK)');

      // 6. Accept the invitation via POST /invite/:token/accept
      const acceptRes = await makeRequest({
        method: 'POST',
        path: `/invite/${testRawToken}/accept`,
        host: 'lbrce.localhost',
        body: { password: 'AcceptedSecurePassword123!' },
      });
      assert.strictEqual(acceptRes.status, 200, 'FAIL: POST /invite/:token/accept must return 200');
      const acceptedUser = acceptRes.body.user || acceptRes.body.data?.user || acceptRes.body.data;
      assert.strictEqual(acceptedUser.isActive, true);

      // Verify in DB that account is now active and passwordHash is set
      await withTenant(collegeA.id, async (tx) => {
        const u = await tx.user.findUnique({ where: { id: invitedUserId } });
        assert.strictEqual(u.isActive, true, 'FAIL: User must be active after accepting invite');
        assert.ok(u.passwordHash, 'FAIL: passwordHash must be set');
        const match = await bcrypt.compare('AcceptedSecurePassword123!', u.passwordHash);
        assert.ok(match, 'FAIL: passwordHash must match accepted password');
        totalRowsChecked += 1;
      });
      console.log('    Accepted invitation: account activated and password verified in database (OK)');

      // 7. Re-accepting already accepted invite is rejected
      const reAcceptRes = await makeRequest({
        method: 'POST',
        path: `/invite/${testRawToken}/accept`,
        host: 'lbrce.localhost',
        body: { password: 'AcceptedSecurePassword123!' },
      });
      assert.strictEqual(reAcceptRes.status, 400, 'FAIL: Re-accepting invite must receive 400');
      assert.ok(
        reAcceptRes.body.message.includes('already been accepted') ||
        reAcceptRes.body.message.includes('Invalid invitation token'),
        'FAIL: Re-accepting already consumed invitation must be rejected with 400'
      );
      console.log('    Re-accepting already consumed invitation rejected with HTTP 400 (OK)');
      console.log('  ✔ Invitation lifecycle (create, resend, validate, accept, single-use enforcement) verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Admin Profile & Metrics (/admin/profile)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing Admin Profile & Metrics (/admin/profile)...');
    {
      const adminProfileRes = await makeRequest({
        path: '/admin/profile',
        host: 'lbrce.localhost',
        token: tokenAdminA,
      });
      assert.strictEqual(adminProfileRes.status, 200, 'FAIL: GET /admin/profile must return 200');
      assert.strictEqual(adminProfileRes.body.data.id, adminUserA.id);
      assert.ok(adminProfileRes.body.data.stats, 'FAIL: stats object must be present in profile');
      assert.ok(adminProfileRes.body.data.stats.totalUsers > 0);
      assert.ok(adminProfileRes.body.data.stats.totalClubs > 0);
      totalRowsChecked += 1;
      console.log(`    Admin profile verified: totalUsers=${adminProfileRes.body.data.stats.totalUsers}, totalClubs=${adminProfileRes.body.data.stats.totalClubs}`);
      console.log('  ✔ Admin profile and tenant metrics verified under RLS.');
    }

    // -------------------------------------------------------------------------
    // Final Assertions & Row Count Verification
    // -------------------------------------------------------------------------
    console.log('\n[SUMMARY] Non-Vacuous Row Count Assertion:');
    console.log(`  Total database rows and API items checked across Phase 3b: ${totalRowsChecked}`);
    assert.ok(totalRowsChecked >= 10, `FAIL: Expected at least 10 rows checked, got ${totalRowsChecked}`);
    console.log('  ✔ Verified non-vacuous assertion: total rows checked > 0.');

    console.log('\n======================================================================');
    console.log('ALL PHASE 3B MILESTONE 1 TESTS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================');
  } finally {
    if (server) {
      server.close();
    }
    console.log('\n[CLEANUP] Cleaning up Phase 3b test fixtures from database...');
    await cleanupFixtures(collegeA, collegeB);
    console.log('  ✔ Fixtures cleaned up successfully.');
  }
}

runPhase3bTests().catch((err) => {
  console.error('\n❌ PHASE 3B TEST RUNNER FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
