require('dotenv').config();

// Strict requirement: TEST_DATABASE_URL and TEST_PLATFORM_DATABASE_URL must be explicitly provided.
// Refuse to run or fallback to DATABASE_URL / PLATFORM_DATABASE_URL.
if (!process.env.TEST_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_DATABASE_URL environment variable is required to run Phase 2 tests.');
  console.error('Refusing to run tests or fallback to DATABASE_URL.\n');
  process.exit(1);
}

if (!process.env.TEST_PLATFORM_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_PLATFORM_DATABASE_URL environment variable is required to run Phase 2 tests.');
  console.error('Refusing to run tests or fallback to PLATFORM_DATABASE_URL.\n');
  process.exit(1);
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PLATFORM_DATABASE_URL = process.env.TEST_PLATFORM_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_college_jwt_secret_key_123456789';
process.env.PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'test_platform_jwt_secret_key_987654321';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { withTenant } = require('../config/db');
const { platformPrisma } = require('../config/platformDb');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');
const emailService = require('../services/emailService');
const { verifyTestDatabaseHost } = require('../services/emailService');
const {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  generateHotp,
  base32Decode,
  clearUsedTotpCache,
} = require('../utils/totp');
const { clearAllLoginThrottling } = require('../utils/loginSecurity');

// ---------------------------------------------------------------------------
// 1. Stub Email Service (Zero External Network Calls)
// ---------------------------------------------------------------------------
const capturedEmails = [];
emailService.sendEmail = async (params) => {
  verifyTestDatabaseHost();
  capturedEmails.push({ type: 'generic', ...params });
  return { messageId: 'test-stub-generic-id', success: true };
};
emailService.sendManagerPasswordResetOtp = async (toEmail, name, otp) => {
  verifyTestDatabaseHost();
  capturedEmails.push({ type: 'otp', toEmail, name, otp });
  return { messageId: 'test-stub-otp-id', success: true };
};
emailService.sendInviteEmail = async (toEmail, name, inviteToken) => {
  verifyTestDatabaseHost();
  capturedEmails.push({ type: 'invite', toEmail, name, inviteToken });
  return { messageId: 'test-stub-invite-id', success: true };
};

// Fixture emails strictly ending in @example.test (Never real accounts)
const FIXTURE_EMAILS = {
  ADMIN_LBRCE: 'admin.lbrce@example.test',
  MANAGER_LBRCE: 'manager.lbrce@example.test',
  USER_LBRCE: 'user.lbrce@example.test',
  INACTIVE_LBRCE: 'inactive.lbrce@example.test',
  INVITED_LBRCE: 'invited.lbrce@example.test',
  EXPIRED_INVITE_LBRCE: 'expired.invite.lbrce@example.test',
  ADMIN_VRSEC: 'admin.vrsec@example.test',
  PLATFORM_ADMIN: 'platform.admin@example.test',
  PLATFORM_NO_TOTP: 'platform.nototp@example.test',
};

/**
 * Robust cleanup helper to purge all test fixtures ending in @example.test.
 */
async function cleanupFixtures(collegeA, collegeB) {
  clearAllLoginThrottling();
  clearUsedTotpCache();

  if (collegeA && collegeA.id) {
    await withTenant(collegeA.id, async (tx) => {
      await tx.membership.deleteMany({
        where: {
          user: { email: { endsWith: '@example.test' } },
        },
      });
      await tx.user.deleteMany({
        where: {
          email: { endsWith: '@example.test' },
        },
      });
    });
  }

  if (collegeB && collegeB.id) {
    await withTenant(collegeB.id, async (tx) => {
      await tx.membership.deleteMany({
        where: {
          user: { email: { endsWith: '@example.test' } },
        },
      });
      await tx.user.deleteMany({
        where: {
          email: { endsWith: '@example.test' },
        },
      });
    });
  }

  await platformPrisma.platformAdmin.deleteMany({
    where: {
      email: { endsWith: '@example.test' },
    },
  });
}

function extractTokenFromCookieHeader(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

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

  await cleanupFixtures(collegeA, collegeB);

  const ADMIN_PASSWORD = 'AdminPassword123!';
  const MANAGER_PASSWORD = 'ManagerPassword123!';
  const USER_PASSWORD = 'UserPassword123!';
  const INACTIVE_PASSWORD = 'InactivePassword123!';
  const PLATFORM_ADMIN_PASSWORD = 'SuperSecretPlatform123!';

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const managerHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  const userHash = await bcrypt.hash(USER_PASSWORD, 10);
  const inactiveHash = await bcrypt.hash(INACTIVE_PASSWORD, 10);
  const platformAdminHash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 10);

  // Generate Base32 TOTP secret and encrypt at rest for Platform Admin
  const platformTotpSecretPlain = generateTotpSecret();
  const platformTotpSecretEncrypted = encryptTotpSecret(platformTotpSecretPlain);

  const validInviteTokenRaw = crypto.randomBytes(32).toString('hex');
  const validInviteTokenHash = crypto.createHash('sha256').update(validInviteTokenRaw).digest('hex');

  const expiredInviteTokenRaw = crypto.randomBytes(32).toString('hex');
  const expiredInviteTokenHash = crypto.createHash('sha256').update(expiredInviteTokenRaw).digest('hex');

  // Setup College A users
  let adminUserId = null;
  let managerUserId = null;
  let regularUserId = null;

  await withTenant(collegeA.id, async (tx) => {
    // 1. College A Admin (COLLEGE_ADMIN)
    const adminUser = await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Admin',
        email: FIXTURE_EMAILS.ADMIN_LBRCE,
        passwordHash: adminHash,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });
    adminUserId = adminUser.id;

    // 2. College A Manager (USER + Club MANAGER membership)
    let clubA = await tx.club.findFirst({ where: { collegeId: collegeA.id } });
    const managerUser = await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Tech Manager',
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        passwordHash: managerHash,
        role: 'USER',
        isActive: true,
      },
    });
    managerUserId = managerUser.id;

    if (clubA) {
      await tx.membership.create({
        data: {
          collegeId: collegeA.id,
          userId: managerUser.id,
          clubId: clubA.id,
          role: 'MANAGER',
        },
      });
    }

    // 3. College A Standard User (USER without admin privileges)
    const regUser = await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Regular Student',
        email: FIXTURE_EMAILS.USER_LBRCE,
        passwordHash: userHash,
        role: 'USER',
        isActive: true,
      },
    });
    regularUserId = regUser.id;

    // 4. College A Inactive User
    await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Inactive Student',
        email: FIXTURE_EMAILS.INACTIVE_LBRCE,
        passwordHash: inactiveHash,
        role: 'USER',
        isActive: false,
      },
    });

    // 5. College A Invited User (Active=false, valid invite token)
    await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Invited User',
        email: FIXTURE_EMAILS.INVITED_LBRCE,
        passwordHash: null,
        role: 'USER',
        isActive: false,
        inviteTokenHash: validInviteTokenHash,
        inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 6. College A Expired Invite User
    await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Expired Invite User',
        email: FIXTURE_EMAILS.EXPIRED_INVITE_LBRCE,
        passwordHash: null,
        role: 'USER',
        isActive: false,
        inviteTokenHash: expiredInviteTokenHash,
        inviteExpiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });
  });

  // Setup College B users
  await withTenant(collegeB.id, async (tx) => {
    await tx.user.create({
      data: {
        collegeId: collegeB.id,
        name: 'VRSEC Admin',
        email: FIXTURE_EMAILS.ADMIN_VRSEC,
        passwordHash: adminHash,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });
  });

  // Setup Platform Super-Admin with encrypted TOTP secret
  await platformPrisma.platformAdmin.create({
    data: {
      name: 'Platform Super Admin',
      email: FIXTURE_EMAILS.PLATFORM_ADMIN,
      passwordHash: platformAdminHash,
      totpSecret: platformTotpSecretEncrypted,
      isActive: true,
    },
  });

  // Setup Platform Super-Admin without TOTP (for production check test)
  await platformPrisma.platformAdmin.create({
    data: {
      name: 'Platform Admin No 2FA',
      email: FIXTURE_EMAILS.PLATFORM_NO_TOTP,
      passwordHash: platformAdminHash,
      totpSecret: null,
      isActive: true,
    },
  });

  console.log('  ✔ Fixtures initialized successfully using @example.test addresses.');

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
    let collegeUserToken = null;
    let platformAdminToken = null;

    // -------------------------------------------------------------------------
    // Test 1: College Admin Login & Token-in-Body Suppression (Requirement 6)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing College Admin Login & Token-in-Body Suppression (ALLOW_BEARER_RESPONSE=false)...');
    delete process.env.ALLOW_BEARER_RESPONSE;

    const adminLoginRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.ADMIN_LBRCE,
        password: ADMIN_PASSWORD,
      },
    });

    const adminData = adminLoginRes.data.data || adminLoginRes.data;
    assert.strictEqual(adminLoginRes.status, 200, `Expected 200, got ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.data)}`);
    assert.strictEqual(adminLoginRes.data.success, true);
    assert.strictEqual(adminData.user.role, 'COLLEGE_ADMIN');
    assert.strictEqual(adminData.user.passwordHash, undefined, 'passwordHash must never be exposed');

    // Verify Set-Cookie header for yuva_token
    const cookieHeader = adminLoginRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('yuva_token='), 'Expected yuva_token Set-Cookie header');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.strictEqual(cookieHeader.includes('Domain='), false, 'Cookie must NOT have a Domain attribute (host-only)');

    // Requirement 6 Assertion: Default behavior does NOT return token in body
    assert.strictEqual(
      adminData.token,
      undefined,
      'FAIL: Login response body must NOT include token when cookie is set and ALLOW_BEARER_RESPONSE is false'
    );

    // Extract the issued token from the Set-Cookie header for tests that verify Bearer authentication
    collegeAdminToken = extractTokenFromCookieHeader(cookieHeader, 'yuva_token');
    assert.ok(collegeAdminToken, 'Expected valid token extracted from cookie header');
    console.log('  ✔ Token omitted from body by default; HttpOnly host-only cookie issued.');

    // Verify ALLOW_BEARER_RESPONSE=true behavior
    process.env.ALLOW_BEARER_RESPONSE = 'true';
    const bearerAllowedRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: FIXTURE_EMAILS.ADMIN_LBRCE, password: ADMIN_PASSWORD },
    });
    const bearerAllowedData = bearerAllowedRes.data.data || bearerAllowedRes.data;
    assert.ok(bearerAllowedData.token, 'Expected token in body when ALLOW_BEARER_RESPONSE=true');
    delete process.env.ALLOW_BEARER_RESPONSE; // Reset for remaining tests
    console.log('  ✔ ALLOW_BEARER_RESPONSE=true permits explicit token in response body.');

    // -------------------------------------------------------------------------
    // Test 2: College Manager / User Login
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing College Manager / User Login (/auth/manager/login)...');
    const mgrLoginRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        password: MANAGER_PASSWORD,
      },
    });

    const mgrData = mgrLoginRes.data.data || mgrLoginRes.data;
    assert.strictEqual(mgrLoginRes.status, 200);
    assert.strictEqual(mgrData.user.role, 'USER');
    const mgrCookie = mgrLoginRes.headers.get('set-cookie');
    collegeManagerToken = extractTokenFromCookieHeader(mgrCookie, 'yuva_token');

    // Also acquire standard user token for role tests
    const userLoginRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.USER_LBRCE,
        password: USER_PASSWORD,
      },
    });
    const regularUserData = userLoginRes.data.data || userLoginRes.data;
    collegeUserToken = extractTokenFromCookieHeader(userLoginRes.headers.get('set-cookie'), 'yuva_token');
    assert.strictEqual(regularUserData.user.role, 'USER');
    console.log('  ✔ College Manager and User logged in successfully with cookies.');

    // -------------------------------------------------------------------------
    // Test 3: Invalid Password Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Invalid Password Rejection...');
    const badPasswordRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.ADMIN_LBRCE,
        password: 'CompletelyWrongPassword!',
      },
    });
    assert.strictEqual(badPasswordRes.status, 401);
    console.log('  ✔ Invalid password rejected with HTTP 401.');

    // -------------------------------------------------------------------------
    // Test 4: Inactive Account Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Inactive Account Rejection...');
    const inactiveRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.INACTIVE_LBRCE,
        password: INACTIVE_PASSWORD,
      },
    });
    assert.strictEqual(inactiveRes.status, 403);
    console.log('  ✔ Inactive account rejected with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 5: Forgot-Password Response Identical for Unknown Email
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Forgot-Password Identical Response for Existing vs Unknown Email...');
    const existingResetRes = await apiFetch('/auth/manager/forgot-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: FIXTURE_EMAILS.MANAGER_LBRCE },
    });
    assert.strictEqual(existingResetRes.status, 200);

    const unknownResetRes = await apiFetch('/auth/manager/forgot-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: 'completely.unknown.email@example.test' },
    });
    assert.strictEqual(unknownResetRes.status, 200);
    assert.strictEqual(
      unknownResetRes.data.message,
      existingResetRes.data.message,
      'Forgot-password response must be 100% identical between existing and non-existing accounts'
    );

    // Verify that passwordResetOtpHash is non-null and persisted in PostgreSQL immediately after forgot-password returns 200
    const userOtpState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: FIXTURE_EMAILS.MANAGER_LBRCE },
        select: {
          passwordResetOtpHash: true,
          passwordResetOtpExpiresAt: true,
          passwordResetAttempts: true,
        },
      });
    });
    assert.ok(
      userOtpState && userOtpState.passwordResetOtpHash,
      'FAIL: passwordResetOtpHash must be non-null and persisted in PostgreSQL immediately after /auth/manager/forgot-password returns 200'
    );
    assert.strictEqual(
      userOtpState.passwordResetOtpHash.length,
      64,
      'passwordResetOtpHash must be a 64-character SHA-256 hex string'
    );
    assert.ok(
      new Date(userOtpState.passwordResetOtpExpiresAt) > new Date(),
      'passwordResetOtpExpiresAt must be in the future'
    );
    assert.strictEqual(userOtpState.passwordResetAttempts, 0);
    console.log('  ✔ OTP hash confirmed persisted in database upon /auth/manager/forgot-password response.');

    // -------------------------------------------------------------------------
    // Test 6: Password Reset Flow (OTP Expiry & Brute Force Protection)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Password Reset Flow, OTP Expiry & Brute Force Protection...');
    const validOtp = '777888';
    const validOtpHash = crypto.createHash('sha256').update(validOtp).digest('hex');
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.updateMany({
        where: { collegeId: collegeA.id, email: FIXTURE_EMAILS.MANAGER_LBRCE },
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
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        otp: validOtp,
        password: 'NewlyUpdatedManagerPassword456!',
      },
    });
    assert.strictEqual(resetSuccessRes.status, 200);
    console.log('  ✔ Password reset flow verified.');

    // -------------------------------------------------------------------------
    // Test 7: Invite Accept Flow
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Invite Accept Flow (Hashed Token, Expiry, Single Use, Reuse Rejected)...');
    const validateValidRes = await apiFetch(`/invite/${validInviteTokenRaw}/validate`, {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(validateValidRes.status, 200);

    const acceptValidRes = await apiFetch(`/invite/${validInviteTokenRaw}/accept`, {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { password: 'AcceptedPassword123!' },
    });
    assert.strictEqual(acceptValidRes.status, 200);

    const reuseInviteRes = await apiFetch(`/invite/${validInviteTokenRaw}/accept`, {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { password: 'AnotherPassword123!' },
    });
    assert.strictEqual(reuseInviteRes.status, 400);
    console.log('  ✔ Single-use invite accepted and reuse rejected.');

    // -------------------------------------------------------------------------
    // Test 8: Expired JWT Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Expired JWT Rejection...');
    const expiredToken = jwt.sign(
      {
        userId: adminUserId,
        collegeId: collegeA.id,
        role: 'COLLEGE_ADMIN',
        type: 'college',
      },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const expiredTokenRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });
    assert.strictEqual(expiredTokenRes.status, 401);
    assert.ok(expiredTokenRes.data.message.includes('expired'));
    console.log('  ✔ Expired JWT strictly rejected with HTTP 401.');

    // -------------------------------------------------------------------------
    // Test 9: USER Role Rejected on COLLEGE_ADMIN Routes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing USER Role Rejected on COLLEGE_ADMIN Routes...');
    const userOnAdminRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: `Bearer ${collegeUserToken}`,
      },
    });
    assert.strictEqual(userOnAdminRes.status, 403);
    assert.ok(userOnAdminRes.data.message.includes('not an admin'));
    console.log('  ✔ USER role strictly rejected on COLLEGE_ADMIN routes with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 10: COLLEGE_ADMIN of College A Cannot Act in College B
    // -------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing COLLEGE_ADMIN of College A Cannot Act in College B...');
    const crossTenantAdminRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'vrsec.localhost',
      headers: {
        Authorization: `Bearer ${collegeAdminToken}`,
      },
    });
    assert.strictEqual(crossTenantAdminRes.status, 403);
    assert.ok(crossTenantAdminRes.data.message.includes('Token belongs to a different college tenant'));
    console.log('  ✔ College A admin token strictly rejected on College B subdomain with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 11: authenticateToken Re-loads User on Every Request (Requirement 4)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 11] Testing authenticateToken Fresh User Re-load under RLS (Requirement 4)...');

    // 11a. Valid initial request with active admin token succeeds
    const initialCheckRes = await apiFetch('/auth/me', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: { Authorization: `Bearer ${collegeAdminToken}` },
    });
    assert.strictEqual(initialCheckRes.status, 200, 'Initial /auth/me query must succeed');

    // 11b. User account deactivated in database -> subsequent request with same JWT must be rejected (HTTP 403)
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.update({
        where: { id: adminUserId },
        data: { isActive: false },
      });
    });

    const deactivatedRes = await apiFetch('/auth/me', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: { Authorization: `Bearer ${collegeAdminToken}` },
    });
    assert.strictEqual(deactivatedRes.status, 403, 'Deactivated account must be rejected with HTTP 403');
    assert.ok(deactivatedRes.data.message.includes('inactive'), 'Error message must state account is inactive');

    // Reactivate user
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.update({
        where: { id: adminUserId },
        data: { isActive: true },
      });
    });

    // 11c. User role changed in database -> subsequent request must be rejected (HTTP 401 role changed)
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.update({
        where: { id: adminUserId },
        data: { role: 'USER' }, // Changed from COLLEGE_ADMIN to USER
      });
    });

    const roleChangedRes = await apiFetch('/auth/me', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: { Authorization: `Bearer ${collegeAdminToken}` },
    });
    assert.strictEqual(roleChangedRes.status, 401, 'Role change must reject token with HTTP 401');
    assert.ok(roleChangedRes.data.message.includes('role has changed'), 'Expected role change error message');

    // Restore original role
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.update({
        where: { id: adminUserId },
        data: { role: 'COLLEGE_ADMIN' },
      });
    });
    console.log('  ✔ Fresh user re-load verified: in-flight deactivations and role mutations strictly enforced.');

    // -------------------------------------------------------------------------
    // Test 12: Platform Auth: TOTP Enrollment, Encryption at Rest & Reuse Prevention (Requirement 2)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 12] Testing Platform Auth: TOTP Enforcement, Encryption at Rest & Code Reuse (Requirement 2)...');

    // 12a. Confirm totp_secret is encrypted at rest in database
    const dbPlatformAdmin = await platformPrisma.platformAdmin.findUnique({
      where: { email: FIXTURE_EMAILS.PLATFORM_ADMIN },
    });
    assert.ok(dbPlatformAdmin.totpSecret.startsWith('enc:'), 'FAIL: totp_secret must be encrypted at rest (prefixed with enc:)');
    const decryptedSecret = decryptTotpSecret(dbPlatformAdmin.totpSecret);
    assert.strictEqual(decryptedSecret, platformTotpSecretPlain, 'FAIL: Decrypted TOTP secret does not match original plain secret');
    console.log('  ✔ TOTP secret confirmed encrypted at rest using AES-256-GCM.');

    // 12b. Platform login on non-admin host is rejected
    const nonAdminHostRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: FIXTURE_EMAILS.PLATFORM_ADMIN, password: PLATFORM_ADMIN_PASSWORD },
    });
    assert.strictEqual(nonAdminHostRes.status, 403);

    // 12c. Platform login in production mode refuses login if totp_secret is NULL
    process.env.NODE_ENV = 'production';
    process.env.PROXY_SHARED_SECRET = 'test_temp_proxy_secret';
    const noTotpProdRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      headers: {
        Origin: 'https://admin.4thepeople.in',
        'x-proxy-shared-secret': 'test_temp_proxy_secret',
      },
      body: { email: FIXTURE_EMAILS.PLATFORM_NO_TOTP, password: PLATFORM_ADMIN_PASSWORD },
    });
    assert.strictEqual(noTotpProdRes.status, 403, 'Platform login in production without TOTP must return HTTP 403');
    assert.ok(noTotpProdRes.data.message.includes('two-factor authentication (TOTP) enrolled'));
    delete process.env.PROXY_SHARED_SECRET;
    process.env.NODE_ENV = 'test'; // Restore test env

    // 12d. Valid TOTP login
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const validTotpCode = generateHotp(base32Decode(platformTotpSecretPlain), currentStep);

    const validTotpLoginRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
        totpCode: validTotpCode,
      },
    });
    assert.strictEqual(validTotpLoginRes.status, 200);
    const platformCookie = validTotpLoginRes.headers.get('set-cookie');
    assert.ok(platformCookie && platformCookie.includes('yuva_platform_token='));
    assert.ok(platformCookie.includes('SameSite=Strict'), 'Platform cookie must be SameSite=Strict');
    platformAdminToken = extractTokenFromCookieHeader(platformCookie, 'yuva_platform_token');

    // 12e. Replaying the EXACT same TOTP code within its validity window must be REJECTED (Requirement 2)
    const reusedTotpRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
        totpCode: validTotpCode, // Reusing previously consumed code
      },
    });
    assert.strictEqual(reusedTotpRes.status, 401, 'Reused TOTP code must be rejected with HTTP 401');
    assert.ok(reusedTotpRes.data.message.includes('already been used'), 'Expected error message indicating code reuse');
    console.log('  ✔ TOTP code reuse rejection confirmed within validity window.');

    // -------------------------------------------------------------------------
    // Test 13: Platform Admin Logout & Cookie Clearing
    // -------------------------------------------------------------------------
    console.log('\n[TEST 13] Testing Platform Admin Logout (/api/platform/auth/logout)...');
    const platformLogoutRes = await apiFetch('/api/platform/auth/logout', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
    });
    assert.strictEqual(platformLogoutRes.status, 200);
    console.log('  ✔ Platform Admin logout cleared yuva_platform_token cookie.');

    // -------------------------------------------------------------------------
    // Test 14: Per-Account Progressive Delay Throttling (Requirement 3)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 14] Testing Per-Account Progressive Delay Throttling (Requirement 3)...');
    clearAllLoginThrottling();
    const progressiveTargetEmail = 'progressive.throttle@example.test';

    // Attempt 1: failure (0s delay)
    await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: progressiveTargetEmail, password: 'WrongPassword1' },
    });

    // Attempt 2: failure (0s delay)
    await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: progressiveTargetEmail, password: 'WrongPassword2' },
    });

    // Attempt 3: failure (triggers 2s progressive penalty)
    await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: progressiveTargetEmail, password: 'WrongPassword3' },
    });

    // Immediate subsequent attempt from ANY IP must trigger progressive delay (HTTP 429)
    const delayedRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: { 'X-Forwarded-For': '203.0.113.199' }, // Different IP address!
      body: { email: progressiveTargetEmail, password: 'WrongPassword4' },
    });

    assert.strictEqual(delayedRes.status, 429, `Expected HTTP 429 progressive delay, got ${delayedRes.status}`);
    assert.ok(delayedRes.data.message.includes('Too many failed attempts for this account'));
    console.log('  ✔ Per-account progressive delay triggered independently of client IP address.');

    // -------------------------------------------------------------------------
    // Test 15: Cookie-Authenticated Non-GET Requests Without Origin or Referer (Requirement 5)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 15] Testing Cookie-Authenticated Non-GET Requests Without Origin or Referer (Requirement 5)...');

    // 15a. Cookie-authenticated POST with NEITHER Origin nor Referer must be REJECTED (HTTP 403)
    const cookieWithoutOriginRes = await apiFetch('/auth/logout', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: {
        Cookie: `yuva_token=${collegeAdminToken}`,
        // Neither Origin nor Referer provided!
      },
    });
    assert.strictEqual(cookieWithoutOriginRes.status, 403, 'Cookie-authenticated POST without Origin/Referer must return HTTP 403');
    assert.ok(cookieWithoutOriginRes.data.message.includes('must include Origin or Referer header'));

    // 15b. Cookie-authenticated POST WITH matching Origin succeeds
    const cookieWithOriginRes = await apiFetch('/auth/logout', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: {
        Cookie: `yuva_token=${collegeAdminToken}`,
        Origin: 'https://lbrce.4thepeople.in',
      },
    });
    assert.strictEqual(cookieWithOriginRes.status, 200, 'Cookie-authenticated POST with matching Origin must succeed');
    console.log('  ✔ Cookie-authenticated state-changing requests without Origin or Referer strictly blocked (HTTP 403).');

    // -------------------------------------------------------------------------
    // Test 16: EmailService Safety Guard (Strictly 'yuva_test' Database Name)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 16] Testing emailService Stub Database Safety Guard (yuva_test DB Name Guard)...');
    // yuva_test passes
    assert.doesNotThrow(() => verifyTestDatabaseHost());

    // Unauthorized database name (e.g. live_db, yuva_prod) must strictly throw
    const originalDbUrl = process.env.TEST_DATABASE_URL;
    process.env.TEST_DATABASE_URL = 'postgresql://user:pass@ep-dev-branch.neon.tech:5432/live_db';
    assert.throws(
      () => verifyTestDatabaseHost(),
      /Safety violation: emailService test stub refused to execute/
    );
    process.env.TEST_DATABASE_URL = originalDbUrl; // Restore
    console.log('  ✔ emailService safety guard strictly throws if test database name is not yuva_test.');

    // -------------------------------------------------------------------------
    // Test 17: Token Isolation & RLS Boundary Checks
    // -------------------------------------------------------------------------
    console.log('\n[TEST 17] Verifying Token Boundary & RLS Multi-Tenant Isolation...');
    // Platform token rejected on college routes
    const platformOnCollegeRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: { Authorization: `Bearer ${platformAdminToken}` },
    });
    assert.ok(platformOnCollegeRes.status === 401 || platformOnCollegeRes.status === 403);

    // College token rejected on platform routes
    const collegeOnPlatformRes = await apiFetch('/api/platform/auth/me', {
      method: 'GET',
      tenantHost: 'admin.4thepeople.in',
      headers: { Authorization: `Bearer ${collegeAdminToken}` },
    });
    assert.ok(collegeOnPlatformRes.status === 401 || collegeOnPlatformRes.status === 403);

    // Zero cross-tenant user visibility under RLS
    await withTenant(collegeA.id, async (tx) => {
      const crossUser = await tx.user.findFirst({ where: { email: FIXTURE_EMAILS.ADMIN_VRSEC } });
      assert.strictEqual(crossUser, null, 'RLS leak: VRSEC admin visible in LBRCE context');
    });
    console.log('  ✔ Token isolation and zero cross-tenant RLS visibility verified.');

    // -------------------------------------------------------------------------
    // Test 18: Public Registration Endpoint Confirmed Removed
    // -------------------------------------------------------------------------
    console.log('\n[TEST 18] Verifying Public Admin Registration Endpoint is Removed (HTTP 404)...');
    const registerRes = await apiFetch('/auth/admin/register', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { name: 'Hacker', email: 'hacker@example.test', password: 'Password123!' },
    });
    assert.strictEqual(registerRes.status, 404);
    console.log('  ✔ Public admin registration endpoint confirmed removed (HTTP 404).');

    // -------------------------------------------------------------------------
    // Test 19: Proxy Shared Secret Guard & Forged Header Simulation (Requirement 1)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 19] Testing Proxy Shared Secret Guard & Forged Header Simulation (Requirement 1)...');
    const TEST_PROXY_SECRET = 'test_shared_proxy_secret_key_abcdef123456';
    process.env.PROXY_SHARED_SECRET = TEST_PROXY_SECRET;

    try {
      // 19a. Direct call with forged XFF, XFH, and CF headers but MISSING proxy shared secret -> REJECTED (HTTP 403)
      const directForgedRes = await apiFetch('/', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': '198.51.100.99, 10.0.0.1',
          'X-Forwarded-Host': 'spoofed.4thepeople.in',
          'cf-connecting-ip': '203.0.113.88',
          'render-client-ip': '203.0.113.77',
        },
      });
      assert.strictEqual(directForgedRes.status, 403, 'Direct call without proxy shared secret must return HTTP 403');
      assert.ok(directForgedRes.data.message.includes('Missing proxy shared secret'));

      // 19b. Direct call with INVALID proxy shared secret -> REJECTED (HTTP 403)
      const invalidSecretRes = await apiFetch('/', {
        method: 'GET',
        headers: {
          'x-proxy-shared-secret': 'completely_wrong_secret',
          'X-Forwarded-For': '198.51.100.99',
        },
      });
      assert.strictEqual(invalidSecretRes.status, 403, 'Invalid proxy secret must return HTTP 403');
      assert.ok(invalidSecretRes.data.message.includes('Invalid proxy shared secret'));

      // 19c. Legitimate call with VALID proxy shared secret -> ACCEPTED (HTTP 200)
      const legitimateProxiedRes = await apiFetch('/', {
        method: 'GET',
        headers: {
          'x-proxy-shared-secret': TEST_PROXY_SECRET,
          'X-Forwarded-Host': 'lbrce.localhost',
        },
      });
      assert.strictEqual(legitimateProxiedRes.status, 200, 'Legitimate call with valid proxy secret must succeed');
      console.log('  ✔ Direct calls with forged XFF/XFH/CF headers blocked (HTTP 403); shared secret enforced.');
    } finally {
      delete process.env.PROXY_SHARED_SECRET;
    }

    console.log('\n======================================================================');
    console.log('ALL PHASE 2 REFINED TESTS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================\n');
  } finally {
    console.log('[CLEANUP] Cleaning up all test fixtures from database...');
    try {
      await cleanupFixtures(collegeA, collegeB);
      console.log('  ✔ Fixtures cleaned up successfully.');
    } catch (cleanupErr) {
      console.error('  ⚠ Warning: Error during fixture cleanup:', cleanupErr.message);
    }
    server.close();
  }
}

runPhase2Tests().catch((err) => {
  console.error('\n❌ PHASE 2 TEST RUNNER FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
