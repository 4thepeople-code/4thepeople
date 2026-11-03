// Database URLs for local test run (must be set BEFORE any internal modules load PrismaClient)
const LOCAL_APP_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://app_user:app_user_local_pass@127.0.0.1:5432/yuva_test?schema=public&pgbouncer=true';
const LOCAL_PLATFORM_URL =
  process.env.TEST_PLATFORM_DATABASE_URL ||
  'postgresql://platform_ops:platform_ops_local_pass@127.0.0.1:5432/yuva_test?schema=public';

process.env.DATABASE_URL = LOCAL_APP_URL;
process.env.PLATFORM_DATABASE_URL = LOCAL_PLATFORM_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_college_jwt_secret_key_123456789';
process.env.PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'test_platform_jwt_secret_key_987654321';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const bcrypt = require('bcryptjs');
const app = require('../index');
const { withTenant } = require('../config/db');
const { platformPrisma } = require('../config/platformDb');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');

async function runPhase2Tests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 2: AUTHENTICATION & AUTHORIZATION TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 0. Safety Guard & Role Privilege Check
  // -------------------------------------------------------------------------
  console.log('\n[TEST 0] Verifying database safety guard and DB role privileges...');
  const [dbMeta] = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log(`  Current Database : ${dbMeta.current_database}`);
  console.log(`  Current User     : ${dbMeta.current_user}`);

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
  // 1. Setup Test Fixtures (Colleges, Users, Memberships, Platform Admin)
  // -------------------------------------------------------------------------
  console.log('\n[SETUP] Preparing test fixtures in College A (lbrce), College B (vrsec), and Platform...');
  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');
  assert.ok(collegeA, 'FAIL: College A (lbrce) must exist');
  assert.ok(collegeB, 'FAIL: College B (vrsec) must exist');

  const ADMIN_PASSWORD = 'AdminPassword123!';
  const MANAGER_PASSWORD = 'ManagerPassword123!';
  const INACTIVE_PASSWORD = 'InactivePassword123!';
  const PLATFORM_ADMIN_PASSWORD = 'SuperSecretPlatform123!';

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const managerHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  const inactiveHash = await bcrypt.hash(INACTIVE_PASSWORD, 10);
  const platformAdminHash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 10);

  // Setup College A users
  await withTenant(collegeA.id, async (tx) => {
    // 1. College A Admin
    const existingAdmin = await tx.user.findFirst({
      where: { collegeId: collegeA.id, email: 'admin@lbrce.in' },
    });
    if (existingAdmin) {
      await tx.user.update({
        where: { id: existingAdmin.id },
        data: { passwordHash: adminHash, role: 'COLLEGE_ADMIN', isActive: true },
      });
    } else {
      await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'LBRCE Admin',
          email: 'admin@lbrce.in',
          passwordHash: adminHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });
    }

    // 2. College A Club & Manager
    let clubA = await tx.club.findFirst({ where: { collegeId: collegeA.id } });
    let existingManager = await tx.user.findFirst({
      where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
    });
    let managerId;
    if (existingManager) {
      await tx.user.update({
        where: { id: existingManager.id },
        data: { passwordHash: managerHash, role: 'USER', isActive: true },
      });
      managerId = existingManager.id;
    } else {
      const created = await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'LBRCE Tech Manager',
          email: 'manager@lbrce.in',
          passwordHash: managerHash,
          role: 'USER',
          isActive: true,
        },
      });
      managerId = created.id;
    }

    if (clubA) {
      const existingMembership = await tx.membership.findFirst({
        where: { collegeId: collegeA.id, userId: managerId, clubId: clubA.id },
      });
      if (!existingMembership) {
        await tx.membership.create({
          data: {
            collegeId: collegeA.id,
            userId: managerId,
            clubId: clubA.id,
            role: 'MANAGER',
          },
        });
      }
    }

    // 3. College A Inactive User
    const existingInactive = await tx.user.findFirst({
      where: { collegeId: collegeA.id, email: 'inactive@lbrce.in' },
    });
    if (existingInactive) {
      await tx.user.update({
        where: { id: existingInactive.id },
        data: { passwordHash: inactiveHash, role: 'USER', isActive: false },
      });
    } else {
      await tx.user.create({
        data: {
          collegeId: collegeA.id,
          name: 'LBRCE Inactive',
          email: 'inactive@lbrce.in',
          passwordHash: inactiveHash,
          role: 'USER',
          isActive: false,
        },
      });
    }
  });

  // Setup College B users
  await withTenant(collegeB.id, async (tx) => {
    const existingAdminB = await tx.user.findFirst({
      where: { collegeId: collegeB.id, email: 'admin@vrsec.in' },
    });
    if (existingAdminB) {
      await tx.user.update({
        where: { id: existingAdminB.id },
        data: { passwordHash: adminHash, role: 'COLLEGE_ADMIN', isActive: true },
      });
    } else {
      await tx.user.create({
        data: {
          collegeId: collegeB.id,
          name: 'VRSEC Admin',
          email: 'admin@vrsec.in',
          passwordHash: adminHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });
    }
  });

  // Setup Platform Admin (using platformPrisma BYPASSRLS client)
  const existingPlatformAdmin = await platformPrisma.platformAdmin.findUnique({
    where: { email: 'superadmin@platform.yuva' },
  });
  if (existingPlatformAdmin) {
    await platformPrisma.platformAdmin.update({
      where: { id: existingPlatformAdmin.id },
      data: { passwordHash: platformAdminHash, isActive: true },
    });
  } else {
    await platformPrisma.platformAdmin.create({
      data: {
        name: 'Platform Super Admin',
        email: 'superadmin@platform.yuva',
        passwordHash: platformAdminHash,
        isActive: true,
      },
    });
  }
  console.log('  ✔ Fixtures initialized successfully across all roles.');

  // Start ephemeral Express HTTP server
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  ✔ Ephemeral test server active on ${baseUrl}`);

  /**
   * Helper function to dispatch HTTP requests with explicit host mapping.
   */
  async function apiFetch(reqPath, options = {}) {
    const host = options.tenantHost || 'lbrce.localhost';
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...options.headers,
    };
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
    let collegeAdminToken = null;
    let collegeManagerToken = null;
    let platformAdminToken = null;

    // -------------------------------------------------------------------------
    // Test 1: College Admin Login
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing College Admin Login (/auth/admin/login)...');
    const adminLoginRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'admin@lbrce.in',
        password: ADMIN_PASSWORD,
      },
    });

    const adminData = adminLoginRes.data.data || adminLoginRes.data;
    assert.strictEqual(adminLoginRes.status, 200, `Expected 200, got ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.data)}`);
    assert.strictEqual(adminLoginRes.data.success, true);
    assert.ok(adminData.token, 'Expected JWT token in response');
    assert.strictEqual(adminData.user.role, 'COLLEGE_ADMIN');
    assert.strictEqual(adminData.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.strictEqual(adminData.user.password, undefined);

    // Verify Set-Cookie header for yuva_token
    const cookieHeader = adminLoginRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('yuva_token='), 'Expected yuva_token Set-Cookie header');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');

    collegeAdminToken = adminData.token;
    console.log('  ✔ College Admin logged in successfully with COLLEGE_ADMIN claim and HttpOnly cookie.');

    // -------------------------------------------------------------------------
    // Test 2: College Manager / User Login
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing College Manager / User Login (/auth/manager/login)...');
    const mgrLoginRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'manager@lbrce.in',
        password: MANAGER_PASSWORD,
      },
    });

    const mgrData = mgrLoginRes.data.data || mgrLoginRes.data;
    assert.strictEqual(mgrLoginRes.status, 200, `Expected 200, got ${mgrLoginRes.status}: ${JSON.stringify(mgrLoginRes.data)}`);
    assert.strictEqual(mgrLoginRes.data.success, true);
    assert.ok(mgrData.token);
    assert.strictEqual(mgrData.user.role, 'USER');
    assert.strictEqual(mgrData.user.passwordHash, undefined);

    collegeManagerToken = mgrData.token;
    console.log('  ✔ College Manager logged in successfully with USER claim.');

    // -------------------------------------------------------------------------
    // Test 3: Invalid Password Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Invalid Password Rejection...');
    const badPasswordRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'admin@lbrce.in',
        password: 'CompletelyWrongPassword!',
      },
    });

    assert.strictEqual(badPasswordRes.status, 401);
    assert.strictEqual(badPasswordRes.data.success, false);
    assert.strictEqual(badPasswordRes.data.message, 'Invalid email or password');
    console.log('  ✔ Invalid password rejected with HTTP 401.');

    // -------------------------------------------------------------------------
    // Test 4: Inactive Account Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Inactive Account Rejection...');
    const inactiveRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'inactive@lbrce.in',
        password: INACTIVE_PASSWORD,
      },
    });

    assert.strictEqual(inactiveRes.status, 403);
    assert.strictEqual(inactiveRes.data.success, false);
    assert.ok(inactiveRes.data.message.includes('inactive'));
    console.log('  ✔ Inactive account rejected with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 5: Password Reset Flow (OTP Expiry & Brute Force Protection)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Password Reset Flow, OTP Expiry & Brute Force Protection...');

    // 5a. Request reset OTP
    const resetReqRes = await apiFetch('/auth/manager/forgot-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: 'manager@lbrce.in' },
    });
    assert.strictEqual(resetReqRes.status, 200);

    // Retrieve the generated OTP hash directly from DB
    let userState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
        select: { passwordResetOtpHash: true, passwordResetOtpExpiresAt: true, passwordResetAttempts: true },
      });
    });
    assert.ok(userState.passwordResetOtpHash, 'Expected passwordResetOtpHash in database');
    assert.strictEqual(userState.passwordResetAttempts, 0);

    // 5b. Invalid OTP attempt (should increment attempts count)
    const badOtpRes = await apiFetch('/auth/manager/reset-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'manager@lbrce.in',
        otp: '000000',
        password: 'NewPassword123!',
      },
    });
    assert.strictEqual(badOtpRes.status, 400);

    userState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
        select: { passwordResetAttempts: true },
      });
    });
    assert.strictEqual(userState.passwordResetAttempts, 1);
    console.log('  ✔ Bad OTP attempt incremented failed attempts counter to 1.');

    // 5c. Simulate 5 consecutive failed attempts (brute-force lockout)
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.updateMany({
        where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
        data: { passwordResetAttempts: 5 },
      });
    });

    const lockoutRes = await apiFetch('/auth/manager/reset-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'manager@lbrce.in',
        otp: '123456',
        password: 'NewPassword123!',
      },
    });
    assert.strictEqual(lockoutRes.status, 400);
    assert.ok(lockoutRes.data.message.includes('Too many failed attempts'));

    // Verify OTP was cleared
    userState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
        select: { passwordResetOtpHash: true },
      });
    });
    assert.strictEqual(userState.passwordResetOtpHash, null, 'OTP must be cleared on brute-force threshold');
    console.log('  ✔ Brute force threshold (5 attempts) invalidated OTP.');

    // 5d. Successful reset with valid OTP
    const validOtp = '777888';
    const validOtpHash = require('crypto').createHash('sha256').update(validOtp).digest('hex');
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.updateMany({
        where: { collegeId: collegeA.id, email: 'manager@lbrce.in' },
        data: {
          passwordResetOtpHash: validOtpHash,
          passwordResetOtpExpiresAt: new Date(Date.now() + 600000),
          passwordResetAttempts: 0,
        },
      });
    });

    const resetSuccessRes = await apiFetch('/auth/manager/reset-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'manager@lbrce.in',
        otp: validOtp,
        password: 'NewlyUpdatedManagerPassword456!',
      },
    });
    assert.strictEqual(resetSuccessRes.status, 200);

    // Verify login with new password succeeds
    const newLoginRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: 'manager@lbrce.in',
        password: 'NewlyUpdatedManagerPassword456!',
      },
    });
    assert.strictEqual(newLoginRes.status, 200);
    console.log('  ✔ Password reset succeeded and login with new password verified.');

    // -------------------------------------------------------------------------
    // Test 6: Cross-Tenant Subdomain Token Rejection (College A token on College B)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Cross-Tenant Subdomain Token Rejection (College A token on College B)...');
    const crossTenantRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'vrsec.localhost', // Target subdomain is VRSEC, but token was issued for LBRCE
      headers: {
        Authorization: `Bearer ${collegeAdminToken}`,
      },
    });

    assert.strictEqual(crossTenantRes.status, 403, 'Cross-tenant token must be rejected with HTTP 403');
    assert.strictEqual(crossTenantRes.data.success, false);
    assert.ok(
      crossTenantRes.data.message.includes('Token belongs to a different college tenant'),
      `Unexpected error message: ${crossTenantRes.data.message}`
    );
    console.log('  ✔ College A token strictly rejected on College B subdomain with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 7: College Token Rejected on Platform Routes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing College Token Rejected on Platform Routes (/api/platform/auth/me)...');
    const collegeTokenOnPlatformRes = await apiFetch('/api/platform/auth/me', {
      method: 'GET',
      tenantHost: 'admin.4thepeople.in',
      headers: {
        Authorization: `Bearer ${collegeAdminToken}`,
      },
    });

    assert.ok(
      collegeTokenOnPlatformRes.status === 401 || collegeTokenOnPlatformRes.status === 403,
      `Expected 401/403, got ${collegeTokenOnPlatformRes.status}`
    );
    assert.strictEqual(collegeTokenOnPlatformRes.data.success, false);
    console.log('  ✔ College token rejected on platform routes (signature mismatch / type isolation).');

    // -------------------------------------------------------------------------
    // Test 8: Platform Admin Login & Token Acquisition
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Platform Super-Admin Login (/api/platform/auth/login)...');
    const platformLoginRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: 'superadmin@platform.yuva',
        password: PLATFORM_ADMIN_PASSWORD,
      },
    });

    const platformData = platformLoginRes.data.data || platformLoginRes.data;
    assert.strictEqual(platformLoginRes.status, 200, `Expected 200, got: ${JSON.stringify(platformLoginRes.data)}`);
    assert.strictEqual(platformLoginRes.data.success, true);
    assert.ok(platformData.token, 'Expected platform JWT token');
    assert.strictEqual(platformData.admin.role, 'PLATFORM_SUPER_ADMIN');

    const platformCookie = platformLoginRes.headers.get('set-cookie');
    assert.ok(platformCookie && platformCookie.includes('yuva_platform_token='), 'Expected yuva_platform_token cookie');
    assert.ok(platformCookie.includes('HttpOnly'));

    platformAdminToken = platformData.token;

    // Verify GET /api/platform/auth/me with platform token
    const meRes = await apiFetch('/api/platform/auth/me', {
      method: 'GET',
      tenantHost: 'admin.4thepeople.in',
      headers: {
        Authorization: `Bearer ${platformAdminToken}`,
      },
    });
    const meData = meRes.data.data || meRes.data;
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.admin.email, 'superadmin@platform.yuva');
    console.log('  ✔ Platform Super-Admin logged in and authenticated successfully.');

    // -------------------------------------------------------------------------
    // Test 9: Platform Token Rejected on College Routes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing Platform Token Rejected on College Routes...');
    const platformOnCollegeRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: `Bearer ${platformAdminToken}`,
      },
    });

    assert.ok(
      platformOnCollegeRes.status === 401 || platformOnCollegeRes.status === 403,
      `Expected 401 or 403, got ${platformOnCollegeRes.status}`
    );
    assert.strictEqual(platformOnCollegeRes.data.success, false);
    console.log('  ✔ Platform token strictly rejected on college routes with HTTP 401/403.');

    // -------------------------------------------------------------------------
    // Test 10: Platform Admin Logout & Cookie Clearing
    // -------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Platform Admin Logout (/api/platform/auth/logout)...');
    const platformLogoutRes = await apiFetch('/api/platform/auth/logout', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
    });
    assert.strictEqual(platformLogoutRes.status, 200);
    const platformLogoutCookie = platformLogoutRes.headers.get('set-cookie');
    assert.ok(
      platformLogoutCookie && (platformLogoutCookie.includes('yuva_platform_token=;') || platformLogoutCookie.includes('Max-Age=0')),
      'yuva_platform_token cookie must be cleared on logout'
    );
    console.log('  ✔ Platform Admin logout cleared yuva_platform_token cookie.');

    // -------------------------------------------------------------------------
    // Test 11: Missing and Invalid JWT Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 11] Testing Missing and Malformed JWT Rejection...');
    // 11a. Missing token
    const missingTokenRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(missingTokenRes.status, 401);

    // 11b. Malformed token
    const malformedTokenRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: 'Bearer this-is-not-a-valid-jwt-token',
      },
    });
    assert.strictEqual(malformedTokenRes.status, 401);
    console.log('  ✔ Missing and malformed tokens rejected with HTTP 401.');

    // -------------------------------------------------------------------------
    // Test 12: Zero Cross-Tenant User Lookup via RLS
    // -------------------------------------------------------------------------
    console.log('\n[TEST 12] Testing Zero Cross-Tenant User Lookup under RLS...');
    await withTenant(collegeA.id, async (tx) => {
      // Query VRSEC admin from inside LBRCE tenant context
      const crossUser = await tx.user.findFirst({
        where: { email: 'admin@vrsec.in' },
      });
      assert.strictEqual(crossUser, null, 'FAIL: RLS Leak! VRSEC user row was visible under LBRCE context!');

      const allUsers = await tx.user.findMany({ select: { collegeId: true } });
      for (const u of allUsers) {
        assert.strictEqual(
          u.collegeId,
          collegeA.id,
          `FAIL: Row collegeId ${u.collegeId} does not match tenant ${collegeA.id}`
        );
      }
    });
    console.log('  ✔ Zero cross-tenant user visibility confirmed under RLS.');

    // -------------------------------------------------------------------------
    // Test 13: Confirmation of Public College Admin Registration Removal
    // -------------------------------------------------------------------------
    console.log('\n[TEST 13] Verifying Public College Admin Registration Endpoint is Removed...');
    const registerRes = await apiFetch('/auth/admin/register', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        name: 'Hacker',
        email: 'hacker@lbrce.in',
        password: 'Password123!',
      },
    });
    assert.strictEqual(
      registerRes.status,
      404,
      `POST /auth/admin/register must return 404 (removed). Got ${registerRes.status}`
    );
    console.log('  ✔ Public college admin registration endpoint (/auth/admin/register) confirmed removed (HTTP 404).');

    console.log('\n======================================================================');
    console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runPhase2Tests().catch((err) => {
  console.error('\n❌ PHASE 2 TEST RUNNER FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
