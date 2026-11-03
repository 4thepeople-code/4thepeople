const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { platformPrisma } = require('../config/platformDb');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

const getPlatformCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
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
 */
exports.platformLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide both email and password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const admin = await platformPrisma.platformAdmin.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    throw new AppError('Invalid platform administrator credentials', 401);
  }

  if (!admin.isActive) {
    throw new AppError('Platform administrator account is inactive', 403);
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid platform administrator credentials', 401);
  }

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
    { expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '12h' }
  );

  // Set dedicated platform cookie
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
