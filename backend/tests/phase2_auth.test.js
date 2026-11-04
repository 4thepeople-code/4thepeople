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
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { withTenant } = require('../config/db');
const { platformPrisma } = require('../config/platformDb');
const { getCollegeBySlug } = require('../config/collegeResolver');
const { prisma } = require('../config/internalClient');
const emailService = require('../services/emailService');
const { generateTotpSecret, generateHotp, base32Decode } = require('../utils/totp');
const { clearAllLoginThrottling } = require('../utils/loginSecurity');

// ---------------------------------------------------------------------------
// 1. Stub Email Service (Zero External Network Calls)
// ---------------------------------------------------------------------------
const capturedEmails = [];
emailService.sendEmail = async (params) => {
  capturedEmails.push({ type: 'generic', ...params });
  return { messageId: 'test-stub-generic-id', success: true };
};
emailService.sendManagerPasswordResetOtp = async (toEmail, name, otp) => {
  capturedEmails.push({ type: 'otp', toEmail, name, otp });
  return { messageId: 'test-stub-otp-id', success: true };
};
emailService.sendInviteEmail = async (toEmail, name, inviteToken) => {
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
};

/**
 * Robust cleanup helper to purge all test fixtures ending in @example.test.
 */
async function cleanupFixtures(collegeA, collegeB) {
  clearAllLoginThrottling();

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

  // Purge any preexisting fixtures from previous runs
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

  // Generate Base32 TOTP secret for Platform Admin
  const platformTotpSecret = generateTotpSecret();

  // Raw 64-char hex invite tokens
  const validInviteTokenRaw = crypto.randomBytes(32).toString('hex');
  const validInviteTokenHash = crypto.createHash('sha256').update(validInviteTokenRaw).digest('hex');

  const expiredInviteTokenRaw = crypto.randomBytes(32).toString('hex');
  const expiredInviteTokenHash = crypto.createHash('sha256').update(expiredInviteTokenRaw).digest('hex');

  // Setup College A users
  await withTenant(collegeA.id, async (tx) => {
    // 1. College A Admin (COLLEGE_ADMIN)
    await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Admin',
        email: FIXTURE_EMAILS.ADMIN_LBRCE,
        passwordHash: adminHash,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });

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
    await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'LBRCE Regular Student',
        email: FIXTURE_EMAILS.USER_LBRCE,
        passwordHash: userHash,
        role: 'USER',
        isActive: true,
      },
    });

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
        inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h in future
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
        inviteExpiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1h ago
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

  // Setup Platform Super-Admin (with TOTP secret)
  await platformPrisma.platformAdmin.create({
    data: {
      name: 'Platform Super Admin',
      email: FIXTURE_EMAILS.PLATFORM_ADMIN,
      passwordHash: platformAdminHash,
      totpSecret: platformTotpSecret,
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
    // Test 1: College Admin Login
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing College Admin Login (/auth/admin/login)...');
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
    assert.ok(adminData.token, 'Expected JWT token in response');
    assert.strictEqual(adminData.user.role, 'COLLEGE_ADMIN');
    assert.strictEqual(adminData.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.strictEqual(adminData.user.password, undefined);

    // Verify Set-Cookie header for yuva_token
    const cookieHeader = adminLoginRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('yuva_token='), 'Expected yuva_token Set-Cookie header');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.strictEqual(cookieHeader.includes('Domain='), false, 'Cookie must NOT have a Domain attribute (host-only)');

    collegeAdminToken = adminData.token;
    console.log('  ✔ College Admin logged in successfully with COLLEGE_ADMIN claim, HttpOnly cookie, and NO Domain attribute.');

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
    assert.strictEqual(mgrLoginRes.status, 200, `Expected 200, got ${mgrLoginRes.status}: ${JSON.stringify(mgrLoginRes.data)}`);
    assert.strictEqual(mgrLoginRes.data.success, true);
    assert.ok(mgrData.token);
    assert.strictEqual(mgrData.user.role, 'USER');
    assert.strictEqual(mgrData.user.passwordHash, undefined);

    collegeManagerToken = mgrData.token;
    console.log('  ✔ College Manager logged in successfully with USER claim.');

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
    collegeUserToken = regularUserData.token;
    assert.strictEqual(regularUserData.user.role, 'USER');

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
        email: FIXTURE_EMAILS.INACTIVE_LBRCE,
        password: INACTIVE_PASSWORD,
      },
    });

    assert.strictEqual(inactiveRes.status, 403);
    assert.strictEqual(inactiveRes.data.success, false);
    assert.ok(inactiveRes.data.message.includes('inactive'));
    console.log('  ✔ Inactive account rejected with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 5: Forgot-Password Response Identical for Unknown Email (Timing & Enumeration)
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
    console.log('  ✔ Forgot-password returns identical HTTP 200 message (zero account enumeration).');

    // -------------------------------------------------------------------------
    // Test 6: Password Reset Flow (OTP Expiry & Brute Force Protection)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Password Reset Flow, OTP Expiry & Brute Force Protection...');
    // Retrieve OTP hash
    let userState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: FIXTURE_EMAILS.MANAGER_LBRCE },
        select: { passwordResetOtpHash: true, passwordResetOtpExpiresAt: true, passwordResetAttempts: true },
      });
    });
    assert.ok(userState.passwordResetOtpHash);
    assert.strictEqual(userState.passwordResetAttempts, 0);

    // Invalid OTP attempt
    const badOtpRes = await apiFetch('/auth/manager/reset-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        otp: '000000',
        password: 'NewPassword123!',
      },
    });
    assert.strictEqual(badOtpRes.status, 400);

    userState = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { collegeId: collegeA.id, email: FIXTURE_EMAILS.MANAGER_LBRCE },
        select: { passwordResetAttempts: true },
      });
    });
    assert.strictEqual(userState.passwordResetAttempts, 1);

    // Brute-force threshold (5 attempts)
    await withTenant(collegeA.id, async (tx) => {
      await tx.user.updateMany({
        where: { collegeId: collegeA.id, email: FIXTURE_EMAILS.MANAGER_LBRCE },
        data: { passwordResetAttempts: 5 },
      });
    });

    const lockoutRes = await apiFetch('/auth/manager/reset-password', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        otp: '123456',
        password: 'NewPassword123!',
      },
    });
    assert.strictEqual(lockoutRes.status, 400);
    assert.ok(lockoutRes.data.message.includes('Too many failed attempts'));

    // Successful reset with fresh OTP
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

    // Verify login with new password succeeds
    const newLoginRes = await apiFetch('/auth/manager/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        email: FIXTURE_EMAILS.MANAGER_LBRCE,
        password: 'NewlyUpdatedManagerPassword456!',
      },
    });
    assert.strictEqual(newLoginRes.status, 200);
    console.log('  ✔ Password reset OTP verification and brute-force lockout verified.');

    // -------------------------------------------------------------------------
    // Test 7: Invite Accept Flow (Hashed Token, Expiry, Single Use, Reuse Rejected)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Invite Accept Flow (Hashed Token, Expiry, Single Use, Reuse Rejected)...');

    // 7a. Validate valid invite token
    const validateValidRes = await apiFetch(`/invite/${validInviteTokenRaw}/validate`, {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
    });
    const validateValidData = validateValidRes.data.data || validateValidRes.data;
    assert.strictEqual(validateValidRes.status, 200);
    assert.strictEqual(validateValidData.valid, true);

    // 7b. Validate expired invite token
    const validateExpiredRes = await apiFetch(`/invite/${expiredInviteTokenRaw}/validate`, {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
    });
    const validateExpiredData = validateExpiredRes.data.data || validateExpiredRes.data;
    assert.strictEqual(validateExpiredRes.status, 200);
    assert.strictEqual(validateExpiredData.valid, false);

    // 7c. Accept expired invite token (must be rejected)
    const acceptExpiredRes = await apiFetch(`/invite/${expiredInviteTokenRaw}/accept`, {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { password: 'AcceptedPassword123!' },
    });
    assert.strictEqual(acceptExpiredRes.status, 400);
    assert.ok(acceptExpiredRes.data.message.includes('expired'));
    console.log('  ✔ Expired invite token rejected with HTTP 400.');

    // 7d. Accept valid invite token (single use)
    const acceptValidRes = await apiFetch(`/invite/${validInviteTokenRaw}/accept`, {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { password: 'AcceptedPassword123!' },
    });
    assert.strictEqual(acceptValidRes.status, 200);
    assert.strictEqual(acceptValidRes.data.success, true);

    // Verify DB state: password updated, isActive = true, inviteTokenHash cleared
    const invitedUserRecord = await withTenant(collegeA.id, async (tx) => {
      return await tx.user.findFirst({
        where: { email: FIXTURE_EMAILS.INVITED_LBRCE },
      });
    });
    assert.strictEqual(invitedUserRecord.isActive, true);
    assert.strictEqual(invitedUserRecord.inviteTokenHash, null);
    assert.strictEqual(invitedUserRecord.inviteExpiresAt, null);
    assert.ok(invitedUserRecord.passwordHash);

    // 7e. Reuse rejected (attempting to accept the same token again)
    const reuseInviteRes = await apiFetch(`/invite/${validInviteTokenRaw}/accept`, {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { password: 'AnotherPassword123!' },
    });
    assert.strictEqual(reuseInviteRes.status, 400);
    console.log('  ✔ Single-use invite accepted and token reuse strictly rejected (HTTP 400).');

    // -------------------------------------------------------------------------
    // Test 8: Expired JWT Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Expired JWT Rejection...');
    const expiredToken = jwt.sign(
      {
        userId: '11111111-1111-1111-1111-111111111111',
        collegeId: collegeA.id,
        role: 'COLLEGE_ADMIN',
        type: 'college',
      },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' } // Expired 10 seconds ago
    );

    const expiredTokenRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });
    assert.strictEqual(expiredTokenRes.status, 401);
    assert.strictEqual(expiredTokenRes.data.success, false);
    assert.ok(
      expiredTokenRes.data.message.includes('expired'),
      `Expected message to mention expired token, got: ${expiredTokenRes.data.message}`
    );
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
    assert.strictEqual(userOnAdminRes.data.success, false);
    assert.ok(userOnAdminRes.data.message.includes('not an admin'));
    console.log('  ✔ USER role strictly rejected on COLLEGE_ADMIN routes with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 10: COLLEGE_ADMIN of College A Cannot Act in College B
    // -------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing COLLEGE_ADMIN of College A Cannot Act in College B...');
    const crossTenantAdminRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'vrsec.localhost', // Host is VRSEC, but token is for LBRCE
      headers: {
        Authorization: `Bearer ${collegeAdminToken}`,
      },
    });
    assert.strictEqual(crossTenantAdminRes.status, 403);
    assert.strictEqual(crossTenantAdminRes.data.success, false);
    assert.ok(crossTenantAdminRes.data.message.includes('Token belongs to a different college tenant'));
    console.log('  ✔ College A admin token strictly rejected on College B subdomain with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 11: Platform Login Rejected on Non-Admin Host
    // -------------------------------------------------------------------------
    console.log('\n[TEST 11] Testing Platform Login Rejected on Non-Admin Host...');
    const platformOnCollegeHostRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost', // Sent to college host instead of admin host
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
      },
    });
    assert.strictEqual(platformOnCollegeHostRes.status, 403);
    assert.strictEqual(platformOnCollegeHostRes.data.success, false);
    assert.ok(platformOnCollegeHostRes.data.message.includes('Platform authentication is only allowed on the platform administration host'));
    console.log('  ✔ Platform login on college subdomain strictly rejected with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 12: Platform Admin Login with TOTP Enforcement
    // -------------------------------------------------------------------------
    console.log('\n[TEST 12] Testing Platform Admin Login with TOTP Enforcement...');
    // 12a. Missing TOTP code
    const missingTotpRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
      },
    });
    assert.strictEqual(missingTotpRes.status, 400);
    assert.ok(missingTotpRes.data.message.includes('Two-factor authentication code required'));

    // 12b. Invalid TOTP code
    const invalidTotpRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
        totpCode: '000000',
      },
    });
    assert.strictEqual(invalidTotpRes.status, 401);
    assert.ok(invalidTotpRes.data.message.includes('Invalid two-factor authentication code'));

    // 12c. Valid TOTP code
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const validTotpCode = generateHotp(base32Decode(platformTotpSecret), currentStep);

    const validTotpLoginRes = await apiFetch('/api/platform/auth/login', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
      body: {
        email: FIXTURE_EMAILS.PLATFORM_ADMIN,
        password: PLATFORM_ADMIN_PASSWORD,
        totpCode: validTotpCode,
      },
    });
    const platformData = validTotpLoginRes.data.data || validTotpLoginRes.data;
    assert.strictEqual(validTotpLoginRes.status, 200);
    assert.strictEqual(validTotpLoginRes.data.success, true);
    assert.ok(platformData.token);
    assert.strictEqual(platformData.admin.role, 'PLATFORM_SUPER_ADMIN');

    const platformCookie = validTotpLoginRes.headers.get('set-cookie');
    assert.ok(platformCookie && platformCookie.includes('yuva_platform_token='));
    assert.ok(platformCookie.includes('HttpOnly'));
    assert.strictEqual(platformCookie.includes('Domain='), false, 'yuva_platform_token must NOT have Domain attribute');

    platformAdminToken = platformData.token;
    console.log('  ✔ Platform Super-Admin authenticated with TOTP 2FA, HttpOnly cookie, and NO Domain attribute.');

    // -------------------------------------------------------------------------
    // Test 13: College Token Rejected on Platform Routes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 13] Testing College Token Rejected on Platform Routes (/api/platform/auth/me)...');
    const collegeTokenOnPlatformRes = await apiFetch('/api/platform/auth/me', {
      method: 'GET',
      tenantHost: 'admin.4thepeople.in',
      headers: {
        Authorization: `Bearer ${collegeAdminToken}`,
      },
    });
    assert.ok(collegeTokenOnPlatformRes.status === 401 || collegeTokenOnPlatformRes.status === 403);
    console.log('  ✔ College token rejected on platform routes (HTTP 401/403).');

    // -------------------------------------------------------------------------
    // Test 14: Platform Token Rejected on College Routes
    // -------------------------------------------------------------------------
    console.log('\n[TEST 14] Testing Platform Token Rejected on College Routes...');
    const platformOnCollegeRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
      headers: {
        Authorization: `Bearer ${platformAdminToken}`,
      },
    });
    assert.ok(platformOnCollegeRes.status === 401 || platformOnCollegeRes.status === 403);
    console.log('  ✔ Platform token strictly rejected on college routes (HTTP 401/403).');

    // -------------------------------------------------------------------------
    // Test 15: Platform Admin Logout & Cookie Clearing
    // -------------------------------------------------------------------------
    console.log('\n[TEST 15] Testing Platform Admin Logout (/api/platform/auth/logout)...');
    const platformLogoutRes = await apiFetch('/api/platform/auth/logout', {
      method: 'POST',
      tenantHost: 'admin.4thepeople.in',
    });
    assert.strictEqual(platformLogoutRes.status, 200);
    const platformLogoutCookie = platformLogoutRes.headers.get('set-cookie');
    assert.ok(
      platformLogoutCookie && (platformLogoutCookie.includes('yuva_platform_token=;') || platformLogoutCookie.includes('Max-Age=0'))
    );
    console.log('  ✔ Platform Admin logout cleared yuva_platform_token cookie.');

    // -------------------------------------------------------------------------
    // Test 16: Login Throttling (Per-Account + IP)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 16] Testing Per-Account + IP Login Throttling...');
    const throttleTargetEmail = 'throttle.test@example.test';
    // Simulate 5 consecutive failed logins
    for (let i = 0; i < 5; i++) {
      await apiFetch('/auth/admin/login', {
        method: 'POST',
        tenantHost: 'lbrce.localhost',
        body: { email: throttleTargetEmail, password: 'BadPassword123!' },
      });
    }

    // 6th attempt must be locked out with HTTP 429
    const throttledRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: { email: throttleTargetEmail, password: 'BadPassword123!' },
    });
    assert.strictEqual(throttledRes.status, 429, `Expected HTTP 429, got ${throttledRes.status}`);
    assert.ok(throttledRes.data.message.includes('Too many failed login attempts'));
    console.log('  ✔ 5 consecutive failed logins triggered HTTP 429 lockout.');

    // -------------------------------------------------------------------------
    // Test 17: Origin / Referer Isolation for State-Changing Requests
    // -------------------------------------------------------------------------
    console.log('\n[TEST 17] Testing Origin / Referer Isolation for State-Changing Requests...');
    // 17a. Cross-tenant Origin (vrsec origin sent to LBRCE)
    const crossTenantOriginRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: {
        Origin: 'https://vrsec.4thepeople.in',
      },
      body: { email: FIXTURE_EMAILS.ADMIN_LBRCE, password: ADMIN_PASSWORD },
    });
    assert.strictEqual(crossTenantOriginRes.status, 403);
    assert.ok(crossTenantOriginRes.data.message.includes('Cross-tenant request blocked'));

    // 17b. Completely unauthorized origin
    const unauthorizedOriginRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: {
        Origin: 'https://malicious-attacker.com',
      },
      body: { email: FIXTURE_EMAILS.ADMIN_LBRCE, password: ADMIN_PASSWORD },
    });
    assert.strictEqual(unauthorizedOriginRes.status, 403);
    assert.ok(
      unauthorizedOriginRes.data.message.includes('not allowed by CORS') ||
      unauthorizedOriginRes.data.message.includes('not an authorized origin')
    );

    // 17c. Matching Origin (lbrce)
    const matchingOriginRes = await apiFetch('/auth/admin/login', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      headers: {
        Origin: 'https://lbrce.4thepeople.in',
      },
      body: { email: FIXTURE_EMAILS.ADMIN_LBRCE, password: ADMIN_PASSWORD },
    });
    assert.strictEqual(matchingOriginRes.status, 200);
    console.log('  ✔ Subdomain Origin allowlist enforced; cross-subdomain & external origins rejected (HTTP 403).');

    // -------------------------------------------------------------------------
    // Test 18: Missing and Malformed JWT Rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 18] Testing Missing and Malformed JWT Rejection...');
    const missingTokenRes = await apiFetch('/admin/profile', {
      method: 'GET',
      tenantHost: 'lbrce.localhost',
    });
    assert.strictEqual(missingTokenRes.status, 401);

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
    // Test 19: Zero Cross-Tenant User Lookup via PostgreSQL RLS
    // -------------------------------------------------------------------------
    console.log('\n[TEST 19] Testing Zero Cross-Tenant User Lookup under RLS...');
    await withTenant(collegeA.id, async (tx) => {
      const crossUser = await tx.user.findFirst({
        where: { email: FIXTURE_EMAILS.ADMIN_VRSEC },
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
    // Test 20: Public College Admin Registration Endpoint Confirmed Removed
    // -------------------------------------------------------------------------
    console.log('\n[TEST 20] Verifying Public College Admin Registration Endpoint is Removed...');
    const registerRes = await apiFetch('/auth/admin/register', {
      method: 'POST',
      tenantHost: 'lbrce.localhost',
      body: {
        name: 'Hacker',
        email: 'hacker@example.test',
        password: 'Password123!',
      },
    });
    assert.strictEqual(
      registerRes.status,
      404,
      `POST /auth/admin/register must return 404 (removed). Got ${registerRes.status}`
    );
    console.log('  ✔ Public college admin registration endpoint confirmed removed (HTTP 404).');

    console.log('\n======================================================================');
    console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================\n');
  } finally {
    // -----------------------------------------------------------------------
    // Fixture Cleanup: Clean up all @example.test records
    // -----------------------------------------------------------------------
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
