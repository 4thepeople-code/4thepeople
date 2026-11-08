const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const {
  generateActivationCode,
  hashActivationCode,
  verifyActivationCode,
} = require('../utils/cryptoUtils');
const { enqueueEmail } = require('../services/outboxService');

function generateStudentToken(user, collegeId) {
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET configuration missing in production environment');
  }
  const effectiveSecret = jwtSecret || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';
  const jwtExpiry = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(
    {
      userId: user.id,
      id: user.id,
      collegeId: collegeId || user.collegeId,
      name: user.name,
      email: user.email,
      role: user.role,
      type: 'college',
    },
    effectiveSecret,
    { expiresIn: jwtExpiry }
  );
}

class ActivationRollbackError extends Error {
  constructor(message, publicCode = 'ACTIVATION_STATE_CONFLICT') {
    super(message);
    this.name = 'ActivationRollbackError';
    this.publicCode = publicCode;
  }
}

/**
 * Curated list of common, weak, and predictable passwords (OWASP/NIST guidelines).
 */
const COMMON_PASSWORDS_DENYLIST = new Set([
  'password', 'password1', 'password123', 'admin123', 'welcome123', 'qwerty123',
  'student123', 'student123!', 'college123', 'college123!', 'letmein123', 'changeme123',
  'passcode123', 'passcode123!', 'admin123!', 'welcome123!', 'qwerty123!',
  'p@ssword', 'p@ssw0rd', 'password1!', 'welcome1!', 'student1!', 'college1!',
  'qwertyuiop', '12345678', '123456789', '1234567890', 'abcdefgh', 'abcdef123',
  'iloveyou', 'sunshine', 'princess', 'football', 'monkey123', 'master123',
  'dragon123', 'shadow123', 'secret123', 'trustno1', 'temp1234', 'test1234',
  'yuva1234', 'yuva2026', 'changeit123', 'default123', 'testing123'
]);

/**
 * Validates student password complexity and security constraints.
 * 
 * Enforces:
 * - Length: 8–128 characters.
 * - At least one uppercase letter [A-Z].
 * - At least one lowercase letter [a-z].
 * - At least one numeric digit [0-9].
 * - At least one special character [!@#$%^&*(),.?":{}|<>_~-].
 * - Reject common passwords from denylist.
 * - Reject passwords containing the student's roll number.
 * - Reject passwords containing the student's email local part.
 *
 * @param {string} password 
 * @param {Object} [context]
 * @param {string} [context.rollNumber]
 * @param {string} [context.email]
 */
function validateStudentPassword(password, { rollNumber, email } = {}) {
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }
  if (password.length > 128) {
    throw new AppError('Password must not exceed 128 characters', 400);
  }
  if (!/[A-Z]/.test(password)) {
    throw new AppError('Password must contain at least one uppercase letter', 400);
  }
  if (!/[a-z]/.test(password)) {
    throw new AppError('Password must contain at least one lowercase letter', 400);
  }
  if (!/[0-9]/.test(password)) {
    throw new AppError('Password must contain at least one number', 400);
  }
  if (!/[!@#$%^&*(),.?":{}|<>_~-]/.test(password)) {
    throw new AppError('Password must contain at least one special character', 400);
  }

  const lowerPass = password.toLowerCase();

  // Denylist check
  if (COMMON_PASSWORDS_DENYLIST.has(lowerPass)) {
    throw new AppError('Password is too common and easily guessable. Please choose a stronger password.', 400);
  }

  // Roll number inclusion check (minimum 3 characters)
  if (rollNumber && typeof rollNumber === 'string') {
    const cleanRoll = rollNumber.trim().toLowerCase();
    if (cleanRoll.length >= 3 && lowerPass.includes(cleanRoll)) {
      throw new AppError('Password cannot contain your roll number', 400);
    }
  }

  // Email local part inclusion check (minimum 3 characters)
  if (email && typeof email === 'string') {
    const localPart = email.split('@')[0].trim().toLowerCase();
    if (localPart.length >= 3 && lowerPass.includes(localPart)) {
      throw new AppError('Password cannot contain your email identifier', 400);
    }
  }
}

/**
 * Parses CSV lines into array of student objects.
 */
function parseRosterCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new AppError('CSV must contain a header row and at least one student row', 400);
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const rollIdx = headers.findIndex((h) => h.includes('roll') || h === 'id');
  const nameIdx = headers.findIndex((h) => h.includes('name'));
  const deptIdx = headers.findIndex((h) => h.includes('dept') || h.includes('department'));
  const yearIdx = headers.findIndex((h) => h.includes('year') || h.includes('admission'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));

  if (rollIdx === -1 || nameIdx === -1) {
    throw new AppError('CSV header must contain "roll_number" (or "roll") and "name" columns', 400);
  }

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length <= Math.max(rollIdx, nameIdx)) continue;

    const rollNumber = row[rollIdx];
    const name = row[nameIdx];
    const department = deptIdx !== -1 ? row[deptIdx] : null;
    const admissionYear = yearIdx !== -1 && row[yearIdx] ? parseInt(row[yearIdx], 10) : null;
    const email = emailIdx !== -1 ? row[emailIdx] : null;

    if (rollNumber && name) {
      students.push({ rollNumber, name, department, admissionYear, email });
    }
  }

  return students;
}

/**
 * POST /api/admin/students/roster
 * College Admins upload student roster (CSV or JSON).
 */
exports.uploadStudentRoster = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('College tenant context required', 400);
  }

  let studentList = [];
  if (req.is('text/csv') || (typeof req.body === 'string' && req.body.includes(','))) {
    studentList = parseRosterCSV(req.body);
  } else if (Array.isArray(req.body.students)) {
    studentList = req.body.students;
  } else if (typeof req.body.csv === 'string') {
    studentList = parseRosterCSV(req.body.csv);
  } else {
    throw new AppError('Request must provide students array or CSV text', 400);
  }

  if (studentList.length === 0) {
    throw new AppError('No valid student rows found in upload', 400);
  }
  if (studentList.length > 5000) {
    throw new AppError('Roster upload exceeds maximum 5000 students per batch', 400);
  }

  const results = await withTenant(req.collegeId, async (tx) => {
    // 1. Fetch college domain config for institutional email derivation
    const college = await tx.college.findUnique({
      where: { id: req.collegeId },
      select: { studentEmailDomain: true, studentEmailPattern: true },
    });

    // 2. Fetch existing departments for matching
    const departments = await tx.department.findMany({
      where: { collegeId: req.collegeId },
      select: { id: true, shortCode: true, name: true },
    });
    const deptMap = new Map();
    for (const d of departments) {
      deptMap.set(d.id.toLowerCase(), d.id);
      deptMap.set(d.shortCode.toLowerCase(), d.id);
      deptMap.set(d.name.toLowerCase(), d.id);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of studentList) {
      const rawRoll = (item.rollNumber || item.roll_number || '').trim();
      const rawName = (item.name || '').trim();
      if (!rawRoll || !rawName) {
        skipped++;
        continue;
      }

      const rollNumber = rawRoll.toUpperCase();
      if (!/^[A-Z0-9._-]{3,30}$/.test(rollNumber)) {
        skipped++;
        continue;
      }

      // Resolve department
      let departmentId = null;
      const rawDept = item.departmentId || item.department || item.dept;
      if (rawDept && deptMap.has(rawDept.toString().toLowerCase())) {
        departmentId = deptMap.get(rawDept.toString().toLowerCase());
      }

      // Resolve admission year
      let admissionYear = item.admissionYear || item.admission_year || item.year;
      if (admissionYear) {
        admissionYear = parseInt(admissionYear, 10);
        if (isNaN(admissionYear) || admissionYear < 1990 || admissionYear > 2100) {
          admissionYear = null;
        }
      }

      // Resolve email
      let email = (item.email || '').trim().toLowerCase();
      if (!email && college && college.studentEmailDomain) {
        email = `${rollNumber.toLowerCase()}@${college.studentEmailDomain.toLowerCase()}`;
      }
      if (!email) {
        email = `${rollNumber.toLowerCase()}@student.local`;
      }

      // Check if student exists
      const existingUser = await tx.user.findFirst({
        where: { collegeId: req.collegeId, rollNumber },
      });

      if (existingUser) {
        if (existingUser.isActive) {
          // Do not overwrite active accounts!
          skipped++;
          continue;
        }
        // Inactive account update
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: rawName,
            email,
            departmentId,
            admissionYear,
          },
        });
        updated++;
      } else {
        // Create new inactive student
        await tx.user.create({
          data: {
            collegeId: req.collegeId,
            name: rawName,
            email,
            rollNumber,
            departmentId,
            admissionYear,
            role: 'USER',
            isActive: false,
            passwordHash: null,
          },
        });
        inserted++;
      }
    }

    return { total: studentList.length, inserted, updated, skipped };
  });

  res.status(200).json({
    success: true,
    message: `Roster processed: ${results.inserted} inserted, ${results.updated} updated, ${results.skipped} skipped.`,
    summary: results,
  });
});

/**
 * POST /api/auth/student/activate/request
 * Student requests self-activation code.
 * Anti-enumeration, dummy bcrypt pad, sleep jitter, 60s cooldown, daily cap.
 */
exports.requestActivation = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('College tenant context required', 400);
  }

  const { rollNumber } = req.body;
  const normalizedRoll = (rollNumber || '').trim().toUpperCase();

  // Baseline jitter: 150ms +/- 50ms
  const jitterMs = 150 + crypto.randomInt(-50, 50);

  const sendGenericResponse = async () => {
    await new Promise((resolve) => setTimeout(resolve, jitterMs));
    return res.status(200).json({
      success: true,
      message: 'If this roll number is registered, an activation code has been sent to your institutional email.',
    });
  };

  if (!normalizedRoll || !/^[A-Z0-9._-]{3,30}$/.test(normalizedRoll)) {
    await bcrypt.hash('dummy_constant_time_pad_work_factor', 10);
    return await sendGenericResponse();
  }

  await withTenant(req.collegeId, async (tx) => {
    // 1. Locate student
    const user = await tx.user.findFirst({
      where: { collegeId: req.collegeId, rollNumber: normalizedRoll },
      select: { id: true, name: true, email: true, isActive: true, claimedAt: true },
    });

    if (!user || user.isActive || user.claimedAt) {
      await bcrypt.hash('dummy_constant_time_pad_work_factor', 10);
      return;
    }

    // 2. Cooldown check (60 seconds)
    const latestActivation = await tx.studentActivation.findFirst({
      where: { collegeId: req.collegeId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latestActivation) {
      const diffMs = Date.now() - new Date(latestActivation.createdAt).getTime();
      if (diffMs < 60000) {
        // Within 60s cooldown: do not generate new code
        return;
      }
    }

    // 3. Daily limit check (max 5 per 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await tx.studentActivation.count({
      where: {
        collegeId: req.collegeId,
        userId: user.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (dailyCount >= 5) {
      // Daily budget exceeded: silent return
      return;
    }

    // 4. Generate 6-digit code and HMAC-SHA-256 hash
    const code = generateActivationCode();
    const codeHash = hashActivationCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 5. Insert activation record
    await tx.studentActivation.create({
      data: {
        collegeId: req.collegeId,
        userId: user.id,
        codeHash,
        attempts: 0,
        maxAttempts: 5,
        consumed: false,
        expiresAt,
      },
    });

    // 6. Enqueue email into outbox with AES-256-GCM + AAD
    await enqueueEmail(tx, {
      collegeId: req.collegeId,
      recipientEmail: user.email,
      recipientName: user.name,
      templateType: 'STUDENT_ACTIVATION',
      payload: {
        name: user.name,
        rollNumber: normalizedRoll,
        code,
      },
    });
  });

  return await sendGenericResponse();
});

/**
 * POST /api/auth/student/activate/confirm
 * Student verifies code, sets password, and activates account.
 * Strict atomic rollback if user update fails.
 */
exports.confirmActivation = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('College tenant context required', 400);
  }

  const { rollNumber, code, password } = req.body;
  if (!rollNumber || !code || !password) {
    throw new AppError('Roll number, verification code, and password are required', 400);
  }

  const normalizedRoll = rollNumber.trim().toUpperCase();
  const trimmedCode = code.trim();

  // Validate password rules before starting transaction (with rollNumber and optional email)
  validateStudentPassword(password, { 
    rollNumber: normalizedRoll, 
    email: req.body.email 
  });
  const hashedPassword = await bcrypt.hash(password, 12);

  let outcome;
  try {
    outcome = await withTenant(req.collegeId, async (tx) => {
      // 1. Locate student
      const user = await tx.user.findFirst({
        where: { collegeId: req.collegeId, rollNumber: normalizedRoll },
        select: { id: true, email: true, isActive: true, claimedAt: true },
      });
      if (!user || user.isActive || user.claimedAt) {
        return { success: false, reason: 'ACCOUNT_UNAVAILABLE' };
      }

      // Re-validate password against user's actual institutional email in database
      validateStudentPassword(password, {
        rollNumber: normalizedRoll,
        email: user.email,
      });

      // 2. Locate active candidate activation record
      const candidate = await tx.studentActivation.findFirst({
        where: { collegeId: req.collegeId, userId: user.id, consumed: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!candidate) {
        return { success: false, reason: 'NO_ACTIVE_CODE' };
      }

      // 3. Row lock candidate FOR UPDATE and evaluate real-time clock
      const lockedRows = await tx.$queryRaw`
        SELECT id, code_hash AS "codeHash", attempts, max_attempts AS "maxAttempts", 
               consumed, expires_at AS "expiresAt",
               (clock_timestamp() > expires_at) AS "isExpired"
        FROM student_activations
        WHERE id = ${candidate.id}::uuid AND college_id = ${req.collegeId}::uuid
        FOR UPDATE;
      `;
      const activation = lockedRows[0];

      // 4. Pre-verification gates under lock
      if (activation.consumed) {
        return { success: false, reason: 'ALREADY_CONSUMED' };
      }
      if (activation.isExpired) {
        return { success: false, reason: 'EXPIRED' };
      }
      if (activation.attempts >= activation.maxAttempts) {
        return { success: false, reason: 'ATTEMPTS_EXHAUSTED' };
      }

      // 5. Compare HMAC-SHA-256 with pepper
      const isMatch = verifyActivationCode(trimmedCode, activation.codeHash);

      // BRANCH 1: INCORRECT CODE (Must increment attempts and commit)
      if (!isMatch) {
        const [updated] = await tx.$queryRaw`
          UPDATE student_activations
          SET attempts = attempts + 1
          WHERE id = ${activation.id}::uuid
          RETURNING attempts, max_attempts AS "maxAttempts";
        `;
        const isLockedOut = updated.attempts >= updated.maxAttempts;
        return {
          success: false,
          reason: isLockedOut ? 'LOCKED_OUT' : 'INVALID_CODE',
          attempts: updated.attempts,
          maxAttempts: updated.maxAttempts,
        };
      }

      // BRANCH 3 & 4: CORRECT CODE
      // Step A: Consume code
      const consumedRows = await tx.$queryRaw`
        UPDATE student_activations
        SET consumed = true
        WHERE id = ${activation.id}::uuid
          AND consumed = false
          AND expires_at > clock_timestamp()
        RETURNING id;
      `;
      if (!consumedRows || consumedRows.length !== 1) {
        return { success: false, reason: 'EXPIRED_DURING_EXECUTION' };
      }

      // Step B: Activate user account
      const [activatedUser] = await tx.$queryRaw`
        UPDATE users
        SET password_hash = ${hashedPassword},
            is_active = true,
            claimed_at = clock_timestamp()
        WHERE id = ${user.id}::uuid
          AND college_id = ${req.collegeId}::uuid
          AND is_active = false
          AND claimed_at IS NULL
        RETURNING id, name, email, role, roll_number AS "rollNumber";
      `;

      // BRANCH 4: FAILED USER UPDATE -> MANDATORY ROLLBACK!
      if (!activatedUser) {
        throw new ActivationRollbackError(
          'User activation failed: account is already active or in conflict. Rolling back code consumption.',
          'CONCURRENT_ACTIVATION_CONFLICT'
        );
      }

      // BRANCH 3: SUCCESS (Both updates committed)
      return { success: true, user: activatedUser };
    });
  } catch (err) {
    if (err instanceof ActivationRollbackError) {
      return res.status(400).json({
        success: false,
        code: err.publicCode,
        message: 'Account activation could not be completed. The account state has changed.',
      });
    }
    throw err;
  }

  // Handle committed failure outcomes
  if (!outcome.success) {
    switch (outcome.reason) {
      case 'INVALID_CODE':
        return res.status(400).json({
          success: false,
          code: 'INVALID_CODE',
          message: 'Invalid verification code.',
          attemptsRemaining: outcome.maxAttempts - outcome.attempts,
        });
      case 'LOCKED_OUT':
      case 'ATTEMPTS_EXHAUSTED':
        return res.status(400).json({
          success: false,
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum verification attempts exceeded. Please request a new code.',
        });
      case 'EXPIRED':
      case 'EXPIRED_DURING_EXECUTION':
        return res.status(400).json({
          success: false,
          code: 'CODE_EXPIRED',
          message: 'Verification code has expired. Please request a new code.',
        });
      default:
        return res.status(400).json({
          success: false,
          code: 'ACTIVATION_FAILED',
          message: 'Invalid or expired activation request.',
        });
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Account activated successfully. You can now log in.',
    user: outcome.user,
  });
});

/**
 * POST /api/auth/student/login
 * Activated student logs in with rollNumber (or email) and password.
 */
exports.studentLogin = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('College tenant context required', 400);
  }

  const { rollNumber, email, password } = req.body;
  if ((!rollNumber && !email) || !password) {
    throw new AppError('Roll number (or email) and password are required', 400);
  }

  const user = await withTenant(req.collegeId, async (tx) => {
    const where = { collegeId: req.collegeId };
    if (rollNumber) {
      where.rollNumber = rollNumber.trim().toUpperCase();
    } else {
      where.email = email.trim().toLowerCase();
    }

    return await tx.user.findFirst({
      where,
      select: {
        id: true,
        collegeId: true,
        name: true,
        email: true,
        rollNumber: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });
  });

  if (!user || !user.passwordHash || !user.isActive) {
    // Constant-time dummy bcrypt work
    await bcrypt.hash(password, 10);
    throw new AppError('Invalid credentials or account not yet activated', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // Option 1: College Admins must not log into Student Portal
  if (user.role === 'COLLEGE_ADMIN') {
    throw new AppError('College Administrators must sign in through the Admin Portal at /login/admin', 403);
  }

  // Generate JWT token
  const token = generateStudentToken(user, req.collegeId);

  // Set HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      rollNumber: user.rollNumber,
      role: user.role,
    },
  });
});

exports.validateStudentPassword = validateStudentPassword;
exports.COMMON_PASSWORDS_DENYLIST = COMMON_PASSWORDS_DENYLIST;
