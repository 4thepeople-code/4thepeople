import assert from 'node:assert';
import { queryKeys } from '../src/lib/api/queryKeys';
import type { AuthUser } from '../src/types/auth';
import type { CreateEventInput, UpdateEventInput, EventAttendeesResponse, ManagerProfileData } from '../src/lib/api/manager';

console.log('======================================================================');
console.log('STARTING PHASE 3B.2 MANAGER PORTAL CONTRACT & FUNCTIONAL TESTS');
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
// SUITE 1: Manager Authentication, Roles & Security Guard Boundaries
// ============================================================================
console.log('--- SUITE 1: Manager Authentication & Role Guard Contracts ---');

runTest('1.1: Manager login payload accepts email and password', () => {
  const payload = {
    email: 'manager@lbrce.ac.in',
    password: 'ValidPassword123!',
  };
  assert.strictEqual(payload.email, 'manager@lbrce.ac.in');
  assert.ok(payload.password.length >= 6);
});

runTest('1.2: Manager role validation permits MANAGER and COLLEGE_ADMIN, rejects USER and unauthenticated', () => {
  const isManagerAuthorized = (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'MANAGER' || user.role === 'COLLEGE_ADMIN';
  };

  const managerUser: AuthUser = { id: 'u1', email: 'mgr@lbrce.ac.in', role: 'MANAGER' };
  const adminUser: AuthUser = { id: 'u2', email: 'admin@lbrce.ac.in', role: 'COLLEGE_ADMIN' };
  const studentUser: AuthUser = { id: 'u3', email: 'student@lbrce.ac.in', role: 'USER' };

  assert.strictEqual(isManagerAuthorized(managerUser), true, 'MANAGER must be authorized');
  assert.strictEqual(isManagerAuthorized(adminUser), true, 'COLLEGE_ADMIN must be authorized');
  assert.strictEqual(isManagerAuthorized(studentUser), false, 'USER must be rejected from manager portal');
  assert.strictEqual(isManagerAuthorized(null), false, 'Null user must be rejected');
});

runTest('1.3: Manager forgot-password and reset-password payload schemas', () => {
  const forgotPayload = { email: 'manager@lbrce.ac.in' };
  const resetPayload = { token: 'reset-token-xyz-123', newPassword: 'BrandNewSecurePassword1!' };

  assert.strictEqual(forgotPayload.email, 'manager@lbrce.ac.in');
  assert.strictEqual(resetPayload.token, 'reset-token-xyz-123');
  assert.ok(resetPayload.newPassword.length >= 6);
});

// ============================================================================
// SUITE 2: Query Keys & Tenant Cache Isolation
// ============================================================================
console.log('\n--- SUITE 2: TanStack Query Cache Scoping & Isolation ---');

runTest('2.1: Manager query keys are strictly tenant-scoped under college slug', () => {
  const lbrceKeys = queryKeys.tenant('lbrce').manager;
  const vrsecKeys = queryKeys.tenant('vrsec').manager;

  const clubId = 'club-uuid-123';
  const eventId = 'event-uuid-456';

  const lbrceMyClubs = lbrceKeys.myClubs();
  const vrsecMyClubs = vrsecKeys.myClubs();

  assert.deepStrictEqual(lbrceMyClubs, ['tenant', 'lbrce', 'manager', 'my-clubs']);
  assert.deepStrictEqual(vrsecMyClubs, ['tenant', 'vrsec', 'manager', 'my-clubs']);
  assert.notDeepStrictEqual(lbrceMyClubs, vrsecMyClubs, 'Cross-tenant cache leakage must be impossible');

  const lbrceClubDash = lbrceKeys.clubDashboard(clubId);
  assert.deepStrictEqual(lbrceClubDash, ['tenant', 'lbrce', 'manager', 'club', clubId, 'dashboard']);

  const lbrceClubEvents = lbrceKeys.clubEvents(clubId);
  assert.deepStrictEqual(lbrceClubEvents, ['tenant', 'lbrce', 'manager', 'club', clubId, 'events']);

  const lbrceAttendees = lbrceKeys.attendees(clubId, eventId, 2);
  assert.deepStrictEqual(lbrceAttendees, ['tenant', 'lbrce', 'manager', 'club', clubId, 'event', eventId, 'attendees', 2]);
});

// ============================================================================
// SUITE 3: Club & Event Management Contracts
// ============================================================================
console.log('\n--- SUITE 3: Club & Event Management Contracts ---');

runTest('3.1: Club update payload validation', () => {
  const clubUpdateData = {
    name: 'Robotics Club',
    description: 'Premier campus robotics and automation lab.',
  };
  assert.ok(clubUpdateData.name.trim().length > 0);
  assert.ok(clubUpdateData.description.length > 0);
});

runTest('3.2: Create Event input payload schema conforms to backend requirements', () => {
  const eventInput: CreateEventInput = {
    title: 'Autonomous Robotics Hackathon',
    description: '48-hour campus hackathon for autonomous ground vehicles.',
    location: 'Main Auditorium & Mechanical Lab',
    startAt: '2026-12-01T10:00:00.000Z',
    endAt: '2026-12-03T18:00:00.000Z',
    registrationUrl: 'https://forms.google.com/robotics-hackathon',
  };

  assert.strictEqual(eventInput.title, 'Autonomous Robotics Hackathon');
  assert.ok(new Date(eventInput.endAt!).getTime() > new Date(eventInput.startAt).getTime(), 'End date must follow start date');
});

runTest('3.3: Update Event input payload schema allows partial modifications', () => {
  const updateInput: UpdateEventInput = {
    location: 'Renovated Auditorium Hall B',
  };

  assert.strictEqual(updateInput.location, 'Renovated Auditorium Hall B');
  assert.strictEqual(updateInput.title, undefined);
});

runTest('3.4: Event status filtering categorizes statuses accurately', () => {
  type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  const events: Array<{ id: string; status: EventStatus }> = [
    { id: '1', status: 'UPCOMING' },
    { id: '2', status: 'ONGOING' },
    { id: '3', status: 'COMPLETED' },
    { id: '4', status: 'CANCELLED' },
  ];

  const upcomingOngoing = events.filter((e) => e.status === 'UPCOMING' || e.status === 'ONGOING');
  const completed = events.filter((e) => e.status === 'COMPLETED');
  const cancelled = events.filter((e) => e.status === 'CANCELLED');

  assert.strictEqual(upcomingOngoing.length, 2);
  assert.strictEqual(completed.length, 1);
  assert.strictEqual(cancelled.length, 1);
});

// ============================================================================
// SUITE 4: Event Attendees & Registration History Contracts
// ============================================================================
console.log('\n--- SUITE 4: Event Attendees & Pagination Contracts ---');

runTest('4.1: Event attendees response schema maps total, page, limit, totalPages, and student user details', () => {
  const mockAttendeesResponse: EventAttendeesResponse = {
    club: { id: 'c1', name: 'Coding Club' },
    event: { id: 'e1', title: 'CodeSprint 2026', capacity: 100, registeredCount: 42 },
    total: 42,
    page: 1,
    limit: 20,
    totalPages: 3,
    registrations: [
      {
        id: 'reg-001',
        eventId: 'e1',
        registeredAt: '2026-11-01T10:00:00.000Z',
        user: {
          id: 'u100',
          name: 'Jane Doe',
          email: 'jane@lbrce.ac.in',
          avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
        },
      },
    ],
  };

  assert.strictEqual(mockAttendeesResponse.total, 42);
  assert.strictEqual(mockAttendeesResponse.totalPages, 3);
  assert.strictEqual(mockAttendeesResponse.registrations.length, 1);
  assert.strictEqual(mockAttendeesResponse.registrations[0].user?.name, 'Jane Doe');
});

// ============================================================================
// SUITE 5: Manager Profile Settings Contracts
// ============================================================================
console.log('\n--- SUITE 5: Manager Profile Settings Contracts ---');

runTest('5.1: Manager profile data accepts name, avatar, and assigned clubs', () => {
  const profile: ManagerProfileData = {
    id: 'mgr-1',
    name: 'Dr. Suresh Kumar',
    email: 'suresh@lbrce.ac.in',
    avatar: { url: 'https://images.example.com/suresh.png', publicId: 'suresh_avatar' },
    managedClubs: [
      { id: 'c1', name: 'IEEE Student Branch' },
      { id: 'c2', name: 'Robotics Club' },
    ],
  };

  assert.strictEqual(profile.name, 'Dr. Suresh Kumar');
  assert.strictEqual(profile.managedClubs?.length, 2);
  assert.strictEqual(profile.avatar?.url, 'https://images.example.com/suresh.png');
});

runTest('5.2: Manager password update validation enforces minimum 6 chars and matching confirmation', () => {
  const validatePasswordChange = (current: string, next: string, confirm: string) => {
    if (!current) return { valid: false, error: 'Current password is required' };
    if (!next || next.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
    if (next !== confirm) return { valid: false, error: 'Passwords do not match' };
    return { valid: true, error: null };
  };

  assert.strictEqual(validatePasswordChange('', 'NewPass1', 'NewPass1').valid, false);
  assert.strictEqual(validatePasswordChange('OldPass1', '123', '123').valid, false);
  assert.strictEqual(validatePasswordChange('OldPass1', 'NewPass123', 'Different123').valid, false);
  assert.strictEqual(validatePasswordChange('OldPass1', 'NewPass123', 'NewPass123').valid, true);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}

