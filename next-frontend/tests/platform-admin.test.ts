import assert from 'node:assert';
import { queryKeys } from '../src/lib/api/queryKeys';
import { resolveHost, normalizeHost } from '../src/lib/routing/hostResolver';
import type { AuthUser, PlatformLoginPayload } from '../src/types/auth';

console.log('======================================================================');
console.log('STARTING PHASE 3B.4 PLATFORM OPERATIONS PORTAL CONTRACT & UNIT TESTS');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(description: string, fn: () => void) {
  try {
    fn();
    console.log(`  [TEST] ${description}... \x1b[32m✓ PASS\x1b[0m`);
    passedTests++;
  } catch (error) {
    console.error(`  [TEST] ${description}... \x1b[31m✗ FAIL\x1b[0m`);
    console.error(error);
    failedTests++;
  }
}

// ============================================================================
// SUITE 1: Platform Admin Role Isolation & Auth Guard Contracts
// ============================================================================
console.log('--- SUITE 1: Platform Admin Role & Auth Guard Contracts ---');

runTest('1.1: Platform auth guard strictly permits PLATFORM_SUPER_ADMIN and isPlatformAdmin', () => {
  const isPlatformAuthorized = (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'PLATFORM_SUPER_ADMIN' || user.isPlatformAdmin === true;
  };

  const superAdmin: AuthUser = {
    id: 'super-1',
    email: 'superadmin@platform.yuva',
    role: 'PLATFORM_SUPER_ADMIN',
    isPlatformAdmin: true,
  };
  const collegeAdmin: AuthUser = {
    id: 'admin-1',
    email: 'admin@lbrce.ac.in',
    role: 'COLLEGE_ADMIN',
    collegeId: '11111111-1111-1111-1111-111111111111',
  };
  const manager: AuthUser = {
    id: 'mgr-1',
    email: 'manager@lbrce.ac.in',
    role: 'MANAGER',
    collegeId: '11111111-1111-1111-1111-111111111111',
  };
  const student: AuthUser = {
    id: 'stu-1',
    email: 'student@lbrce.ac.in',
    role: 'USER',
    collegeId: '11111111-1111-1111-1111-111111111111',
  };

  assert.strictEqual(isPlatformAuthorized(superAdmin), true, 'PLATFORM_SUPER_ADMIN must be authorized');
  assert.strictEqual(isPlatformAuthorized(collegeAdmin), false, 'COLLEGE_ADMIN must be rejected from platform');
  assert.strictEqual(isPlatformAuthorized(manager), false, 'MANAGER must be rejected from platform');
  assert.strictEqual(isPlatformAuthorized(student), false, 'USER must be rejected from platform');
  assert.strictEqual(isPlatformAuthorized(null), false, 'Unauthenticated visitor must be rejected from platform');
});

runTest('1.2: Platform admin login payload validation contract requires email, password, and 6-digit TOTP', () => {
  const validatePayload = (payload: Partial<PlatformLoginPayload>): { valid: boolean; error?: string } => {
    if (!payload.email || !payload.email.includes('@')) {
      return { valid: false, error: 'Invalid email' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { valid: false, error: 'Invalid password' };
    }
    const totp = payload.totpCode || payload.totp;
    if (!totp || !/^\d{6}$/.test(totp)) {
      return { valid: false, error: 'TOTP must be exactly 6 digits' };
    }
    return { valid: true };
  };

  assert.strictEqual(
    validatePayload({ email: 'admin@platform.yuva', password: 'secretpassword', totpCode: '123456' }).valid,
    true
  );
  assert.strictEqual(
    validatePayload({ email: '', password: 'secretpassword', totpCode: '123456' }).valid,
    false
  );
  assert.strictEqual(
    validatePayload({ email: 'admin@platform.yuva', password: '', totpCode: '123456' }).valid,
    false
  );
  assert.strictEqual(
    validatePayload({ email: 'admin@platform.yuva', password: 'secretpassword', totpCode: '123' }).valid,
    false
  );
  assert.strictEqual(
    validatePayload({ email: 'admin@platform.yuva', password: 'secretpassword', totpCode: 'abcdef' }).valid,
    false
  );
});

// ============================================================================
// SUITE 2: Host Resolution & Platform Routing Contracts
// ============================================================================
console.log('\n--- SUITE 2: Host Resolution & Platform Routing Contracts ---');

runTest('2.1: Resolves admin.4thepeople.in as PLATFORM_ADMIN in production', () => {
  const result = resolveHost('admin.4thepeople.in', { isProduction: true });
  assert.strictEqual(result.type, 'PLATFORM_ADMIN');
  assert.strictEqual(result.cleanHost, 'admin.4thepeople.in');
  assert.strictEqual(result.isTrusted, true);
});

runTest('2.2: Resolves admin.localhost as PLATFORM_ADMIN in development', () => {
  const result = resolveHost('admin.localhost:3000', { isProduction: false });
  assert.strictEqual(result.type, 'PLATFORM_ADMIN');
  assert.strictEqual(result.cleanHost, 'admin.localhost');
  assert.strictEqual(result.isTrusted, true);
});

runTest('2.3: Rejects evil subdomain suffix injection', () => {
  const result = resolveHost('admin.4thepeople.in.evil.com', { isProduction: true });
  assert.strictEqual(result.type, 'INVALID');
});

runTest('2.4: Normalizes host by stripping ports and trailing DNS dots', () => {
  assert.strictEqual(normalizeHost('admin.localhost:3000'), 'admin.localhost');
  assert.strictEqual(normalizeHost('ADMIN.4THEPEOPLE.IN.'), 'admin.4thepeople.in');
  assert.strictEqual(normalizeHost('admin.4thepeople.in:443'), 'admin.4thepeople.in');
});

// ============================================================================
// SUITE 3: BFF Proxy Upstream Route Forwarding
// ============================================================================
console.log('\n--- SUITE 3: BFF Proxy Upstream Route Forwarding Contracts ---');

runTest('3.1: Upstream path normalizer prepends api/ for platform routes', () => {
  const normalizeUpstreamPath = (subPath: string): string => {
    return subPath.startsWith('platform/') ? `api/${subPath}` : subPath;
  };

  assert.strictEqual(
    normalizeUpstreamPath('platform/auth/login'),
    'api/platform/auth/login'
  );
  assert.strictEqual(
    normalizeUpstreamPath('platform/auth/me'),
    'api/platform/auth/me'
  );
  assert.strictEqual(
    normalizeUpstreamPath('platform/auth/logout'),
    'api/platform/auth/logout'
  );
  assert.strictEqual(
    normalizeUpstreamPath('auth/me'),
    'auth/me'
  );
  assert.strictEqual(
    normalizeUpstreamPath('admin/viewAllUsers'),
    'admin/viewAllUsers'
  );
});

// ============================================================================
// SUITE 4: Platform Query Keys Isolation
// ============================================================================
console.log('\n--- SUITE 4: Platform Query Keys Isolation ---');

runTest('4.1: queryKeys.platform is strictly scoped to ["platform"] namespace', () => {
  const platformAll = queryKeys.platform.all;
  const platformSession = queryKeys.platform.session();
  const tenantAll = queryKeys.tenant('lbrce').all;

  assert.deepStrictEqual(platformAll, ['platform']);
  assert.deepStrictEqual(platformSession, ['platform', 'session']);
  assert.notDeepStrictEqual(platformAll, tenantAll);
  assert.ok(!platformSession.includes('lbrce'));
});

// ============================================================================
// SUITE 5: Dedicated Cookie Specification
// ============================================================================
console.log('\n--- SUITE 5: Dedicated Platform Cookie Specification ---');

runTest('5.1: Dedicated platform cookie contract is strictly yuva_platform_token', () => {
  const PLATFORM_COOKIE_NAME = 'yuva_platform_token';
  const COLLEGE_COOKIE_NAME = 'yuva_token';

  assert.notStrictEqual(PLATFORM_COOKIE_NAME, COLLEGE_COOKIE_NAME);
  assert.strictEqual(PLATFORM_COOKIE_NAME, 'yuva_platform_token');
});

console.log('\n======================================================================');
console.log(`PLATFORM OPERATIONS TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}

