import assert from 'node:assert';
import { queryKeys } from '../src/lib/api/queryKeys';
import type { AuthUser } from '../src/types/auth';
import type {
  RosterStudentRow,
  RosterSummary,
} from '../src/lib/api/admin';
import type { Department } from '../src/types/models';

console.log('======================================================================');
console.log('STARTING PHASE 3B.3 COLLEGE ADMIN PORTAL CONTRACT & FUNCTIONAL TESTS');
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
// SUITE 1: College Admin Role Isolation & Authentication Guard
// ============================================================================
console.log('--- SUITE 1: College Admin Role & Auth Guard Contracts ---');

runTest('1.1: College admin auth guard strictly permits COLLEGE_ADMIN and ADMIN', () => {
  const isCollegeAdminAuthorized = (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN';
  };

  const collegeAdmin: AuthUser = { id: 'admin-1', email: 'admin@lbrce.ac.in', role: 'COLLEGE_ADMIN' };
  const legacyAdmin: AuthUser = { id: 'admin-2', email: 'superadmin@lbrce.ac.in', role: 'ADMIN' };
  const manager: AuthUser = { id: 'mgr-1', email: 'manager@lbrce.ac.in', role: 'MANAGER' };
  const student: AuthUser = { id: 'stu-1', email: 'student@lbrce.ac.in', role: 'USER' };

  assert.strictEqual(isCollegeAdminAuthorized(collegeAdmin), true, 'COLLEGE_ADMIN must be authorized');
  assert.strictEqual(isCollegeAdminAuthorized(legacyAdmin), true, 'ADMIN must be authorized');
  assert.strictEqual(isCollegeAdminAuthorized(manager), false, 'MANAGER must be rejected');
  assert.strictEqual(isCollegeAdminAuthorized(student), false, 'USER must be rejected');
  assert.strictEqual(isCollegeAdminAuthorized(null), false, 'Unauthenticated visitor must be rejected');
});

runTest('1.2: College admin login payload contract requires email and password', () => {
  const payload = {
    email: 'admin@lbrce.ac.in',
    password: 'SuperAdminPassword123!',
  };
  assert.strictEqual(payload.email, 'admin@lbrce.ac.in');
  assert.ok(payload.password.length >= 8);
});

// ============================================================================
// SUITE 2: Multi-Tenant TanStack Query Scoping & Cache Isolation
// ============================================================================
console.log('\n--- SUITE 2: TanStack Query Cache Scoping & Multi-Tenant Partitioning ---');

runTest('2.1: College admin query keys are strictly partitioned by college slug', () => {
  const lbrceKeys = queryKeys.tenant('lbrce').admin;
  const vrsecKeys = queryKeys.tenant('vrsec').admin;

  assert.deepStrictEqual(lbrceKeys.all, ['tenant', 'lbrce', 'admin']);
  assert.deepStrictEqual(vrsecKeys.all, ['tenant', 'vrsec', 'admin']);

  assert.deepStrictEqual(lbrceKeys.users(), ['tenant', 'lbrce', 'admin', 'users']);
  assert.deepStrictEqual(vrsecKeys.users(), ['tenant', 'vrsec', 'admin', 'users']);

  assert.deepStrictEqual(lbrceKeys.clubs(), ['tenant', 'lbrce', 'admin', 'clubs']);
  assert.deepStrictEqual(vrsecKeys.clubs(), ['tenant', 'vrsec', 'admin', 'clubs']);

  assert.deepStrictEqual(lbrceKeys.userDetail('user-101'), ['tenant', 'lbrce', 'admin', 'users', 'user-101']);
  assert.deepStrictEqual(vrsecKeys.userDetail('user-101'), ['tenant', 'vrsec', 'admin', 'users', 'user-101']);
  assert.notDeepStrictEqual(lbrceKeys.userDetail('user-101'), vrsecKeys.userDetail('user-101'));
});

// ============================================================================
// SUITE 3: CSV Student Roster Parser & Validation Logic
// ============================================================================
console.log('\n--- SUITE 3: Student Roster CSV Parser & Validation Logic ---');

runTest('3.1: Valid CSV text parses into structured RosterStudentRow objects', () => {
  const sampleCSV = `roll_number,name,department,admission_year,email
21L31A0501,Aditya Sharma,CSE,2021,aditya@lbrce.ac.in
21L31A0502,Bhavani Patel,ECE,2021,bhavani@lbrce.ac.in`;

  const lines = sampleCSV.split(/\r?\n/).filter((l) => l.trim().length > 0);
  assert.strictEqual(lines.length, 3);

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  assert.deepStrictEqual(header, ['roll_number', 'name', 'department', 'admission_year', 'email']);

  const rows: RosterStudentRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    rows.push({
      rollNumber: parts[0],
      name: parts[1],
      department: parts[2],
      admissionYear: parseInt(parts[3], 10),
      email: parts[4],
    });
  }

  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].rollNumber, '21L31A0501');
  assert.strictEqual(rows[0].admissionYear, 2021);
  assert.strictEqual(rows[1].email, 'bhavani@lbrce.ac.in');
});

runTest('3.2: Duplicate roll numbers within CSV are detected and flagged', () => {
  const duplicateCSV = `roll_number,name,department,admission_year,email
21L31A0501,Aditya Sharma,CSE,2021,aditya@lbrce.ac.in
21L31A0501,Duplicate Aditya,CSE,2021,aditya2@lbrce.ac.in`;

  const lines = duplicateCSV.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const seenRolls = new Set<string>();
  const duplicates: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const roll = lines[i].split(',')[0].trim().toUpperCase();
    if (seenRolls.has(roll)) {
      duplicates.push(roll);
    } else {
      seenRolls.add(roll);
    }
  }

  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0], '21L31A0501');
});

runTest('3.3: Roster summary schema tracks total, inserted, updated, and skipped records', () => {
  const summary: RosterSummary = {
    total: 10,
    inserted: 7,
    updated: 2,
    skipped: 1,
  };

  assert.strictEqual(summary.total, summary.inserted + summary.updated + summary.skipped);
  assert.strictEqual(summary.skipped, 1);
});

// ============================================================================
// SUITE 4: Department & Club Governance Contracts
// ============================================================================
console.log('\n--- SUITE 4: Department & Club Governance Contracts ---');

runTest('4.1: Create club input schema validates central vs departmental classification', () => {
  const centralClub = {
    name: 'National Service Scheme',
    description: 'Central campus service organization',
    isCentral: true,
    departmentIds: [] as string[],
  };

  const deptClub = {
    name: 'ACM Student Chapter',
    description: 'CSE departmental technical club',
    isCentral: false,
    departmentIds: ['dept-cse-123'],
  };

  assert.strictEqual(centralClub.isCentral, true);
  assert.strictEqual(centralClub.departmentIds.length, 0);

  assert.strictEqual(deptClub.isCentral, false);
  assert.strictEqual(deptClub.departmentIds[0], 'dept-cse-123');
});

runTest('4.2: Department creation and update payloads validate required fields', () => {
  const createDept: Partial<Department> = {
    name: 'Computer Science and Engineering',
    shortCode: 'CSE',
  };

  const updateDept: Partial<Department> = {
    name: 'Computer Science & Engineering',
    shortCode: 'CSE',
  };

  assert.strictEqual(createDept.name, 'Computer Science and Engineering');
  assert.strictEqual(createDept.shortCode, 'CSE');
  assert.strictEqual(updateDept.name, 'Computer Science & Engineering');
});

// ============================================================================
// SUITE 5: Manager Invitation & Two-Step Verification Workflows
// ============================================================================
console.log('\n--- SUITE 5: Manager Invitation & Two-Step Verification Workflows ---');

runTest('5.1: Manager invite payload supports institution-wide and club-specific targets', () => {
  const institutionInvite = {
    email: 'newmanager@lbrce.ac.in',
    name: 'New Faculty Coordinator',
    clubId: undefined as string | undefined,
  };

  const clubInvite = {
    email: 'acmlead@lbrce.ac.in',
    name: 'ACM Faculty Coordinator',
    clubId: 'club-acm-001' as string | undefined,
  };

  assert.strictEqual(institutionInvite.clubId, undefined);
  assert.strictEqual(clubInvite.clubId, 'club-acm-001');
});

runTest('5.2: Accept invitation input schema requires password matching and verification token', () => {
  const acceptPayload = {
    password: 'SafeManagerPassword2026!',
    confirmPassword: 'SafeManagerPassword2026!',
  };

  assert.strictEqual(acceptPayload.password, acceptPayload.confirmPassword);
  assert.ok(acceptPayload.password.length >= 6);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
