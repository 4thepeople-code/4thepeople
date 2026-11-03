// Database URLs for local test run (must be set BEFORE any internal modules load PrismaClient)
const LOCAL_APP_URL = process.env.TEST_DATABASE_URL || 'postgresql://app_user:app_user_local_pass@127.0.0.1:5432/yuva_db?schema=public&pgbouncer=true';
const LOCAL_PLATFORM_URL = process.env.TEST_PLATFORM_DATABASE_URL || 'postgresql://platform_ops:platform_ops_local_pass@127.0.0.1:5432/yuva_db?schema=public';

process.env.DATABASE_URL = LOCAL_APP_URL;
process.env.PLATFORM_DATABASE_URL = LOCAL_PLATFORM_URL;

const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const { withTenant } = require('../config/db');
const { getCollegeBySlug, clearCollegeCache } = require('../config/collegeResolver');
const {
  resolveCollege,
  requireCollegeContext,
  getTrustedHost,
  extractSubdomain,
} = require('../middleware/resolveCollege');
const dbModule = require('../config/db');

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 1 VERIFICATION TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 1. Export Isolation Check
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Verifying config/db.js export boundaries...');
  assert.strictEqual(
    typeof dbModule.withTenant,
    'function',
    'FAIL: withTenant must be an exported function'
  );
  assert.deepStrictEqual(
    Object.keys(dbModule),
    ['withTenant'],
    'FAIL: config/db.js must export ONLY withTenant'
  );
  assert.strictEqual(
    dbModule.prisma,
    undefined,
    'FAIL: global prisma client must NOT be exported from config/db.js'
  );
  console.log('  ✔ config/db.js exports ONLY withTenant(). Global prisma client is not exposed.');

  // -------------------------------------------------------------------------
  // 2. ESLint no-restricted-imports enforcement
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifying ESLint no-restricted-imports rule for controllers...');
  const eslintBin = path.resolve(__dirname, '../../frontend/node_modules/eslint/bin/eslint.js');
  const fs = require('fs');

  // 2a. Verify that clean controllers pass ESLint
  try {
    execSync(`node "${eslintBin}" controllers/`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
    });
    console.log('  ✔ Existing controllers adhere to ESLint import restrictions.');
  } catch (err) {
    throw new Error(`ESLint failed on existing controllers: ${err.stderr.toString()}`);
  }

  // 2b. Negative control: verify that importing platformDb in a controller triggers ESLint failure
  const testViolationFile = path.resolve(__dirname, '../controllers/__test_violation__.js');
  fs.writeFileSync(
    testViolationFile,
    "const { platformPrisma } = require('../config/platformDb');\nmodule.exports = { platformPrisma };\n"
  );
  try {
    let violationCaught = false;
    try {
      execSync(`node "${eslintBin}" controllers/__test_violation__.js`, {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe',
      });
    } catch (violationErr) {
      const output = violationErr.stdout.toString() + violationErr.stderr.toString();
      assert.ok(
        (output.includes('no-restricted-modules') || output.includes('no-restricted-imports')) &&
          output.includes('platform_ops client'),
        `Unexpected ESLint error output: ${output}`
      );
      violationCaught = true;
    }
    assert.ok(violationCaught, 'FAIL: ESLint must block controllers from importing platformDb');
    console.log('  ✔ Negative control passed: Controller importing platformDb blocked by ESLint.');
  } finally {
    if (fs.existsSync(testViolationFile)) {
      fs.unlinkSync(testViolationFile);
    }
  }

  // -------------------------------------------------------------------------
  // 3. College Slug Resolution (No hardcoded UUIDs)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Resolving colleges dynamically by slug...');
  clearCollegeCache();

  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');

  assert.ok(collegeA, 'FAIL: College LBRCE (slug: lbrce) must exist in database');
  assert.ok(collegeB, 'FAIL: College VRSEC (slug: vrsec) must exist in database');
  assert.strictEqual(collegeA.slug, 'lbrce');
  assert.strictEqual(collegeB.slug, 'vrsec');
  assert.notStrictEqual(collegeA.id, collegeB.id);

  console.log(`  ✔ Resolved College A: slug='${collegeA.slug}', id='${collegeA.id}'`);
  console.log(`  ✔ Resolved College B: slug='${collegeB.slug}', id='${collegeB.id}'`);

  // -------------------------------------------------------------------------
  // 4. Subdomain & Hostname Resolution Middleware
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing hostname resolution and environment rules...');

  // 4a. Development mapping (.localhost) under development
  process.env.NODE_ENV = 'development';
  assert.strictEqual(extractSubdomain('lbrce.localhost'), 'lbrce');
  assert.strictEqual(extractSubdomain('vrsec.localhost:3000'), 'vrsec');
  assert.strictEqual(extractSubdomain('localhost:3000'), null);

  // 4b. Rejection of .localhost in production
  process.env.NODE_ENV = 'production';
  assert.strictEqual(
    extractSubdomain('lbrce.localhost'),
    null,
    'FAIL: .localhost must NOT be resolved in production'
  );
  assert.strictEqual(extractSubdomain('lbrce.4thepeople.in'), 'lbrce');
  assert.strictEqual(extractSubdomain('vrsec.4thepeople.in:443'), 'vrsec');
  assert.strictEqual(extractSubdomain('4thepeople.in'), null);
  process.env.NODE_ENV = 'test';

  // 4c. Proxy configuration: X-Forwarded-Host trusted ONLY when trust proxy is active
  const fakeReqWithProxy = {
    app: { get: (key) => (key === 'trust proxy' ? 1 : undefined) },
    headers: { 'x-forwarded-host': 'lbrce.4thepeople.in, cache.proxy.net', host: 'internal-lb:8080' },
  };
  assert.strictEqual(getTrustedHost(fakeReqWithProxy), 'lbrce.4thepeople.in');

  const fakeReqWithoutProxy = {
    app: { get: () => undefined },
    headers: { 'x-forwarded-host': 'spoofed.4thepeople.in', host: 'vrsec.4thepeople.in' },
  };
  assert.strictEqual(
    getTrustedHost(fakeReqWithoutProxy),
    'vrsec.4thepeople.in',
    'FAIL: Must NOT trust X-Forwarded-Host when trust proxy is disabled'
  );

  // 4d. Middleware execution
  let middlewareReq = {
    app: { get: () => 1 },
    headers: { 'x-forwarded-host': 'lbrce.localhost' },
  };
  let middlewareRes = {};
  let nextCalled = false;
  process.env.NODE_ENV = 'development';

  await resolveCollege(middlewareReq, middlewareRes, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled, 'FAIL: resolveCollege next() must be called');
  assert.strictEqual(middlewareReq.collegeId, collegeA.id);
  assert.strictEqual(middlewareReq.college.slug, 'lbrce');
  console.log('  ✔ Hostname resolution and environment security rules verified.');

  // -------------------------------------------------------------------------
  // 5. Case-Insensitive Email Handling under Prisma
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing case-insensitive email lookup and write normalization...');
  const testMixedEmail = 'AuditUser_' + Date.now() + '@LBRCE.In';
  const testNormalizedEmail = testMixedEmail.trim().toLowerCase();

  await withTenant(collegeA.id, async (tx) => {
    // Write user using normalized email
    const created = await tx.user.create({
      data: {
        collegeId: collegeA.id,
        name: 'Case Sensitivity Tester',
        email: testNormalizedEmail,
        role: 'USER',
        isActive: true,
      },
    });

    // Lookup 1: Query with uppercase
    const foundUpper = await tx.user.findFirst({
      where: { email: testMixedEmail.toUpperCase() },
    });
    assert.ok(foundUpper, 'FAIL: User must be found when querying with uppercase email (CITEXT)');
    assert.strictEqual(foundUpper.id, created.id);

    // Lookup 2: Query with lowercase
    const foundLower = await tx.user.findFirst({
      where: { email: testNormalizedEmail },
    });
    assert.ok(foundLower, 'FAIL: User must be found when querying with lowercase email');
    assert.strictEqual(foundLower.id, created.id);

    // Clean up
    await tx.user.delete({ where: { id: created.id } });
  });
  console.log('  ✔ Case-insensitive email operations verified under Prisma and CITEXT.');

  // -------------------------------------------------------------------------
  // 6. Concurrency Isolation Test: 50 Alternating A/B withTenant Calls
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Executing 50 alternating concurrent withTenant calls (A/B)...');
  const CONCURRENCY_COUNT = 50;
  const promises = [];

  for (let i = 0; i < CONCURRENCY_COUNT; i++) {
    const isCollegeA = i % 2 === 0;
    const targetCollege = isCollegeA ? collegeA : collegeB;
    const otherCollege = isCollegeA ? collegeB : collegeA;
    const callIndex = i + 1;

    const task = withTenant(targetCollege.id, async (tx) => {
      // 1. Verify transaction-local setting matches current task target
      const sessionResult = await tx.$queryRaw`SELECT current_setting('app.college_id', true) as tenant_id`;
      assert.strictEqual(
        sessionResult[0].tenant_id,
        targetCollege.id,
        `Call ${callIndex}: session setting mismatch`
      );

      // 2. Query users under RLS
      const users = await tx.user.findMany({ select: { id: true, collegeId: true } });
      for (const u of users) {
        assert.strictEqual(
          u.collegeId,
          targetCollege.id,
          `Call ${callIndex}: Cross-tenant user row leak! Expected ${targetCollege.id}, got ${u.collegeId}`
        );
        assert.notStrictEqual(
          u.collegeId,
          otherCollege.id,
          `Call ${callIndex}: Leaked user from other college (${otherCollege.id})!`
        );
      }

      // 3. Query clubs under RLS
      const clubs = await tx.club.findMany({ select: { id: true, collegeId: true } });
      for (const c of clubs) {
        assert.strictEqual(
          c.collegeId,
          targetCollege.id,
          `Call ${callIndex}: Cross-tenant club row leak! Expected ${targetCollege.id}, got ${c.collegeId}`
        );
      }

      return { callIndex, tenantSlug: targetCollege.slug, userCount: users.length };
    });

    promises.push(task);
  }

  const results = await Promise.all(promises);
  assert.strictEqual(results.length, CONCURRENCY_COUNT);
  console.log(`  ✔ Successfully completed ${CONCURRENCY_COUNT} interleaved concurrent transactions.`);
  console.log(`  ✔ Zero cross-tenant data leakage detected across all 50 parallel operations.`);

  console.log('\n======================================================================');
  console.log('ALL PHASE 1 TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('======================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
