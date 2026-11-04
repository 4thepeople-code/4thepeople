const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { platformPrisma } = require('../config/platformDb');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { verifyTotp } = require('../utils/totp');
const {
  checkLoginThrottled,
  recordFailedLogin,
  resetLoginThrottling,
  performDummyPasswordComparison,
  getClientIp,
} = require('../utils/loginSecurity');

const getPlatformCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours (short expiry, host-only: NO domain attribute)
  };
};

const getEffectivePlatformSecret = () => {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PLATFORM_JWT_SECRET configuration missing in production');
    }
    return 'dev_platform_super_admin_jwt_secret_fallback_key';
  }
  return secret;
};

/**
 * POST /api/platform/auth/login
 * Privileged Platform Super-Administrator Login.
 * Authenticates against platform_admins using platform_ops database client.
 * Enforces:
 * 1. Host check (must be admin.4thepeople.in or admin.localhost)
 * 2. Per-account + IP throttling
 * 3. Constant-time response pad for unknown accounts
 * 4. TOTP 2FA verification when totpSecret is configured
 */
exports.platformLogin = asyncHandler(async (req, res) => {
  // Reject platform login on college or directory hosts
  if (!req.isPlatform) {
    throw new AppError('Platform authentication is only allowed on the platform administration host', 403);
  }

  const { email, password, totpCode, totp } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide both email and password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientIp = getClientIp(req);

  // Per-account + IP throttling check
  const throttleStatus = checkLoginThrottled(normalizedEmail, clientIp);
  if (throttleStatus.isThrottled) {
    throw new AppError(`Too many failed login attempts. Please try again in ${throttleStatus.retryAfterSeconds} seconds.`, 429);
  }

  const admin = await platformPrisma.platformAdmin.findUnique({
    where: { email: normalizedEmail },
  });

  // Constant-time execution pad for non-existent platform admins
  if (!admin) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid platform administrator credentials', 401);
  }

  if (!admin.isActive) {
    await performDummyPasswordComparison(password);
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Platform administrator account is inactive', 403);
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    recordFailedLogin(normalizedEmail, clientIp);
    throw new AppError('Invalid platform administrator credentials', 401);
  }

  // TOTP 2FA verification if totpSecret exists
  if (admin.totpSecret) {
    const code = totpCode || totp;
    if (!code) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Two-factor authentication code required', 400);
    }

    const isTotpValid = verifyTotp(code, admin.totpSecret);
    if (!isTotpValid) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Invalid two-factor authentication code', 401);
    }
  }

  // Reset throttling upon successful authentication
  resetLoginThrottling(normalizedEmail, clientIp);

  const token = jwt.sign(
    {
      platformAdminId: admin.id,
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'PLATFORM_SUPER_ADMIN',
      type: 'platform',
    },
    getEffectivePlatformSecret(),
    { expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '4h' }
  );

  // Set dedicated platform cookie (host-only, no Domain attribute)
  res.cookie('yuva_platform_token', token, getPlatformCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Platform administrator login successful',
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'PLATFORM_SUPER_ADMIN',
    },
  });
});

/**
 * POST /api/platform/auth/logout
 * Clears the dedicated platform admin cookie.
 */
exports.platformLogout = asyncHandler(async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('yuva_platform_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Platform administrator logged out successfully',
  });
});

/**
 * GET /api/platform/auth/me
 * Retrieves current platform administrator profile.
 */
exports.getPlatformMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    admin: req.platformAdmin,
  });
});
