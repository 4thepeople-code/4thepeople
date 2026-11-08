import assert from 'node:assert';
import { resolveHost } from '@/lib/routing/hostResolver';
import { queryKeys } from '@/lib/api/queryKeys';
import { generateMetadata as generateHomeMetadata } from '@/app/college/[slug]/page';
import { generateMetadata as generateClubsMetadata } from '@/app/college/[slug]/clubs/page';
import { generateMetadata as generateClubDetailMetadata } from '@/app/college/[slug]/clubs/[clubId]/page';
import { generateMetadata as generateEventsMetadata } from '@/app/college/[slug]/events/[eventId]/page';
import { generateMetadata as generateDepartmentsMetadata } from '@/app/college/[slug]/departments/page';
import { generateMetadata as generateDepartmentDetailMetadata } from '@/app/college/[slug]/departments/[departmentId]/page';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    process.stdout.write(`  [TEST] ${name}... `);
    await fn();
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✗ FAIL');
    console.error(err);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING PHASE 3A PUBLIC DIRECTORY & TENANT ROUTING TESTS');
  console.log('======================================================================\n');

  console.log('--- SUITE 1: Multi-Tenant Host Routing & Subdomain Enforcements ---');
  await test('1.1: College subdomain resolves to COLLEGE with slug', () => {
    const res = resolveHost('lbrce.4thepeople.in', { isProduction: true, trustProxy: true });
    assert.strictEqual(res.type, 'COLLEGE');
    assert.strictEqual(res.slug, 'lbrce');
  });

  await test('1.2: Dev college subdomain resolves to COLLEGE with slug', () => {
    const res = resolveHost('vrsec.localhost:3000', { isProduction: false, trustProxy: false });
    assert.strictEqual(res.type, 'COLLEGE');
    assert.strictEqual(res.slug, 'vrsec');
  });

  await test('1.3: Malformed or hostile college slugs rejected as INVALID', () => {
    const res1 = resolveHost('lbrce.4thepeople.in.attacker.com', { isProduction: true });
    assert.strictEqual(res1.type, 'INVALID');

    const res2 = resolveHost('evil..4thepeople.in', { isProduction: true });
    assert.strictEqual(res2.type, 'INVALID');
  });

  console.log('\n--- SUITE 2: SEO & Dynamic Metadata Generation ---');
  await test('2.1: College home page metadata generates correct canonical & OpenGraph', async () => {
    const meta = await generateHomeMetadata({ params: Promise.resolve({ slug: 'lbrce' }) });
    assert.ok(meta.title?.toString().includes('LBRCE'));
    assert.strictEqual(meta.alternates?.canonical, 'https://lbrce.4thepeople.in');
    assert.strictEqual(meta.openGraph?.url, 'https://lbrce.4thepeople.in');
  });

  await test('2.2: Clubs directory metadata generates tenant-scoped canonical URL', async () => {
    const meta = await generateClubsMetadata({ params: Promise.resolve({ slug: 'vrsec' }) });
    assert.ok(meta.title?.toString().includes('VRSEC'));
    assert.strictEqual(meta.alternates?.canonical, 'https://vrsec.4thepeople.in/clubs');
  });

  await test('2.3: Club detail metadata generates tenant-scoped canonical URL with clubId', async () => {
    const meta = await generateClubDetailMetadata({
      params: Promise.resolve({ slug: 'lbrce', clubId: 'club-123' }),
    });
    assert.ok(meta.title?.toString().includes('LBRCE'));
    assert.strictEqual(meta.alternates?.canonical, 'https://lbrce.4thepeople.in/clubs/club-123');
  });

  await test('2.4: Event detail metadata generates tenant-scoped canonical URL with eventId', async () => {
    const meta = await generateEventsMetadata({
      params: Promise.resolve({ slug: 'lbrce', eventId: 'event-456' }),
    });
    assert.ok(meta.title?.toString().includes('LBRCE'));
    assert.strictEqual(meta.alternates?.canonical, 'https://lbrce.4thepeople.in/events/event-456');
  });

  await test('2.5: Departments directory metadata generates tenant-scoped canonical URL', async () => {
    const meta = await generateDepartmentsMetadata({ params: Promise.resolve({ slug: 'vrsec' }) });
    assert.ok(meta.title?.toString().includes('VRSEC'));
    assert.strictEqual(meta.alternates?.canonical, 'https://vrsec.4thepeople.in/departments');
  });

  await test('2.6: Department detail metadata generates tenant-scoped canonical URL with deptId', async () => {
    const meta = await generateDepartmentDetailMetadata({
      params: Promise.resolve({ slug: 'vrsec', departmentId: 'dept-789' }),
    });
    assert.ok(meta.title?.toString().includes('VRSEC'));
    assert.strictEqual(meta.alternates?.canonical, 'https://vrsec.4thepeople.in/departments/dept-789');
  });

  console.log('\n--- SUITE 3: Tenant Cache Key Scoping & Boundary Enforcements ---');
  await test('3.1: All tenant query keys are partitioned by slug', () => {
    const lbrceClubs = queryKeys.tenant('lbrce').clubs.lists();
    const vrsecClubs = queryKeys.tenant('vrsec').clubs.lists();
    assert.notDeepStrictEqual(lbrceClubs, vrsecClubs);
    assert.strictEqual(lbrceClubs[1], 'lbrce');
    assert.strictEqual(vrsecClubs[1], 'vrsec');
  });

  await test('3.2: Department and event keys strictly separate tenant contexts', () => {
    const lbrceDepts = queryKeys.tenant('lbrce').departments.lists();
    const vrsecDepts = queryKeys.tenant('vrsec').departments.lists();
    assert.notDeepStrictEqual(lbrceDepts, vrsecDepts);

    const lbrceEvents = queryKeys.tenant('lbrce').events.upcoming();
    const vrsecEvents = queryKeys.tenant('vrsec').events.upcoming();
    assert.notDeepStrictEqual(lbrceEvents, vrsecEvents);
  });

  await test('3.3: Registration query keys are isolated per tenant and eventId', () => {
    const lbrceReg = queryKeys.tenant('lbrce').registrations.status('ev-1');
    const vrsecReg = queryKeys.tenant('vrsec').registrations.status('ev-1');
    assert.notDeepStrictEqual(lbrceReg, vrsecReg);
    assert.strictEqual(lbrceReg[1], 'lbrce');
    assert.strictEqual(vrsecReg[1], 'vrsec');
  });

  console.log('\n======================================================================');
  console.log(`PHASE 3A TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

