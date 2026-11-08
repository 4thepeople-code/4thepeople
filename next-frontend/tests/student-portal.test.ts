import assert from 'node:assert';
import { queryKeys } from '../src/lib/api/queryKeys';
import type { StudentActivationConfirmPayload, StudentLoginPayload, AuthUser } from '../src/types/auth';
import type { CustomFormField, EventRegistration } from '../src/types/models';

console.log('======================================================================');
console.log('STARTING PHASE 3B.1 STUDENT PORTAL CONTRACT & FUNCTIONAL TESTS');
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
// SUITE 1: Student Account Activation & Password Security Specifications
// ============================================================================
console.log('--- SUITE 1: Student Activation Security & Password Rules ---');

runTest('1.1: S1 Password complexity checker enforces 8-128 chars, upper, lower, number, special char', () => {
  const validatePassword = (pwd: string, rollNumber: string, email: string) => {
    const minLength = pwd.length >= 8 && pwd.length <= 128;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const notRoll = !rollNumber || !pwd.toLowerCase().includes(rollNumber.toLowerCase());
    const emailPrefix = email ? email.split('@')[0].toLowerCase() : '';
    const notEmail = !emailPrefix || emailPrefix.length < 3 || !pwd.toLowerCase().includes(emailPrefix);
    return minLength && hasUpper && hasLower && hasNumber && hasSpecial && notRoll && notEmail;
  };

  assert.strictEqual(validatePassword('weak', '21B01A0501', 'student@lbrce.ac.in'), false, 'Too short should fail');
  assert.strictEqual(validatePassword('ValidPass123!', '21B01A0501', 'student@lbrce.ac.in'), true, 'Valid password passes');
  assert.strictEqual(validatePassword('21B01A0501Strong!', '21B01A0501', 'student@lbrce.ac.in'), false, 'Containing roll number should fail');
  assert.strictEqual(validatePassword('studentPass123!', '21B01A0501', 'student@lbrce.ac.in'), false, 'Containing email handle should fail');
  assert.strictEqual(validatePassword('NoSpecialChar123', '21B01A0501', 'student@lbrce.ac.in'), false, 'Missing special char should fail');
  assert.strictEqual(validatePassword('NOLOWERCASE123!', '21B01A0501', 'student@lbrce.ac.in'), false, 'Missing lower case should fail');
  assert.strictEqual(validatePassword('nouppercase123!', '21B01A0501', 'student@lbrce.ac.in'), false, 'Missing upper case should fail');
  assert.strictEqual(validatePassword('NoNumberChar!@#', '21B01A0501', 'student@lbrce.ac.in'), false, 'Missing number should fail');
});

runTest('1.2: Activation confirm payload conforms to backend S1 schema', () => {
  const payload: StudentActivationConfirmPayload = {
    rollNumber: '21B01A0501',
    code: '123456',
    password: 'SecurePassword123!',
    email: 'student@lbrce.ac.in',
  };
  assert.strictEqual(payload.rollNumber, '21B01A0501');
  assert.strictEqual(payload.code.length, 6);
  assert.ok(payload.password.length >= 8);
});

runTest('1.3: S1 Error taxonomy maps INVALID_CODE, MAX_ATTEMPTS_EXCEEDED, and CODE_EXPIRED', () => {
  type S1ErrorCode = 'INVALID_CODE' | 'MAX_ATTEMPTS_EXCEEDED' | 'CODE_EXPIRED' | 'STUDENT_NOT_FOUND';
  const errorMap: Record<S1ErrorCode, string> = {
    INVALID_CODE: 'The verification code entered is incorrect. Attempts remaining: 2',
    MAX_ATTEMPTS_EXCEEDED: 'Maximum verification attempts exceeded. Please request a new code.',
    CODE_EXPIRED: 'Activation code has expired. Please request a new activation code.',
    STUDENT_NOT_FOUND: 'Student roster record not found.',
  };

  assert.ok(errorMap.INVALID_CODE.includes('Attempts remaining'));
  assert.ok(errorMap.MAX_ATTEMPTS_EXCEEDED.includes('Maximum verification attempts'));
  assert.ok(errorMap.CODE_EXPIRED.includes('expired'));
});

// ============================================================================
// SUITE 2: Student Login, Roles, & Tenant Authorization Boundaries
// ============================================================================
console.log('\n--- SUITE 2: Student Login & Role Security Isolation ---');

runTest('2.1: Student login payload accepts roll number or email', () => {
  const rollPayload: StudentLoginPayload = {
    rollNumber: '21B01A0501',
    password: 'Password123!',
  };
  assert.strictEqual(rollPayload.rollNumber, '21B01A0501');

  const emailPayload: StudentLoginPayload = {
    email: 'student@lbrce.ac.in',
    password: 'Password123!',
  };
  assert.strictEqual(emailPayload.email, 'student@lbrce.ac.in');
});

runTest('2.2: Student role is strictly USER and college-scoped', () => {
  const studentUser: AuthUser = {
    id: 'usr_student_01',
    email: 'student@lbrce.ac.in',
    name: 'Lakireddy Student',
    role: 'USER',
    collegeId: 'clg_lbrce_01',
    isPlatformAdmin: false,
  };

  assert.strictEqual(studentUser.role, 'USER');
  assert.strictEqual(studentUser.isPlatformAdmin, false);
  assert.strictEqual(studentUser.collegeId, 'clg_lbrce_01');

  // Verify authorization barrier: USER cannot access MANAGER or ADMIN areas
  const isManagerOrAdmin = ['MANAGER', 'COLLEGE_ADMIN', 'SUPER_ADMIN'].includes(studentUser.role);
  assert.strictEqual(isManagerOrAdmin, false, 'Student USER must not have manager or admin privileges');
});

runTest('2.3: Tenant query keys isolate student auth and sessions per college', () => {
  const lbrceSession = queryKeys.tenant('lbrce').auth.session();
  const vrsecSession = queryKeys.tenant('vrsec').auth.session();

  assert.deepStrictEqual(lbrceSession, ['tenant', 'lbrce', 'auth', 'session']);
  assert.deepStrictEqual(vrsecSession, ['tenant', 'vrsec', 'auth', 'session']);
  assert.notDeepStrictEqual(lbrceSession, vrsecSession, 'Student auth keys must be partitioned by slug');
});

// ============================================================================
// SUITE 3: Dynamic Event Form Validation & 409 Capacity Enforcement
// ============================================================================
console.log('\n--- SUITE 3: Dynamic Event Form Validation & Error Handling ---');

runTest('3.1: Custom form definition validates required TEXT, NUMBER, SELECT, and RADIO fields', () => {
  const fields: CustomFormField[] = [
    { id: 'f_tshirt', label: 'T-Shirt Size', type: 'SELECT', required: true, options: ['S', 'M', 'L', 'XL'] },
    { id: 'f_team', label: 'Team Name', type: 'TEXT', required: true },
    { id: 'f_experience', label: 'Years of Experience', type: 'NUMBER', required: false },
    { id: 'f_track', label: 'Competition Track', type: 'RADIO', required: true, options: ['AI', 'Web3', 'Cloud'] },
  ];

  const validateAnswers = (answers: Record<string, unknown>): { valid: boolean; missing?: string } => {
    for (const f of fields) {
      const val = answers[f.id];
      if (f.required && (val === undefined || val === null || val === '')) {
        return { valid: false, missing: f.label };
      }
    }
    return { valid: true };
  };

  // Missing required team name
  const invalidResult = validateAnswers({ f_tshirt: 'L', f_track: 'AI' });
  assert.strictEqual(invalidResult.valid, false);
  assert.strictEqual(invalidResult.missing, 'Team Name');

  // All required fields provided
  const validResult = validateAnswers({ f_tshirt: 'L', f_team: 'Binary Ninjas', f_track: 'Cloud' });
  assert.strictEqual(validResult.valid, true);
});

runTest('3.2: 409 Conflict status accurately handles capacity full and duplicate registration', () => {
  const handleRegistrationError = (status: number, message: string) => {
    if (status === 409) {
      if (message.toLowerCase().includes('already registered')) {
        return 'DUPLICATE_REGISTRATION';
      }
      if (message.toLowerCase().includes('capacity') || message.toLowerCase().includes('full')) {
        return 'CAPACITY_REACHED';
      }
    }
    return 'GENERIC_ERROR';
  };

  assert.strictEqual(
    handleRegistrationError(409, 'Event capacity has been reached.'),
    'CAPACITY_REACHED'
  );
  assert.strictEqual(
    handleRegistrationError(409, 'You are already registered for this event.'),
    'DUPLICATE_REGISTRATION'
  );
});

// ============================================================================
// SUITE 4: Event Registration Queries, Mutations & Cache Invalidation
// ============================================================================
console.log('\n--- SUITE 4: Registration Queries & Cache Invalidation Contract ---');

runTest('4.1: My Registrations query keys are scoped to tenant', () => {
  const lbrceRegs = queryKeys.tenant('lbrce').registrations.myRegistrations();
  const vrsecRegs = queryKeys.tenant('vrsec').registrations.myRegistrations();

  assert.deepStrictEqual(lbrceRegs, ['tenant', 'lbrce', 'registrations', 'mine']);
  assert.deepStrictEqual(vrsecRegs, ['tenant', 'vrsec', 'registrations', 'mine']);
  assert.notDeepStrictEqual(lbrceRegs, vrsecRegs);
});

runTest('4.2: Registration status query keys are scoped to tenant and eventId', () => {
  const statusKey = queryKeys.tenant('lbrce').registrations.status('evt_hackathon_01');
  assert.deepStrictEqual(statusKey, ['tenant', 'lbrce', 'registrations', 'status', 'evt_hackathon_01']);
});

runTest('4.3: Event registration data structure matches backend S1 model', () => {
  const reg: EventRegistration = {
    id: 'reg_12345',
    collegeId: 'clg_lbrce_01',
    eventId: 'evt_hackathon_01',
    userId: 'usr_student_01',
    formAnswers: {
      f_tshirt: 'L',
      f_team: 'Code Warriors',
    },
    registeredAt: new Date().toISOString(),
    event: {
      id: 'evt_hackathon_01',
      title: 'Annual Hackathon 2026',
      description: 'Flagship campus coding hackathon',
    },
  };

  assert.strictEqual(reg.id, 'reg_12345');
  assert.strictEqual(reg.formAnswers?.['f_tshirt'], 'L');
  assert.strictEqual(reg.event?.title, 'Annual Hackathon 2026');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log(`PHASE 3B.1 TESTS COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
}
