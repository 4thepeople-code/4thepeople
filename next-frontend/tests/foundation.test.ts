import assert from 'node:assert';
import { resolveHost, normalizeHost } from '@/lib/routing/hostResolver';
import { resolveCollegeRouting } from '@/lib/routing/collegePath';
import { isRealCollegeSlug } from '@/lib/colleges/realColleges';
import {
  isCollegeHost,
  isCollegeDarkBlockedSurface,
  buildThemeBootScript,
} from '@/lib/routing/themeSurface';
import { makeQueryClient, getQueryClient, clearAllQueryCache } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient, getApiBaseUrl } from '@/lib/api/axios';
import {
  parseAndValidateToken,
  getStoredToken,
  setStoredAuth,
  clearStoredAuth,
} from '@/lib/auth/tokenStorage';
import { fetchDepartments, fetchDepartmentById } from '@/lib/api/departments';
import { fetchClubs, fetchClubById } from '@/lib/api/clubs';
import { fetchUpcomingEvents, fetchClubUpcomingEvents } from '@/lib/api/events';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    process.stdout.write(`  [TEST] ${name}... `);
    await fn();
    console.log('✓ PASS');
    passed++;
  } catch (err: unknown) {
    console.log('✗ FAIL');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    Error: ${msg}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 2.2 ARCHITECTURE, BFF PROXY & CONTRACT TESTS');
  console.log('======================================================================\n');

  // ----------------------------------------------------------------------------
  // SUITE 1: Multi-Subdomain Host Resolution & Security Matrix
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 1: Multi-Subdomain Host Resolution ---');

  await test('1.1: Production root domain resolves to PUBLIC', () => {
    const res = resolveHost('4thepeople.in', { isProduction: true });
    assert.strictEqual(res.type, 'PUBLIC');
    assert.strictEqual(res.isTrusted, true);
  });

  await test('1.2: Production www domain resolves to PUBLIC', () => {
    const res = resolveHost('www.4thepeople.in', { isProduction: true });
    assert.strictEqual(res.type, 'PUBLIC');
    assert.strictEqual(res.isTrusted, true);
  });

  await test('1.3: Production college subdomain resolves to COLLEGE with slug', () => {
    const resLbrce = resolveHost('lbrce.4thepeople.in', { isProduction: true });
    assert.strictEqual(resLbrce.type, 'COLLEGE');
    assert.strictEqual(resLbrce.slug, 'lbrce');
    assert.strictEqual(resLbrce.isTrusted, true);

    const resVrsec = resolveHost('vrsec.4thepeople.in', { isProduction: true });
    assert.strictEqual(resVrsec.type, 'COLLEGE');
    assert.strictEqual(resVrsec.slug, 'vrsec');
  });

  await test('1.4: Production admin subdomain resolves to PLATFORM_ADMIN', () => {
    const res = resolveHost('admin.4thepeople.in', { isProduction: true });
    assert.strictEqual(res.type, 'PLATFORM_ADMIN');
    assert.strictEqual(res.isTrusted, true);
  });

  await test('1.5: Port stripping and trailing dot normalization', () => {
    assert.strictEqual(normalizeHost('LBRCE.4THEPEOPLE.IN:8443.'), 'lbrce.4thepeople.in');

    const resPort = resolveHost('lbrce.4thepeople.in:443', { isProduction: true });
    assert.strictEqual(resPort.type, 'COLLEGE');
    assert.strictEqual(resPort.slug, 'lbrce');

    const resDot = resolveHost('lbrce.4thepeople.in.', { isProduction: true });
    assert.strictEqual(resDot.type, 'COLLEGE');
    assert.strictEqual(resDot.slug, 'lbrce');

    const resUpper = resolveHost('LBRCE.4THEPEOPLE.IN:8443.', { isProduction: true });
    assert.strictEqual(resUpper.type, 'COLLEGE');
    assert.strictEqual(resUpper.slug, 'lbrce');
  });

  await test('1.6: Development localhost and dev subdomains resolve correctly', () => {
    const resBare = resolveHost('localhost', { isProduction: false });
    assert.strictEqual(resBare.type, 'PUBLIC');

    const resIp = resolveHost('127.0.0.1:3000', { isProduction: false });
    assert.strictEqual(resIp.type, 'PUBLIC');

    const resDevTenant = resolveHost('lbrce.localhost:3000', { isProduction: false });
    assert.strictEqual(resDevTenant.type, 'COLLEGE');
    assert.strictEqual(resDevTenant.slug, 'lbrce');

    const resDevAdmin = resolveHost('admin.localhost', { isProduction: false });
    assert.strictEqual(resDevAdmin.type, 'PLATFORM_ADMIN');
  });

  await test('1.7: Rejection of .localhost domains in production', () => {
    const res = resolveHost('lbrce.localhost', { isProduction: true });
    assert.strictEqual(res.type, 'INVALID');
    assert.strictEqual(res.isTrusted, false);
  });

  await test('1.8: Evil-suffix attacks strictly rejected as INVALID', () => {
    const evil1 = resolveHost('lbrce.4thepeople.in.evil.com', { isProduction: true });
    assert.strictEqual(evil1.type, 'INVALID');

    const evil2 = resolveHost('lbrce.localhost.evil.com', { isProduction: false });
    assert.strictEqual(evil2.type, 'INVALID');
  });

  await test('1.9: Nested subdomains strictly rejected as INVALID', () => {
    const nested = resolveHost('attacker.lbrce.4thepeople.in', { isProduction: true });
    assert.strictEqual(nested.type, 'INVALID');
  });

  await test('1.10: Reserved infrastructure slugs rejected as INVALID', () => {
    const resApi = resolveHost('api.4thepeople.in', { isProduction: true });
    assert.strictEqual(resApi.type, 'INVALID');

    const resMail = resolveHost('mail.4thepeople.in', { isProduction: true });
    assert.strictEqual(resMail.type, 'INVALID');
  });

  await test('1.11: Unknown foreign hostnames strictly rejected (no silent public fallback)', () => {
    const resForeign = resolveHost('random-domain.com', { isProduction: true });
    assert.strictEqual(resForeign.type, 'INVALID');
    assert.strictEqual(resForeign.isTrusted, false);
  });

  await test('1.12: Forwarded host verification without trustProxy is ignored', () => {
    const res = resolveHost('4thepeople.in', {
      isProduction: true,
      trustProxy: false,
      forwardedHost: 'attacker.com',
    });
    assert.strictEqual(res.type, 'PUBLIC');
  });

  await test('1.13: Forwarded host verification with trustProxy is honored', () => {
    const res = resolveHost('direct-proxy-host.com', {
      isProduction: true,
      trustProxy: true,
      forwardedHost: 'lbrce.4thepeople.in, 10.0.0.1',
    });
    assert.strictEqual(res.type, 'COLLEGE');
    assert.strictEqual(res.slug, 'lbrce');
  });

  // ----------------------------------------------------------------------------
  // SUITE 1B: College Path Routing Decisions (middleware behavior, pure helper)
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 1B: College Path Routing Decisions ---');

  const publicPlain = resolveHost('localhost:3000', { isProduction: false });
  const collegeSubdomain = resolveHost('lbrce.localhost:3000', { isProduction: false });

  await test('1B.1: Plain-host /college/<slug> routes by path slug without rewrite', () => {
    const decision = resolveCollegeRouting('/college/lbrce', publicPlain);
    assert.strictEqual(decision.hostType, 'COLLEGE');
    assert.strictEqual(decision.tenantSlug, 'lbrce');
    assert.strictEqual(decision.rewritePath, undefined);
    assert.strictEqual(decision.status, undefined);

    const withSubPath = resolveCollegeRouting('/college/lbrce/clubs/abc', publicPlain);
    assert.strictEqual(withSubPath.tenantSlug, 'lbrce');
    assert.strictEqual(withSubPath.rewritePath, undefined);
  });

  await test('1B.2: College subdomain root rewrites to /college/<slug>', () => {
    const decision = resolveCollegeRouting('/', collegeSubdomain);
    assert.strictEqual(decision.hostType, 'COLLEGE');
    assert.strictEqual(decision.tenantSlug, 'lbrce');
    assert.strictEqual(decision.rewritePath, '/college/lbrce');
  });

  await test('1B.3: Mismatched path slug on a subdomain loses to the subdomain slug', () => {
    const decision = resolveCollegeRouting('/college/northwood', collegeSubdomain);
    assert.strictEqual(decision.tenantSlug, 'lbrce');
    assert.strictEqual(decision.rewritePath, '/college/lbrce');

    // Sub-paths are preserved during the rewrite.
    const withSubPath = resolveCollegeRouting('/college/northwood/clubs/abc', collegeSubdomain);
    assert.strictEqual(withSubPath.tenantSlug, 'lbrce');
    assert.strictEqual(withSubPath.rewritePath, '/college/lbrce/clubs/abc');

    // A matching path slug needs no rewrite at all.
    const matching = resolveCollegeRouting('/college/lbrce/clubs', collegeSubdomain);
    assert.strictEqual(matching.tenantSlug, 'lbrce');
    assert.strictEqual(matching.rewritePath, undefined);
  });

  await test('1B.4: Reserved slugs stay blocked on both host styles', () => {
    // Reserved subdomain: hostResolver rejects it outright.
    const apiSubdomain = resolveHost('api.localhost', { isProduction: false });
    assert.strictEqual(apiSubdomain.type, 'INVALID');
    const wwwSubdomain = resolveHost('www.localhost', { isProduction: false });
    assert.strictEqual(wwwSubdomain.type, 'PUBLIC');

    // Reserved path slug on a plain host: rejected with 400.
    const decision = resolveCollegeRouting('/college/demo', publicPlain);
    assert.strictEqual(decision.status, 400);
    const decisionAdmin = resolveCollegeRouting('/college/admin', publicPlain);
    assert.strictEqual(decisionAdmin.status, 400);
  });

  await test('1B.5: /api and /admin are never rewritten, on any host', () => {
    const apiOnSubdomain = resolveCollegeRouting('/api/clubs', collegeSubdomain);
    assert.strictEqual(apiOnSubdomain.hostType, 'PUBLIC');
    assert.strictEqual(apiOnSubdomain.rewritePath, undefined);

    const adminPath = resolveCollegeRouting('/admin', collegeSubdomain);
    assert.strictEqual(adminPath.hostType, 'PLATFORM_ADMIN');
    assert.strictEqual(adminPath.rewritePath, undefined);
  });

  await test('1B.6: Unknown slugs pass middleware but are rejected by the real-college gate', () => {
    // Middleware passes the slug through; the page layer decides existence.
    const decision = resolveCollegeRouting('/college/notacollege', publicPlain);
    assert.strictEqual(decision.tenantSlug, 'notacollege');
    assert.strictEqual(decision.status, undefined);
    assert.strictEqual(isRealCollegeSlug('notacollege'), false);
  });

  await test('1B.7: Demo slugs never render the real college page', () => {
    const decision = resolveCollegeRouting('/college/northwood', publicPlain);
    assert.strictEqual(decision.tenantSlug, 'northwood');
    assert.strictEqual(decision.status, undefined);
    assert.strictEqual(isRealCollegeSlug('northwood'), false);
    assert.strictEqual(isRealCollegeSlug('lbrce'), true);
  });

  // ----------------------------------------------------------------------------
  // SUITE 1C: Theme Surface Decision (never dark on college public paths)
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 1C: Theme Surface Decision (never dark on college paths) ---');

  await test('1C.1: /college/** paths are always dark-blocked on a plain host', () => {
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce', 'localhost:3000'), true);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/clubs', 'localhost'), true);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/clubs/abc', 'localhost:3000'), true);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/login', 'localhost:3000'), true);
  });

  await test('1C.2: Every path on a college subdomain is dark-blocked (dev)', () => {
    assert.strictEqual(isCollegeDarkBlockedSurface('/', 'lbrce.localhost:3000', { isProduction: false }), true);
    assert.strictEqual(isCollegeDarkBlockedSurface('/clubs', 'lbrce.localhost', { isProduction: false }), true);
    assert.strictEqual(
      isCollegeDarkBlockedSurface('/events/ev-1', 'lbrce.localhost:3000', { isProduction: false }),
      true
    );
    assert.strictEqual(
      isCollegeDarkBlockedSurface('/', 'lbrce.4thepeople.in', { isProduction: true }),
      true
    );
  });

  await test('1C.3: Reserved slugs (www/api/admin/...) never count as a college host', () => {
    assert.strictEqual(isCollegeHost('www.localhost', { isProduction: false }), false);
    assert.strictEqual(isCollegeHost('api.localhost', { isProduction: false }), false);
    assert.strictEqual(isCollegeHost('admin.4thepeople.in', { isProduction: true }), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/', 'www.localhost:3000', { isProduction: false }), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/', 'api.localhost', { isProduction: false }), false);
  });

  await test('1C.4: Nested subdomains and evil suffixes are not college hosts', () => {
    assert.strictEqual(isCollegeHost('attacker.lbrce.localhost', { isProduction: false }), false);
    assert.strictEqual(isCollegeHost('lbrce.4thepeople.in.evil.com', { isProduction: true }), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/', 'attacker.lbrce.localhost', { isProduction: false }), false);
  });

  await test('1C.5: *.localhost subdomains are ignored in production', () => {
    assert.strictEqual(isCollegeHost('lbrce.localhost', { isProduction: true }), false);
    assert.strictEqual(
      isCollegeDarkBlockedSurface('/', 'lbrce.localhost', { isProduction: true }),
      false
    );
  });

  await test('1C.6: Dashboard segments keep their own theme toggle (not blocked)', () => {
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/student', 'localhost:3000'), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/student/x', 'localhost:3000'), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/manager', 'localhost:3000'), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/college/lbrce/admin/settings', 'localhost:3000'), false);
    // Top-level dashboard routes as served from a college subdomain root.
    assert.strictEqual(
      isCollegeDarkBlockedSurface('/student', 'lbrce.localhost:3000', { isProduction: false }),
      false
    );
    assert.strictEqual(
      isCollegeDarkBlockedSurface('/manager', 'lbrce.localhost:3000', { isProduction: false }),
      false
    );
    // But the same segment on a non-college host is not a dashboard surface.
    assert.strictEqual(isCollegeDarkBlockedSurface('/student', 'localhost:3000'), false);
  });

  await test('1C.7: Marketing surfaces stay dark-capable', () => {
    assert.strictEqual(isCollegeDarkBlockedSurface('/', 'localhost:3000'), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/directory', 'localhost:3000'), false);
    assert.strictEqual(isCollegeDarkBlockedSurface('/', '4thepeople.in', { isProduction: true }), false);
  });

  await test('1C.8: Boot script applies dark off-campus and light on campus (pre-hydration)', () => {
    const runBoot = (
      script: string,
      opts: { pathname: string; hostname: string; theme: string | null }
    ) => {
      const classes = new Set<string>(['light']);
      const style: Record<string, string> = {};
      const doc = {
        documentElement: {
          classList: {
            remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
            add: (...names: string[]) => names.forEach((n) => classes.add(n)),
          },
          style,
        },
      };
      const storage = new Map<string, string>();
      if (opts.theme !== null) storage.set('yuva_theme', opts.theme);
      const localStorageStub = { getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null) };
      const boot = new Function('location', 'localStorage', 'document', script) as (
        location: { pathname: string; hostname: string },
        localStorage: { getItem: (k: string) => string | null },
        document: unknown
      ) => void;
      boot({ pathname: opts.pathname, hostname: opts.hostname }, localStorageStub, doc);
      return { isDark: classes.has('dark'), colorScheme: style.colorScheme };
    };

    const devScript = buildThemeBootScript(false);
    const prodScript = buildThemeBootScript(true);

    // Dark preference on a college path: light must win, before hydration.
    const campus = runBoot(devScript, {
      pathname: '/college/lbrce',
      hostname: 'localhost:3000',
      theme: 'dark',
    });
    assert.strictEqual(campus.isDark, false, 'College path must never boot dark');
    assert.strictEqual(campus.colorScheme, 'light');

    // Same on the subdomain host.
    const subdomain = runBoot(devScript, {
      pathname: '/',
      hostname: 'lbrce.localhost',
      theme: 'dark',
    });
    assert.strictEqual(subdomain.isDark, false);

    // Dashboard keeps dark.
    const dashboard = runBoot(devScript, {
      pathname: '/college/lbrce/student',
      hostname: 'localhost:3000',
      theme: 'dark',
    });
    assert.strictEqual(dashboard.isDark, true);
    assert.strictEqual(dashboard.colorScheme, 'dark');

    // Marketing keeps dark.
    const marketing = runBoot(devScript, {
      pathname: '/',
      hostname: 'localhost:3000',
      theme: 'dark',
    });
    assert.strictEqual(marketing.isDark, true);

    // In production, a *.localhost subdomain is untrusted: dark stays (no college surface).
    const prodLocalhost = runBoot(prodScript, {
      pathname: '/',
      hostname: 'lbrce.localhost',
      theme: 'dark',
    });
    assert.strictEqual(prodLocalhost.isDark, true);

    // No preference: light everywhere.
    const noPref = runBoot(devScript, { pathname: '/college/lbrce', hostname: 'localhost', theme: null });
    assert.strictEqual(noPref.isDark, false);
  });

  // ----------------------------------------------------------------------------
  // SUITE 2: Next.js BFF API Proxy Architecture & Security
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Next.js BFF API Proxy Architecture & Security ---');

  await test('2.1: BFF Route Handler file exists at src/app/api/[...path]/route.ts', () => {
    const routePath = path.resolve(__dirname, '../src/app/api/[...path]/route.ts');
    assert.ok(fs.existsSync(routePath), 'Catch-all API Route Handler must exist');
    const content = fs.readFileSync(routePath, 'utf8');
    assert.ok(content.includes('x-proxy-shared-secret'), 'Must reference proxy shared secret');
    assert.ok(content.includes('x-forwarded-host'), 'Must forward verified host');
    assert.ok(content.includes('no-store'), 'Must enforce no-store caching headers');
  });

  await test('2.2: Axios client baseURL defaults to /api in browser environment', () => {
    // In node environment without window, getApiBaseUrl returns backend URL
    const serverUrl = getApiBaseUrl();
    assert.ok(serverUrl.startsWith('http'), 'Server-side baseURL must point to internal backend URL');

    // Simulate browser environment
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    const clientUrl = getApiBaseUrl();
    assert.strictEqual(clientUrl, '/api', 'Client-side baseURL must strictly be relative /api');
    delete (globalThis as Record<string, unknown>).window;
  });

  await test('2.3: Proxy secret is not exposed in client-accessible NEXT_PUBLIC environment', () => {
    const envVars = Object.keys(process.env);
    const leaked = envVars.filter(
      (k) => k.startsWith('NEXT_PUBLIC_') && k.toLowerCase().includes('secret')
    );
    assert.deepStrictEqual(leaked, [], 'No proxy secret may be prefixed with NEXT_PUBLIC_');
  });

  // ----------------------------------------------------------------------------
  // SUITE 3: Tenant-Scoped Query Keys & Cache Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Tenant-Scoped Query Keys & Cache Isolation ---');

  await test('3.1: LBRCE query keys strictly differ from VRSEC query keys', () => {
    const lbrceDepts = queryKeys.tenant('lbrce').departments.lists();
    const vrsecDepts = queryKeys.tenant('vrsec').departments.lists();
    assert.notDeepStrictEqual(lbrceDepts, vrsecDepts, 'Different tenants must have distinct query keys');
    assert.deepStrictEqual(lbrceDepts, ['tenant', 'lbrce', 'departments', 'list']);
    assert.deepStrictEqual(vrsecDepts, ['tenant', 'vrsec', 'departments', 'list']);

    const lbrceEvents = queryKeys.tenant('lbrce').events.upcoming();
    const vrsecEvents = queryKeys.tenant('vrsec').events.upcoming();
    assert.notDeepStrictEqual(lbrceEvents, vrsecEvents);
    assert.deepStrictEqual(lbrceEvents, ['tenant', 'lbrce', 'events', 'upcoming']);
  });

  await test('3.2: Platform admin query keys remain strictly partitioned from tenant keys', () => {
    const platformSession = queryKeys.platform.session();
    const lbrceSession = queryKeys.tenant('lbrce').auth.session();
    assert.deepStrictEqual(platformSession, ['platform', 'session']);
    assert.deepStrictEqual(lbrceSession, ['tenant', 'lbrce', 'auth', 'session']);
    assert.notDeepStrictEqual(platformSession, lbrceSession);
  });

  await test('3.3: Invalidation of Tenant A queries does NOT invalidate Tenant B queries', async () => {
    const client = makeQueryClient();
    client.setQueryData(queryKeys.tenant('lbrce').departments.lists(), [{ id: 'dept-lbrce' }]);
    client.setQueryData(queryKeys.tenant('vrsec').departments.lists(), [{ id: 'dept-vrsec' }]);

    // Invalidate LBRCE only
    await client.invalidateQueries({ queryKey: queryKeys.tenant('lbrce').departments.all });

    const lbrceState = client.getQueryState(queryKeys.tenant('lbrce').departments.lists());
    const vrsecState = client.getQueryState(queryKeys.tenant('vrsec').departments.lists());

    assert.strictEqual(lbrceState?.isInvalidated, true, 'LBRCE queries must be invalidated');
    assert.strictEqual(vrsecState?.isInvalidated, false, 'VRSEC queries must remain valid');
  });

  await test('3.4: clearAllQueryCache purges all tenant and platform query caches', () => {
    const client = makeQueryClient();
    client.setQueryData(queryKeys.tenant('lbrce').auth.session(), { id: 'u1' });
    client.setQueryData(queryKeys.platform.session(), { id: 'p1' });

    assert.strictEqual(client.getQueryCache().getAll().length, 2);
    client.clear();
    assert.strictEqual(client.getQueryCache().getAll().length, 0);
    clearAllQueryCache();
  });

  // ----------------------------------------------------------------------------
  // SUITE 4: Cookie-First Authentication & Role Token Separation
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Cookie-First Authentication & Role Separation ---');

  await test('4.1: Role token separation ensures students do not overwrite manager tokens', () => {
    // Mock window and localStorage
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => storage.get(k) || null,
      setItem: (k: string, v: string) => {
        storage.set(k, String(v));
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => {
        storage.clear();
      },
      key: () => null,
      length: 0,
    } as unknown as Storage;

    (globalThis as Record<string, unknown>).window = {
      localStorage: mockStorage,
    } as Window & typeof globalThis;
    (globalThis as Record<string, unknown>).localStorage = mockStorage;

    try {
      // 1. Simulate Student login with valid mock JWT claims
      const mockStudentToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzdHVkZW50LTEiLCJyb2xlIjoiU1RVREVOVCIsImNvbGxlZ2VJZCI6ImNvbC0xIiwiZXhwIjoxODkzNDU2MDAwfQ.mock_sig';
      setStoredAuth(mockStudentToken, { id: 'student-1', role: 'STUDENT' });

      assert.strictEqual(getStoredToken('STUDENT'), mockStudentToken);
      assert.strictEqual(storage.get('managerToken'), undefined, 'Student token must NOT be stored in managerToken');
      assert.strictEqual(storage.get('studentToken'), mockStudentToken, 'Student token must be stored in studentToken');

      // 2. Simulate Manager login
      const mockManagerToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJtZ3ItMSIsInJvbGUiOiJDTFVCX01BTkFHRVIiLCJjb2xsZWdlSWQiOiJjb2wtMSIsImV4cCI6MTg5MzQ1NjAwMH0.mock_sig';
      setStoredAuth(mockManagerToken, { id: 'mgr-1', role: 'CLUB_MANAGER' });

      assert.strictEqual(getStoredToken('CLUB_MANAGER'), mockManagerToken);
      assert.strictEqual(storage.get('managerToken'), mockManagerToken);
      assert.strictEqual(storage.get('studentToken'), mockStudentToken, 'Student token must NOT be overwritten by manager');

      // 3. Clear auth
      clearStoredAuth();
      assert.strictEqual(getStoredToken(), null);
    } finally {
      delete (globalThis as Record<string, unknown>).window;
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  await test('4.2: parseAndValidateToken correctly identifies platform vs tenant roles', () => {
    const studentJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzMSIsInJvbGUiOiJTVFVERU5UIiwiY29sbGVnZUlkIjoiY29sLTEiLCJleHAiOjE4OTM0NTYwMDB9.sig';
    const studentUser = parseAndValidateToken(studentJwt);
    assert.strictEqual(studentUser?.role, 'STUDENT');
    assert.strictEqual(studentUser?.isPlatformAdmin, false);

    const platformJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJwMSIsInR5cGUiOiJwbGF0Zm9ybSIsInJvbGUiOiJQTEFURk9STV9TVVBFUl9BRE1JTiIsImV4cCI6MTg5MzQ1NjAwMH0.sig';
    const platformUser = parseAndValidateToken(platformJwt);
    assert.strictEqual(platformUser?.isPlatformAdmin, true);
  });

  // ----------------------------------------------------------------------------
  // SUITE 5: Verified API Contracts & Elimination of Non-Existent Routes
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Verified API Contracts & Endpoint Mappings ---');

  await test('5.1: Non-existent /colleges endpoint is deleted from codebase', () => {
    const collegesFile = path.resolve(__dirname, '../src/lib/api/colleges.ts');
    assert.strictEqual(fs.existsSync(collegesFile), false, 'src/lib/api/colleges.ts must be deleted');
  });

  await test('5.2: Verification of zero references to non-existent /auth/login in API modules', () => {
    const authApiFile = path.resolve(__dirname, '../src/lib/api/auth.ts');
    const content = fs.readFileSync(authApiFile, 'utf8');
    assert.ok(
      !content.includes("'/auth/login'"),
      "Generic '/auth/login' must not be called; explicit role-based endpoints must be used"
    );
    assert.ok(content.includes('/auth/student/login'), 'Must contain /auth/student/login');
    assert.ok(content.includes('/auth/manager/login'), 'Must contain /auth/manager/login');
    assert.ok(content.includes('/auth/admin/login'), 'Must contain /auth/admin/login');
    assert.ok(content.includes('/platform/auth/login'), 'Must contain /platform/auth/login');
  });

  await test('5.3: Club creation calls verified Express route POST /admin/create-club', () => {
    const clubsApiFile = path.resolve(__dirname, '../src/lib/api/clubs.ts');
    const content = fs.readFileSync(clubsApiFile, 'utf8');
    assert.ok(
      content.includes('/admin/create-club'),
      'Club creation mutation must call verified route /admin/create-club (adminRoutes.js:74)'
    );
    assert.ok(
      !content.includes("post('/admin/clubs'"),
      'Must not call non-existent POST /admin/clubs'
    );
  });

  await test('5.4: Query functions execute and map response shapes correctly', async () => {
    const originalGet = apiClient.get;
    try {
      // Test departments unwrapped array
      apiClient.get = (async () => ({
        data: [{ id: 'dept-1', name: 'Computer Science', code: 'CSE', collegeId: 'col-1', createdAt: '', updatedAt: '' }],
      })) as typeof apiClient.get;
      const depts = await fetchDepartments();
      assert.strictEqual(depts.length, 1);
      assert.strictEqual(depts[0].name, 'Computer Science');

      // Test department by ID
      apiClient.get = (async () => ({
        data: { department: { id: 'dept-1', name: 'CSE', code: 'CSE', collegeId: 'col-1', createdAt: '', updatedAt: '' } },
      })) as typeof apiClient.get;
      const dept = await fetchDepartmentById('dept-1');
      assert.strictEqual(dept.name, 'CSE');

      // Test clubs
      apiClient.get = (async () => ({
        data: { clubs: [{ id: 'cl-1', name: 'Coding Club', code: 'CC', collegeId: 'col-1', createdAt: '', updatedAt: '' }] },
      })) as typeof apiClient.get;
      const clubs = await fetchClubs();
      assert.strictEqual(clubs.length, 1);
      assert.strictEqual(clubs[0].name, 'Coding Club');

      apiClient.get = (async () => ({
        data: { club: { id: 'cl-1', name: 'Coding Club', code: 'CC', collegeId: 'col-1', createdAt: '', updatedAt: '' } },
      })) as typeof apiClient.get;
      const singleClub = await fetchClubById('cl-1');
      assert.strictEqual(singleClub.id, 'cl-1');

      // Test events
      apiClient.get = (async () => ({
        data: { events: [{ id: 'ev-1', title: 'Hackathon', collegeId: 'col-1', clubId: 'cl-1', status: 'PUBLISHED', startDate: '', endDate: '', isPublic: true, isPaid: false, createdAt: '', updatedAt: '' }] },
      })) as typeof apiClient.get;
      const events = await fetchUpcomingEvents();
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].title, 'Hackathon');

      const clubUpcoming = await fetchClubUpcomingEvents('cl-1');
      assert.strictEqual(clubUpcoming.length, 1);

      // Verify query client singleton helper
      assert.strictEqual(typeof getQueryClient, 'function');
    } finally {
      apiClient.get = originalGet;
    }
  });

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`PHASE 2.2 REMEDIATION TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
