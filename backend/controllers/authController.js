const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sanitizeUser } = require('../utils/sanitizeUser');
const { sendManagerPasswordResetOtp } = require('../services/emailService');
const {
  checkLoginThrottled,
  recordFailedLogin,
  resetLoginThrottling,
  performDummyPasswordComparison,
  getClientIp,
} = require('../utils/loginSecurity');

const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours (short expiry, host-only: NO domain attribute)
  };
};

/**
 * POST /auth/admin/login
 * College Admin login endpoint.
 * Requires college tenant context (resolved from subdomain).
 */
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide both email and password', 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientIp = getClientIp(req);

  // Per-account + IP throttling check
  const throttleStatus = checkLoginThrottled(normalizedEmail, clientIp);
  if (throttleStatus.isThrottled) {
    throw new AppError(`Too many failed login attempts. Please try again in ${throttleStatus.retryAfterSeconds} seconds.`, 429);
  }

  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        email: normalizedEmail,
      },
    });
  });

  // Constant-time execution pad for non-existent users
  if (!user) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid email or password', 401);
  }

  // Check role: must be COLLEGE_ADMIN
  if (user.role !== 'COLLEGE_ADMIN') {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Access denied: User is not a college administrator', 403);
  }

  // Check active status
  if (!user.isActive) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Account is inactive. Please contact system administrator.', 403);
  }

  // Check password hash
  if (!user.passwordHash) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid email or password', 401);
  }

  // Reset throttling upon successful login
  resetLoginThrottling(normalizedEmail, clientIp);

  // Generate JWT token with college tenant claims
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET configuration missing in production environment');
  }
  const effectiveSecret = jwtSecret || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';
  const jwtExpiry = process.env.JWT_EXPIRES_IN || '24h';

  const token = jwt.sign(
    {
      userId: user.id,
      id: user.id,
      collegeId: req.collegeId,
      name: user.name,
      email: user.email,
      role: user.role,
      type: 'college',
    },
    effectiveSecret,
    { expiresIn: jwtExpiry }
  );

  // Set httpOnly cookie (host-only, no Domain attribute)
  res.cookie('yuva_token', token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Admin login successful',
    token,
    user: sanitizeUser(user),
  });
});

/**
 * POST /auth/manager/login
 * Manager / User login endpoint.
 * Requires college tenant context.
 */
exports.managerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide both email and password', 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientIp = getClientIp(req);

  // Per-account + IP throttling check
  const throttleStatus = checkLoginThrottled(normalizedEmail, clientIp);
  if (throttleStatus.isThrottled) {
    throw new AppError(`Too many failed login attempts. Please try again in ${throttleStatus.retryAfterSeconds} seconds.`, 429);
  }

  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        email: normalizedEmail,
      },
    });
  });

  // Constant-time execution pad for non-existent users
  if (!user) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.passwordHash) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Account setup is not complete. Please accept your invitation first.', 400);
  }

  if (!user.isActive) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Account is inactive. Please accept your invite or contact an admin.', 403);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid email or password', 401);
  }

  // Reset throttling upon successful login
  resetLoginThrottling(normalizedEmail, clientIp);

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET configuration missing in production environment');
  }
  const effectiveSecret = jwtSecret || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';
  const jwtExpiry = process.env.JWT_EXPIRES_IN || '24h';

  const token = jwt.sign(
    {
      userId: user.id,
      id: user.id,
      collegeId: req.collegeId,
      name: user.name,
      email: user.email,
      role: user.role,
      type: 'college',
    },
    effectiveSecret,
    { expiresIn: jwtExpiry }
  );

  res.cookie('yuva_token', token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Manager login successful',
    token,
    user: sanitizeUser(user),
  });
});

/**
 * POST /auth/logout
 * College user logout endpoint.
 */
exports.logout = asyncHandler(async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('yuva_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /auth/manager/forgot-password
 * Sends a password reset OTP to an active manager account.
 */
exports.requestManagerPasswordReset = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  let otpToSend = null;
  let userRecipient = null;

  await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        memberships: {
          where: { role: 'MANAGER' },
          select: { id: true },
          take: 1,
        },
      },
    });

    // Invariant: only active users with MANAGER memberships receive OTP
    if (user && user.isActive && user.memberships.length > 0) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordResetOtpHash: hashOtp(otp),
          passwordResetOtpExpiresAt: new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS),
          passwordResetAttempts: 0, // Reset attempt counter on fresh request
        },
      });

      otpToSend = otp;
      userRecipient = { email: user.email, name: user.name };
    }
  });

  // Architectural convention: execute external network dispatch OUTSIDE the transaction
  if (otpToSend && userRecipient) {
    try {
      await sendManagerPasswordResetOtp(userRecipient.email, userRecipient.name, otpToSend);
    } catch (err) {
      console.error('[authController] Failed to dispatch password reset OTP email:', err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'If an active manager account exists for that email, an OTP has been sent.',
  });
});

/**
 * POST /auth/manager/reset-password
 * Verifies the OTP with brute-force protection and updates the password.
 */
exports.resetManagerPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password) {
    throw new AppError('Email, OTP, and new password are required', 400);
  }

  if (password.trim().length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Hash new password before opening the transaction (convention: keep CPU-heavy work outside tx)
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        email: normalizedEmail,
      },
      select: {
        id: true,
        isActive: true,
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
        passwordResetAttempts: true,
        memberships: {
          where: { role: 'MANAGER' },
          select: { id: true },
          take: 1,
        },
      },
    });
  });

  if (!user || !user.isActive || user.memberships.length === 0) {
    throw new AppError('Invalid or expired OTP', 400);
  }

  // Brute-force protection: check failed attempts
  if (user.passwordResetAttempts >= MAX_OTP_ATTEMPTS) {
    // Invalidate OTP on excessive failed attempts in a committed transaction
    await withTenant(req.collegeId, async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordResetOtpHash: null,
          passwordResetOtpExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });
    });
    throw new AppError('Too many failed attempts. Please request a new OTP.', 400);
  }

  // Check expiration
  if (
    !user.passwordResetOtpHash ||
    !user.passwordResetOtpExpiresAt ||
    new Date(user.passwordResetOtpExpiresAt) < new Date()
  ) {
    throw new AppError('Invalid or expired OTP', 400);
  }

  // Check OTP match
  if (hashOtp(otp) !== user.passwordResetOtpHash) {
    // Persist increment of failed attempts in a committed transaction
    await withTenant(req.collegeId, async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordResetAttempts: { increment: 1 },
        },
      });
    });
    throw new AppError('Invalid or expired OTP', 400);
  }

  // Successful verification: update password and clear reset state
  await withTenant(req.collegeId, async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetAttempts: 0,
      },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now log in.',
  });
});
