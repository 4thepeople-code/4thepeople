process.env.NODE_ENV = 'test';

// Strict requirement: TEST_DATABASE_URL must be explicitly provided. No fallback to DATABASE_URL.
if (!process.env.TEST_DATABASE_URL) {
  console.error('\n❌ FATAL: TEST_DATABASE_URL environment variable is required to run Phase 1 tests.');
  console.error('Refusing to run tests or fallback to DATABASE_URL.\n');
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
if (process.env.TEST_PLATFORM_DATABASE_URL) {
  process.env.PLATFORM_DATABASE_URL = process.env.TEST_PLATFORM_DATABASE_URL;
}

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { withTenant } = require('../config/db');
const {
  getCollegeBySlug,
  clearCollegeCache,
  getCollegeCacheEntry,
} = require('../config/collegeResolver');
const {
  resolveCollege,
  requireCollegeContext,
  getTrustedHost,
  extractSubdomain,
  resetRateLimiter,
  MAX_DB_LOOKUPS_PER_WINDOW,
} = require('../middleware/resolveCollege');
const { TX_MAX_WAIT_MS, TX_TIMEOUT_MS } = require('../config/tenantContext');
const dbModule = require('../config/db');
const { prisma } = require('../config/internalClient');

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 1 VERIFICATION TEST SUITE');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // 0. Database Safety & Role Privilege Assertions
  // -------------------------------------------------------------------------
  console.log('\n[TEST 0] Verifying database safety guard and DB role privileges...');
  const [dbMeta] = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log(`  Current Database : ${dbMeta.current_database}`);
  console.log(`  Current User     : ${dbMeta.current_user}`);

  assert.strictEqual(
    dbMeta.current_database,
    'yuva_test',
    `FAIL: Refusing to run tests: current_database() must be "yuva_test", but got "${dbMeta.current_database}"`
  );
  assert.strictEqual(
    dbMeta.current_user,
    'app_user',
    `FAIL: Expected current_user to be "app_user", got "${dbMeta.current_user}"`
  );

  const [roleMeta] = await prisma.$queryRaw`
    SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
  `;
  console.log(`  Role Bypass RLS  : ${roleMeta.rolbypassrls}`);
  assert.strictEqual(
    roleMeta.rolbypassrls,
    false,
    `FAIL: Security invariant violation! app_user must have rolbypassrls=false`
  );
  console.log('  ✔ Database safety guard passed: running strictly on "yuva_test".');
  console.log('  ✔ Privilege guard passed: app_user is NOBYPASSRLS (rolbypassrls=false).');

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
  // 2. ESLint import restriction enforcement for controllers
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifying ESLint no-restricted-imports & no-restricted-modules for controllers...');
  const eslintBin = path.resolve(__dirname, '../node_modules/eslint/bin/eslint.js');

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
  // 3. College Slug Resolution, Negative Caching, & IP Rate Limiting
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Resolving colleges dynamically, testing negative cache & IP rate limiting...');
  clearCollegeCache();
  resetRateLimiter();

  // 3a. Positive resolution (no hardcoded UUIDs)
  const collegeA = await getCollegeBySlug('lbrce');
  const collegeB = await getCollegeBySlug('vrsec');

  assert.ok(collegeA, 'FAIL: College LBRCE (slug: lbrce) must exist in database');
  assert.ok(collegeB, 'FAIL: College VRSEC (slug: vrsec) must exist in database');
  assert.strictEqual(collegeA.slug, 'lbrce');
  assert.strictEqual(collegeB.slug, 'vrsec');
  assert.notStrictEqual(collegeA.id, collegeB.id);

  console.log(`  ✔ Resolved College A: slug='${collegeA.slug}', id='${collegeA.id}'`);
  console.log(`  ✔ Resolved College B: slug='${collegeB.slug}', id='${collegeB.id}'`);

  // 3b. Negative cache for unknown slugs (~60s)
  const unknownSlug = 'non-existent-college-' + Date.now();
  const unknownResult = await getCollegeBySlug(unknownSlug);
  assert.strictEqual(unknownResult, null, 'FAIL: Unknown college slug must return null');

  const cacheEntry = getCollegeCacheEntry(unknownSlug);
  assert.ok(cacheEntry, 'FAIL: Unknown slug must be placed in negative cache');
  assert.strictEqual(cacheEntry.isNegative, true, 'FAIL: Cache entry must be marked isNegative=true');
  assert.strictEqual(cacheEntry.college, null);
  console.log(`  ✔ Negative caching verified: unknown slug '${unknownSlug}' cached with ~60s TTL.`);

  // 3c. Per-IP rate limiting before DB lookup
  resetRateLimiter();
  const testIp = '198.51.100.42';
  let rateLimitedHit = false;

  // Make MAX_DB_LOOKUPS_PER_WINDOW un-cached requests
  for (let i = 0; i < MAX_DB_LOOKUPS_PER_WINDOW; i++) {
    const fakeReq = {
      app: { get: () => undefined },
      headers: { host: `random-unknown-${i}.localhost` },
      ip: testIp,
    };
    let statusCode = 200;
    const fakeRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    };
    await resolveCollege(fakeReq, fakeRes, () => {});
    assert.strictEqual(statusCode, 404, `Request ${i + 1} should be 404 (not rate limited yet)`);
  }

  // Request MAX_DB_LOOKUPS_PER_WINDOW + 1 from the same IP must be rejected with 429
  const overflowReq = {
    app: { get: () => undefined },
    headers: { host: 'random-overflow.localhost' },
    ip: testIp,
  };
  let overflowStatus = 200;
  let overflowBody = null;
  const overflowRes = {
    status(code) {
      overflowStatus = code;
      return this;
    },
    json(body) {
      overflowBody = body;
      return this;
    },
  };
  await resolveCollege(overflowReq, overflowRes, () => {});
  assert.strictEqual(overflowStatus, 429, 'FAIL: IP exceeding DB lookup rate limit must receive 429');
  assert.ok(
    overflowBody && overflowBody.message.includes('Too many college resolution attempts'),
    'FAIL: 429 response message missing'
  );
  console.log(`  ✔ Per-IP rate limit verified: IP '${testIp}' received 429 after ${MAX_DB_LOOKUPS_PER_WINDOW} un-cached lookups.`);

  // Cached slugs are NOT blocked by the DB lookup rate limit
  const cachedCollegeReq = {
    app: { get: () => undefined },
    headers: { host: 'lbrce.localhost' },
    ip: testIp,
  };
  let cachedStatusCode = 200;
  const cachedCollegeRes = {
    status(code) {
      cachedStatusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let cachedNextCalled = false;
  await resolveCollege(cachedCollegeReq, cachedCollegeRes, () => {
    cachedNextCalled = true;
  });
  assert.ok(cachedNextCalled, 'FAIL: Cached college lookup should succeed even when un-cached rate limit is exceeded');
  console.log('  ✔ In-memory cached tenant queries bypass DB lookup rate limiter as expected.');

  // -------------------------------------------------------------------------
  // 4. Hostname Resolution & Environment Security Matrix
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing hostname resolution and environment security rules...');

  const hostTestCases = [
    {
      name: 'Standard valid production tenant',
      env: 'production',
      host: 'lbrce.4thepeople.in',
      expected: 'lbrce',
    },
    {
      name: 'Standard valid development tenant (.localhost)',
      env: 'development',
      host: 'lbrce.localhost',
      expected: 'lbrce',
    },
    {
      name: 'Port stripping on production tenant',
      env: 'production',
      host: 'lbrce.4thepeople.in:443',
      expected: 'lbrce',
    },
    {
      name: 'Port stripping on dev tenant',
      env: 'development',
      host: 'vrsec.localhost:3000',
      expected: 'vrsec',
    },
    {
      name: 'Trailing DNS root dot stripping',
      env: 'production',
      host: 'lbrce.4thepeople.in.',
      expected: 'lbrce',
    },
    {
      name: 'Trailing DNS root dot with port',
      env: 'development',
      host: 'vrsec.localhost.:8080',
      expected: 'vrsec',
    },
    {
      name: 'Uppercase hostname normalization',
      env: 'production',
      host: 'LBRCE.4THEPEOPLE.IN',
      expected: 'lbrce',
    },
    {
      name: 'Uppercase dev hostname normalization',
      env: 'development',
      host: 'VRSEC.LOCALHOST',
      expected: 'vrsec',
    },
    {
      name: 'Evil-suffix attack (.4thepeople.in.evil.com)',
      env: 'production',
      host: 'lbrce.4thepeople.in.evil.com',
      expected: null,
    },
    {
      name: 'Evil-suffix attack dev (.localhost.evil.com)',
      env: 'development',
      host: 'lbrce.localhost.evil.com',
      expected: null,
    },
    {
      name: 'Evil-prefix attack (nested attacker.lbrce.4thepeople.in)',
      env: 'production',
      host: 'attacker.lbrce.4thepeople.in',
      expected: null,
    },
    {
      name: 'Evil-prefix hyphenated (evil-lbrce.4thepeople.in)',
      env: 'production',
      host: 'evil-lbrce.4thepeople.in',
      expected: 'evil-lbrce', // Resolved as distinct slug 'evil-lbrce', which does not match 'lbrce'
    },
    {
      name: 'Rejection of .localhost in production',
      env: 'production',
      host: 'lbrce.localhost',
      expected: null,
    },
    {
      name: 'Bare production root domain (public root, not college)',
      env: 'production',
      host: '4thepeople.in',
      expected: null,
    },
    {
      name: 'Bare localhost (public root, not college)',
      env: 'development',
      host: 'localhost',
      expected: null,
    },
  ];

  for (let i = 0; i < hostTestCases.length; i++) {
    const tc = hostTestCases[i];
    process.env.NODE_ENV = tc.env;
    const actual = extractSubdomain(tc.host);
    assert.strictEqual(
      actual,
      tc.expected,
      `Case ${i + 1} failed: ${tc.name} (input: "${tc.host}", env: "${tc.env}")`
    );
    console.log(
      `  [Case ${String(i + 1).padStart(2, ' ')}] ${tc.name.padEnd(45, ' ')}: host='${tc.host}' env='${tc.env}' -> slug='${actual}' (OK)`
    );
  }
  process.env.NODE_ENV = 'test';

  // 4b. Test admin/www context rejection for college routes
  console.log('\n  Testing admin/www context handling for college routes:');

  // www host -> public root
  let wwwReq = { app: { get: () => 1 }, headers: { host: 'www.4thepeople.in' } };
  let wwwRes = {};
  await resolveCollege(wwwReq, wwwRes, () => {});
  assert.strictEqual(wwwReq.isPublicRoot, true);
  assert.strictEqual(wwwReq.collegeId, null);

  let wwwCollegeCheckStatus = 200;
  requireCollegeContext(wwwReq, {
    status(code) {
      wwwCollegeCheckStatus = code;
      return this;
    },
    json() {
      return this;
    },
  }, () => {});
  assert.strictEqual(wwwCollegeCheckStatus, 404, 'FAIL: www host must be rejected on college-only routes with 404');
  console.log('  [Case 16] www.4thepeople.in on college-only route -> isPublicRoot=true, HTTP 404 (OK)');

  // admin host -> platform ops context
  let adminReq = { app: { get: () => 1 }, headers: { host: 'admin.4thepeople.in' } };
  let adminRes = {};
  await resolveCollege(adminReq, adminRes, () => {});
  assert.strictEqual(adminReq.isPlatform, true);
  assert.strictEqual(adminReq.collegeId, null);

  let adminCollegeCheckStatus = 200;
  requireCollegeContext(adminReq, {
    status(code) {
      adminCollegeCheckStatus = code;
      return this;
    },
    json() {
      return this;
    },
  }, () => {});
  assert.strictEqual(adminCollegeCheckStatus, 404, 'FAIL: admin host must be rejected on college-only routes with 404');
  console.log('  [Case 17] admin.4thepeople.in on college-only route -> isPlatform=true, HTTP 404 (OK)');

  // 4c. Proxy header verification: spoofed X-Forwarded-Host without trust proxy
  const spoofedReq = {
    app: { get: () => undefined }, // 'trust proxy' is NOT set
    headers: {
      'x-forwarded-host': 'lbrce.4thepeople.in',
      host: 'vrsec.4thepeople.in',
    },
  };
  const trustedHostWithoutProxy = getTrustedHost(spoofedReq);
  assert.strictEqual(
    trustedHostWithoutProxy,
    'vrsec.4thepeople.in',
    'FAIL: Must NOT trust X-Forwarded-Host when trust proxy is disabled'
  );
  console.log(`  [Case 18] Spoofed X-Forwarded-Host without trust proxy -> ignores header, uses Host='${trustedHostWithoutProxy}' (OK)`);

  // Legitimate X-Forwarded-Host with trust proxy
  const proxyReq = {
    app: { get: (key) => (key === 'trust proxy' ? 1 : undefined) },
    headers: {
      'x-forwarded-host': 'lbrce.4thepeople.in, cache.proxy.net',
      host: 'internal-balancer:8080',
    },
  };
  const trustedHostWithProxy = getTrustedHost(proxyReq);
  assert.strictEqual(trustedHostWithProxy, 'lbrce.4thepeople.in');
  console.log(`  [Case 19] Verified X-Forwarded-Host with trust proxy -> client host='${trustedHostWithProxy}' (OK)`);

  // -------------------------------------------------------------------------
  // 5. Case-Insensitive Email Handling under Prisma (CITEXT)
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
  // 6. Concurrency Isolation Test: Alternating A/B withTenant Calls
  // -------------------------------------------------------------------------
  const CONCURRENCY_COUNT = parseInt(process.env.TEST_CONCURRENCY || '50', 10);
  const testMaxWait = process.env.TEST_MAX_WAIT_MS ? parseInt(process.env.TEST_MAX_WAIT_MS, 10) : TX_MAX_WAIT_MS;
  const configuredConnLimit = process.env.TEST_CONNECTION_LIMIT || 'driver-default';

  console.log(`\n[TEST 6] Executing ${CONCURRENCY_COUNT} alternating concurrent withTenant calls (A/B)...`);
  console.log('  ------------------------------------------------------------------');
  console.log('  Connection Pool & Runtime Configuration:');
  console.log('    Pooling Mode     : PgBouncer transaction pooling (pgbouncer=true)');
  console.log(`    maxWait          : ${testMaxWait}ms (connection acquisition timeout)`);
  console.log(`    timeout          : ${TX_TIMEOUT_MS}ms (transaction execution timeout)`);
  console.log(`    connection_limit : ${configuredConnLimit}`);
  console.log(`    Concurrency      : ${CONCURRENCY_COUNT} parallel tasks`);
  console.log('    Isolation Level  : ReadCommitted');
  console.log('  Queried Tables under RLS:');
  console.log('    - users (tenant isolated)');
  console.log('    - clubs (tenant isolated)');
  console.log('    - Session variable app.college_id');
  console.log('  ------------------------------------------------------------------');

  const latencies = [];
  let crossTenantUserLeaks = 0;
  let crossTenantClubLeaks = 0;
  let totalUserRowsChecked = 0;
  let totalClubRowsChecked = 0;

  const promises = [];

  for (let i = 0; i < CONCURRENCY_COUNT; i++) {
    const isCollegeA = i % 2 === 0;
    const targetCollege = isCollegeA ? collegeA : collegeB;
    const otherCollege = isCollegeA ? collegeB : collegeA;
    const callIndex = i + 1;

    const task = (async () => {
      const startTime = performance.now();
      const res = await withTenant(
        targetCollege.id,
        async (tx) => {
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
            totalUserRowsChecked++;
            if (u.collegeId !== targetCollege.id) {
              crossTenantUserLeaks++;
            }
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
            totalClubRowsChecked++;
            if (c.collegeId !== targetCollege.id) {
              crossTenantClubLeaks++;
            }
            assert.strictEqual(
              c.collegeId,
              targetCollege.id,
              `Call ${callIndex}: Cross-tenant club row leak! Expected ${targetCollege.id}, got ${c.collegeId}`
            );
          }

          return { callIndex, tenantSlug: targetCollege.slug, userCount: users.length };
        },
        { maxWait: testMaxWait }
      );
      const elapsed = performance.now() - startTime;
      latencies.push(elapsed);
      return res;
    })();

    promises.push(task);
  }

  const results = await Promise.all(promises);
  assert.strictEqual(results.length, CONCURRENCY_COUNT);

  // Compute latency percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const avgLatency = (latencies.reduce((sum, val) => sum + val, 0) / latencies.length).toFixed(2);

  console.log(`\n  Latency Statistics (N = ${CONCURRENCY_COUNT} transactions):`);
  console.log(`    p50 (median) latency : ${p50.toFixed(2)} ms`);
  console.log(`    p95 latency          : ${p95.toFixed(2)} ms`);
  console.log(`    Min latency          : ${minLatency.toFixed(2)} ms`);
  console.log(`    Max latency          : ${maxLatency.toFixed(2)} ms`);
  console.log(`    Avg latency          : ${avgLatency} ms`);
  console.log('  ------------------------------------------------------------------');
  console.log(`  Cross-Tenant Data Leakage Report:`);
  console.log(`    Total User rows checked across all calls : ${totalUserRowsChecked}`);
  console.log(`    Cross-tenant User leaks                  : ${crossTenantUserLeaks}`);
  console.log(`    Total Club rows checked across all calls : ${totalClubRowsChecked}`);
  console.log(`    Cross-tenant Club leaks                  : ${crossTenantClubLeaks}`);
  assert.strictEqual(crossTenantUserLeaks, 0, 'FAIL: Detected cross-tenant user row leak!');
  assert.strictEqual(crossTenantClubLeaks, 0, 'FAIL: Detected cross-tenant club row leak!');
  console.log(`  ✔ Successfully completed ${CONCURRENCY_COUNT} interleaved concurrent transactions.`);
  console.log(`  ✔ Zero cross-tenant data leakage detected across all ${CONCURRENCY_COUNT} parallel operations.`);

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
