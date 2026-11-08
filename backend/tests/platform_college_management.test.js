/**
 * Integration Test Suite: Platform Admin College Management & College Admin Provisioning
 * 
 * Verifies all 12 core requirements:
 * 1. Unauthorized requests rejected (401/403).
 * 2. Create college without admin -> 0 User records, NOT_ASSIGNED status.
 * 3. List colleges with live admin status summary and search.
 * 4. Reject duplicate college code / slug (409 Conflict).
 * 5. Create college with optional administrator (atomic transaction) -> PENDING_ACTIVATION.
 * 6. Reject duplicate admin email (409 Conflict).
 * 7. Assign administrator to existing unassigned college.
 * 8. Expired invitation detection -> computes INVITATION_EXPIRED.
 * 9. Resend invitation -> refreshes token and 48-hour expiration.
 * 10. Accept invitation workflow -> sets password, activates account, wipes token.
 * 11. Suspend and reactivate administrator -> independent of college status.
 * 12. Deactivate and activate college -> independent of administrator status.
 * 13. Edit college details -> updates metadata cleanly.
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { platformPrisma } = require('../config/platformDb');
const app = require('../index');

const PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'dev_platform_super_admin_jwt_secret_fallback_key';
const PROXY_SECRET = process.env.PROXY_SHARED_SECRET || 'test_shared_proxy_secret_for_local_development_only';
process.env.PROXY_SHARED_SECRET = PROXY_SECRET;

// Tracked test entities for guaranteed clean teardown
const trackedCollegeIds = [];
const trackedUserIds = [];

let server = null;
let baseUrl = '';

// Create valid Platform Super-Admin JWT
const platformAdminToken = jwt.sign(
  {
    type: 'platform',
    platformAdminId: 'plat-superadmin-test-uuid',
    email: 'superadmin_test@4thepeople.in',
    name: 'Platform Ops SuperAdmin',
    role: 'PLATFORM_SUPER_ADMIN',
  },
  PLATFORM_JWT_SECRET,
  { expiresIn: '2h' }
);

// Create standard College Admin JWT (to verify authorization rejection)
const collegeAdminToken = jwt.sign(
  {
    userId: 'college-admin-test-uuid',
    collegeId: '11111111-1111-1111-1111-111111111111',
    collegeSlug: 'lbrce',
    role: 'COLLEGE_ADMIN',
    type: 'college',
  },
  process.env.JWT_SECRET || 'myjwtsecretkey',
  { expiresIn: '1h' }
);

async function makeRequest({
  method = 'GET',
  path,
  host = 'admin.localhost',
  token,
  body,
  headers = {},
}) {
  const reqHeaders = {
    'x-proxy-shared-secret': PROXY_SECRET,
    'x-forwarded-host': host,
    'x-yuva-host-type': 'PLATFORM_ADMIN',
    Origin: `http://${host}`,
    ...headers,
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  let reqBody;
  if (body) {
    reqHeaders['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  const contentType = res.headers.get('content-type') || '';
  let json = null;
  if (contentType.includes('application/json')) {
    json = await res.json();
  } else {
    json = { text: await res.text() };
  }

  return { status: res.status, headers: res.headers, body: json };
}

async function cleanupTracked() {
  if (trackedUserIds.length > 0) {
    await platformPrisma.user.deleteMany({
      where: { id: { in: trackedUserIds } },
    });
  }

  // Also clean up any lingering test users by email pattern
  await platformPrisma.user.deleteMany({
    where: {
      email: {
        in: [
          'admin_alpha_test@example.test',
          'admin_beta_test@example.test',
          'admin_gamma_test@example.test',
        ],
      },
    },
  });

  if (trackedCollegeIds.length > 0) {
    // Delete any users belonging to these colleges first
    await platformPrisma.user.deleteMany({
      where: { collegeId: { in: trackedCollegeIds } },
    });
    await platformPrisma.college.deleteMany({
      where: { id: { in: trackedCollegeIds } },
    });
  }

  // Also clean up lingering test colleges by code pattern
  const lingeringColleges = await platformPrisma.college.findMany({
    where: {
      code: { in: ['AIT-TEST', 'BCS-TEST', 'GAMMA-TEST'] },
    },
    select: { id: true },
  });
  if (lingeringColleges.length > 0) {
    const lingeringIds = lingeringColleges.map((c) => c.id);
    await platformPrisma.user.deleteMany({
      where: { collegeId: { in: lingeringIds } },
    });
    await platformPrisma.college.deleteMany({
      where: { id: { in: lingeringIds } },
    });
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING PLATFORM COLLEGE MANAGEMENT & PROVISIONING INTEGRATION SUITE');
  console.log('======================================================================');

  try {
    // 0. Pre-test cleanup
    console.log('\n[SETUP] Pre-test cleanup of lingering test fixtures...');
    await cleanupTracked();

    // Start ephemeral test server
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[SETUP] Ephemeral test server active on ${baseUrl}`);

    let collegeAId = null;
    let collegeBId = null;
    let adminAId = null;
    let adminBId = null;

    // -----------------------------------------------------------------------
    // TEST 1: Security & Authorization Protection
    // -----------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying platform endpoint security and authorization...');
    
    // 1a: Unauthenticated request must return 401
    const unauthRes = await makeRequest({
      method: 'GET',
      path: '/api/platform/colleges',
      token: null,
    });
    console.log('unauthRes body:', unauthRes.body);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');
    console.log('  ✔ Reject unauthenticated request (401)');

    // 1b: College-level token signed with college secret must fail verification with 401
    const collegeTokenRes = await makeRequest({
      method: 'GET',
      path: '/api/platform/colleges',
      token: collegeAdminToken,
    });
    assert.strictEqual(collegeTokenRes.status, 401, 'College token signed with college secret must be rejected with 401');
    console.log('  ✔ Reject college token signed with non-platform secret (401)');

    // 1c: Token signed with platform secret but with non-platform payload must return 403 (Cross-Boundary Isolation)
    const spoofedToken = jwt.sign(
      { userId: 'spoofed-id', role: 'COLLEGE_ADMIN', type: 'college' },
      PLATFORM_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const spoofedRes = await makeRequest({
      method: 'GET',
      path: '/api/platform/colleges',
      token: spoofedToken,
    });
    assert.strictEqual(spoofedRes.status, 403, 'Non-platform type must be rejected with 403');
    console.log('  ✔ Reject non-platform token type on platform route (403)');

    // -----------------------------------------------------------------------
    // TEST 2: Workflow 1 - Create College WITHOUT Administrator
    // -----------------------------------------------------------------------
    console.log('\n[TEST 2] Workflow 1: Create College WITHOUT Administrator (zero user records)...');
    const createColARes = await makeRequest({
      method: 'POST',
      path: '/api/platform/colleges',
      token: platformAdminToken,
      body: {
        name: 'Alpha Institute of Tech',
        code: 'AIT-TEST',
        officialEmail: 'contact@ait.test',
        address: '101 Knowledge Park',
        city: 'Hyderabad',
        state: 'Telangana',
        contactNumber: '+91 9876543210',
      },
    });

    assert.strictEqual(createColARes.status, 201, `Expected 201, got ${createColARes.status}: ${JSON.stringify(createColARes.body)}`);
    assert.strictEqual(createColARes.body.success, true);
    assert.strictEqual(createColARes.body.data.college.name, 'Alpha Institute of Tech');
    assert.strictEqual(createColARes.body.data.college.code, 'AIT-TEST');
    assert.strictEqual(createColARes.body.data.college.slug, 'ait-test');
    assert.strictEqual(createColARes.body.data.college.isActive, true);
    assert.strictEqual(createColARes.body.data.admin, null, 'data.admin must be null when admin is omitted');

    collegeAId = createColARes.body.data.college.id;
    trackedCollegeIds.push(collegeAId);

    // CRITICAL: Verify in database that ZERO User records were created
    const usersForColA = await platformPrisma.user.findMany({
      where: { collegeId: collegeAId },
    });
    assert.strictEqual(usersForColA.length, 0, 'Must create ZERO placeholder User records in database');
    console.log('  ✔ College created independently with 0 User records');

    // -----------------------------------------------------------------------
    // TEST 3: List Colleges & Computed Admin Status
    // -----------------------------------------------------------------------
    console.log('\n[TEST 3] List colleges and verify computed admin status NOT_ASSIGNED...');
    const listRes = await makeRequest({
      method: 'GET',
      path: '/api/platform/colleges?search=AIT-TEST',
      token: platformAdminToken,
    });
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(Array.isArray(listRes.body.data), true);
    assert.strictEqual(listRes.body.data.length >= 1, true);
    const foundA = listRes.body.data.find((c) => c.id === collegeAId);
    assert.ok(foundA, 'College A should be present in results');
    assert.strictEqual(foundA.admin, null);
    assert.strictEqual(foundA.adminCount, 0);
    console.log('  ✔ List colleges returns unassigned college with admin: null');

    // -----------------------------------------------------------------------
    // TEST 4: Prevent Duplicate College Code & Slug
    // -----------------------------------------------------------------------
    console.log('\n[TEST 4] Reject duplicate college code and slug (409 Conflict)...');
    const dupCodeRes = await makeRequest({
      method: 'POST',
      path: '/api/platform/colleges',
      token: platformAdminToken,
      body: {
        name: 'Alpha Institute Duplicate',
        code: 'AIT-TEST',
      },
    });
    assert.strictEqual(dupCodeRes.status, 409, 'Duplicate college code must return 409');
    console.log('  ✔ Duplicate college code rejected with 409');

    // -----------------------------------------------------------------------
    // TEST 5: Create College WITH Optional Administrator (Atomic Transaction)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 5] Optional Admin Creation During College Registration (Atomic Transaction)...');
    const createColBRes = await makeRequest({
      method: 'POST',
      path: '/api/platform/colleges',
      token: platformAdminToken,
      body: {
        name: 'Beta College of Science',
        code: 'BCS-TEST',
        officialEmail: 'info@bcs.test',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        admin: {
          name: 'Dr. Beta Administrator',
          email: 'admin_beta_test@example.test',
        },
      },
    });

    assert.strictEqual(createColBRes.status, 201);
    assert.strictEqual(createColBRes.body.data.college.code, 'BCS-TEST');
    assert.ok(createColBRes.body.data.admin, 'Admin must be present in response');
    assert.strictEqual(createColBRes.body.data.admin.email, 'admin_beta_test@example.test');
    assert.strictEqual(createColBRes.body.data.admin.status, 'PENDING_ACTIVATION');
    assert.ok(createColBRes.body.data.admin.inviteExpiresAt);

    collegeBId = createColBRes.body.data.college.id;
    adminBId = createColBRes.body.data.admin.id;
    trackedCollegeIds.push(collegeBId);
    trackedUserIds.push(adminBId);

    // Direct database validation
    const dbAdminB = await platformPrisma.user.findUnique({ where: { id: adminBId } });
    assert.ok(dbAdminB);
    assert.strictEqual(dbAdminB.isActive, false, 'Initial account status must be false (pending activation)');
    assert.strictEqual(dbAdminB.role, 'COLLEGE_ADMIN');
    assert.strictEqual(dbAdminB.collegeId, collegeBId);
    assert.strictEqual(typeof dbAdminB.inviteTokenHash, 'string');
    assert.strictEqual(dbAdminB.inviteTokenHash.length, 64, 'Token hash must be SHA-256 (64 hex characters)');
    assert.strictEqual(dbAdminB.passwordHash, null, 'Must NOT store a temporary or hardcoded password');
    assert.ok(new Date(dbAdminB.inviteExpiresAt) > new Date(), 'inviteExpiresAt must be in future');
    console.log('  ✔ Atomic college + administrator provisioned with secure 48h invitation token hash');

    // -----------------------------------------------------------------------
    // TEST 6: Reject Duplicate Administrator Email Address
    // -----------------------------------------------------------------------
    console.log('\n[TEST 6] Reject duplicate administrator email globally (409 Conflict)...');
    const dupEmailRes = await makeRequest({
      method: 'POST',
      path: '/api/platform/colleges',
      token: platformAdminToken,
      body: {
        name: 'Gamma College',
        code: 'GAMMA-TEST',
        admin: {
          name: 'Dr. Duplicate',
          email: 'admin_beta_test@example.test', // already taken by Beta College
        },
      },
    });
    assert.strictEqual(dupEmailRes.status, 409, 'Duplicate admin email must return 409');
    
    // Verify GAMMA-TEST college was NOT created (atomicity check)
    const gammaCheck = await platformPrisma.college.findFirst({ where: { code: 'GAMMA-TEST' } });
    assert.strictEqual(gammaCheck, null, 'College must not be created if admin creation fails (atomic)');
    console.log('  ✔ Duplicate admin email rejected and atomicity preserved');

    // -----------------------------------------------------------------------
    // TEST 7: Workflow 2 - Assign Administrator to Existing College
    // -----------------------------------------------------------------------
    console.log('\n[TEST 7] Workflow 2: Assign College Administrator to existing college...');
    const assignAdminRes = await makeRequest({
      method: 'POST',
      path: `/api/platform/colleges/${collegeAId}/admins`,
      token: platformAdminToken,
      body: {
        name: 'Prof. Alpha Administrator',
        email: 'admin_alpha_test@example.test',
      },
    });

    assert.strictEqual(assignAdminRes.status, 201);
    assert.strictEqual(assignAdminRes.body.data.admin.email, 'admin_alpha_test@example.test');
    assert.strictEqual(assignAdminRes.body.data.admin.status, 'PENDING_ACTIVATION');
    adminAId = assignAdminRes.body.data.admin.id;
    trackedUserIds.push(adminAId);

    const dbAdminA = await platformPrisma.user.findUnique({ where: { id: adminAId } });
    assert.ok(dbAdminA);
    assert.strictEqual(dbAdminA.collegeId, collegeAId);
    assert.strictEqual(dbAdminA.isActive, false);
    assert.strictEqual(dbAdminA.inviteTokenHash.length, 64);
    console.log('  ✔ Administrator provisioned and linked to existing College A');

    // -----------------------------------------------------------------------
    // TEST 8: Expired Invitation Detection
    // -----------------------------------------------------------------------
    console.log('\n[TEST 8] Expired invitation handling...');
    // Manually set inviteExpiresAt to 2 days in the past
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await platformPrisma.user.update({
      where: { id: adminAId },
      data: { inviteExpiresAt: pastDate },
    });

    // Check college detail computation
    const detailExpiredRes = await makeRequest({
      method: 'GET',
      path: `/api/platform/colleges/${collegeAId}`,
      token: platformAdminToken,
    });
    assert.strictEqual(detailExpiredRes.status, 200);
    assert.strictEqual(detailExpiredRes.body.data.admin.status, 'INVITATION_EXPIRED');

    // Check query filter adminStatus=INVITATION_EXPIRED
    const filterExpiredRes = await makeRequest({
      method: 'GET',
      path: '/api/platform/colleges?adminStatus=INVITATION_EXPIRED',
      token: platformAdminToken,
    });
    assert.strictEqual(filterExpiredRes.status, 200);
    const foundExpired = filterExpiredRes.body.data.find((c) => c.id === collegeAId);
    assert.ok(foundExpired, 'College A should match INVITATION_EXPIRED filter');
    console.log('  ✔ Invitation expiration correctly computed as INVITATION_EXPIRED');

    // -----------------------------------------------------------------------
    // TEST 9: Resend Invitation (Refreshes Token and 48-Hour Window)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 9] Resend activation invitation...');
    const oldHash = dbAdminA.inviteTokenHash;
    const resendRes = await makeRequest({
      method: 'POST',
      path: `/api/platform/college-admins/${adminAId}/resend-invitation`,
      token: platformAdminToken,
    });

    assert.strictEqual(resendRes.status, 200);
    assert.strictEqual(resendRes.body.data.admin.status, 'PENDING_ACTIVATION');

    const dbAdminARefreshed = await platformPrisma.user.findUnique({ where: { id: adminAId } });
    assert.notStrictEqual(dbAdminARefreshed.inviteTokenHash, oldHash, 'New token hash must differ from old');
    assert.ok(new Date(dbAdminARefreshed.inviteExpiresAt) > new Date(Date.now() + 47 * 3600 * 1000), 'Expiration refreshed to +48h');
    console.log('  ✔ Resend invitation invalidated old token and granted fresh 48-hour window');

    // -----------------------------------------------------------------------
    // TEST 10: College Admin Account Activation Flow (/invite/:token/accept)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 10] Reuse existing invitation activation flow (/invite/:token/accept)...');
    // Generate known token and hash for admin A
    const rawActivationToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const activationHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    await platformPrisma.user.update({
      where: { id: adminAId },
      data: {
        inviteTokenHash: activationHash,
        inviteExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    // 10a: Validate invitation token
    const validateRes = await makeRequest({
      method: 'GET',
      path: `/api/invite/${rawActivationToken}/validate`,
      host: 'ait-test.localhost',
      headers: {
        'x-yuva-tenant-slug': 'ait-test',
        'x-forwarded-host': 'ait-test.localhost',
      },
      token: null,
    });
    assert.strictEqual(validateRes.status, 200);
    assert.strictEqual(validateRes.body.data.valid, true);
    assert.strictEqual(validateRes.body.data.user.email, 'admin_alpha_test@example.test');
    console.log('  ✔ Public invitation validation successful');

    // 10b: Accept invitation and set password
    const acceptRes = await makeRequest({
      method: 'POST',
      path: `/api/invite/${rawActivationToken}/accept`,
      host: 'ait-test.localhost',
      headers: {
        'x-yuva-tenant-slug': 'ait-test',
        'x-forwarded-host': 'ait-test.localhost',
      },
      token: null,
      body: {
        password: 'SecureCollegeAdminPassword123!',
      },
    });
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.success, true);

    // Verify DB state
    const dbAdminAActivated = await platformPrisma.user.findUnique({ where: { id: adminAId } });
    assert.strictEqual(dbAdminAActivated.isActive, true, 'User must now be active');
    assert.strictEqual(dbAdminAActivated.inviteTokenHash, null, 'inviteTokenHash must be wiped');
    assert.strictEqual(dbAdminAActivated.inviteExpiresAt, null, 'inviteExpiresAt must be wiped');
    assert.ok(dbAdminAActivated.passwordHash, 'passwordHash must be populated');
    const passwordMatch = await bcrypt.compare('SecureCollegeAdminPassword123!', dbAdminAActivated.passwordHash);
    assert.strictEqual(passwordMatch, true, 'Stored bcrypt hash must match submitted password');

    // Verify status computation in Platform API
    const detailActiveRes = await makeRequest({
      method: 'GET',
      path: `/api/platform/colleges/${collegeAId}`,
      token: platformAdminToken,
    });
    assert.strictEqual(detailActiveRes.body.data.admin.status, 'ACTIVE');
    console.log('  ✔ College Admin successfully activated with secure password');

    // -----------------------------------------------------------------------
    // TEST 11: Suspend and Reactivate Administrator (Independent of College)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 11] Suspend and reactivate administrator (independent of college status)...');
    
    // Suspend admin
    const suspendRes = await makeRequest({
      method: 'PATCH',
      path: `/api/platform/college-admins/${adminAId}/status`,
      token: platformAdminToken,
      body: { isActive: false },
    });
    assert.strictEqual(suspendRes.status, 200);
    assert.strictEqual(suspendRes.body.data.isActive, false);
    assert.strictEqual(suspendRes.body.data.status, 'SUSPENDED');

    // Verify College A status is STILL ACTIVE (Independence requirement)
    const collegeAfterSuspend = await platformPrisma.college.findUnique({ where: { id: collegeAId } });
    assert.strictEqual(collegeAfterSuspend.isActive, true, 'College status must remain ACTIVE when admin is suspended');
    console.log('  ✔ Administrator suspended without affecting college status');

    // Reactivate admin
    const reactivateRes = await makeRequest({
      method: 'PATCH',
      path: `/api/platform/college-admins/${adminAId}/status`,
      token: platformAdminToken,
      body: { isActive: true },
    });
    assert.strictEqual(reactivateRes.status, 200);
    assert.strictEqual(reactivateRes.body.data.isActive, true);
    assert.strictEqual(reactivateRes.body.data.status, 'ACTIVE');
    console.log('  ✔ Administrator reactivated cleanly');

    // -----------------------------------------------------------------------
    // TEST 12: Deactivate and Activate College (Independent of Admin)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 12] Deactivate and activate college (independent of administrator status)...');
    
    // Deactivate college
    const deactCollegeRes = await makeRequest({
      method: 'PATCH',
      path: `/api/platform/colleges/${collegeAId}/status`,
      token: platformAdminToken,
      body: { isActive: false },
    });
    assert.strictEqual(deactCollegeRes.status, 200);
    assert.strictEqual(deactCollegeRes.body.data.isActive, false);

    // Verify Admin A status is STILL ACTIVE (Independence requirement)
    const adminAfterColDeact = await platformPrisma.user.findUnique({ where: { id: adminAId } });
    assert.strictEqual(adminAfterColDeact.isActive, true, 'Admin account status must not be modified when college is deactivated');
    console.log('  ✔ College deactivated without modifying administrator status');

    // Reactivate college
    const reactCollegeRes = await makeRequest({
      method: 'PATCH',
      path: `/api/platform/colleges/${collegeAId}/status`,
      token: platformAdminToken,
      body: { isActive: true },
    });
    assert.strictEqual(reactCollegeRes.status, 200);
    assert.strictEqual(reactCollegeRes.body.data.isActive, true);
    console.log('  ✔ College reactivated cleanly');

    // -----------------------------------------------------------------------
    // TEST 13: Edit College Details
    // -----------------------------------------------------------------------
    console.log('\n[TEST 13] Edit college details...');
    const editRes = await makeRequest({
      method: 'PUT',
      path: `/api/platform/colleges/${collegeAId}`,
      token: platformAdminToken,
      body: {
        name: 'Alpha Institute of Advanced Technology',
        officialEmail: 'info@aiat.test',
        address: '202 Silicon Corridor',
        city: 'Secunderabad',
        state: 'Telangana',
        contactNumber: '+91 9999888877',
      },
    });
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.body.data.name, 'Alpha Institute of Advanced Technology');
    assert.strictEqual(editRes.body.data.city, 'Secunderabad');

    const dbColAUpdated = await platformPrisma.college.findUnique({ where: { id: collegeAId } });
    assert.strictEqual(dbColAUpdated.name, 'Alpha Institute of Advanced Technology');
    assert.strictEqual(dbColAUpdated.city, 'Secunderabad');
    console.log('  ✔ College details updated and persisted in database');

    console.log('\n======================================================================');
    console.log('ALL 13 PLATFORM COLLEGE MANAGEMENT INTEGRATION TESTS PASSED PERFECTLY!');
    console.log('======================================================================\n');
  } finally {
    console.log('[CLEANUP] Tearing down test fixtures...');
    try {
      await cleanupTracked();
      console.log('[CLEANUP] Fixtures cleaned up successfully.');
    } catch (err) {
      console.error('[CLEANUP ERROR]', err.message);
    }

    if (server) {
      server.close();
    }
    await platformPrisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:\n', err);
  process.exit(1);
});
