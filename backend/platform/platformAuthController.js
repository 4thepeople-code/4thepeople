const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { platformPrisma } = require('../config/platformDb');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const {
  verifyTotp,
  recordAndCheckTotpUsage,
  generateTotpSecret,
  encryptTotpSecret,
  generateOtpauthUrl,
  base32Decode,
  generateHotp,
} = require('../utils/totp');
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
    sameSite: 'strict', // Always strict for platform administration
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
 * GET /api/platform/auth/setup-status
 * Checks whether the platform has been initialized with at least one super-administrator.
 * Used by the frontend to render the First-Run Initialization Wizard when 0 admins exist.
 */
exports.getPlatformSetupStatus = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform authentication is only allowed on the platform administration host', 403);
  }

  const count = await platformPrisma.platformAdmin.count();
  res.status(200).json({
    success: true,
    isInitialized: count > 0,
    count,
  });
});

/**
 * POST /api/platform/auth/setup-initial
 * Provisions the initial root Platform Super-Administrator when database count === 0.
 * Once at least 1 administrator exists, this endpoint is permanently locked.
 */
exports.setupInitialPlatformAdmin = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform authentication is only allowed on the platform administration host', 403);
  }

  const count = await platformPrisma.platformAdmin.count();
  if (count > 0) {
    throw new AppError('Platform has already been initialized. Initial setup is locked.', 403);
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new AppError('Please provide name, email, and password', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  // Generate initial TOTP keypair
  const plainSecret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(plainSecret);
  const otpauthUrl = generateOtpauthUrl(normalizedEmail, plainSecret, '4THEPEOPLE Platform');

  const admin = await platformPrisma.platformAdmin.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      totpSecret: encryptedSecret,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  const secretBuf = base32Decode(plainSecret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const liveCode = generateHotp(secretBuf, counter, 6);
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

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

  res.cookie('yuva_platform_token', token, getPlatformCookieOptions());

  res.status(201).json({
    success: true,
    message: 'Root Platform Super-Administrator initialized successfully.',
    admin: {
      ...admin,
      role: 'PLATFORM_SUPER_ADMIN',
    },
    totp: {
      secret: plainSecret,
      otpauthUrl,
      liveCode,
      secondsRemaining,
    },
  });
});

/**
 * POST /api/platform/auth/login
 * Privileged Platform Super-Administrator Login supporting:
 * 1. Step 1 (Credentials Only): Returns { requiresTotp: true } or { requiresTotpSetup: true, setup: {...} }
 * 2. Step 2 (2FA Code or Setup Confirmation): Verifies TOTP, sets host-only cookie, and logs in.
 * 3. 1-Step (Backwards-compatible): Verifies email, password, and TOTP code in a single request.
 */
exports.platformLogin = asyncHandler(async (req, res) => {
  // Reject platform login on college or directory hosts
  if (!req.isPlatform) {
    throw new AppError('Platform authentication is only allowed on the platform administration host', 403);
  }

  const { email, password, totpCode, totp, setupSecret } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide both email and password', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientIp = getClientIp(req);

  // Per-account + IP throttling check
  const throttleStatus = checkLoginThrottled(normalizedEmail, clientIp);
  if (throttleStatus.isThrottled) {
    throw new AppError(throttleStatus.reason || `Too many failed login attempts. Please try again in ${throttleStatus.retryAfterSeconds} seconds.`, 429);
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

  const code = totpCode || totp;

  // Case A: 2-Step Login — User submitted email & password without a TOTP code yet
  if (!code && !setupSecret) {
    // If admin already has TOTP enrolled, ask for the code
    if (admin.totpSecret) {
      return res.status(200).json({
        success: true,
        requiresTotp: true,
        message: 'Password verified. Please enter the 6-digit code from your authenticator app.',
        admin: {
          email: admin.email,
          name: admin.name,
        },
      });
    }

    // If admin has NOT enrolled TOTP yet, generate setup credentials right now!
    const plainSecret = generateTotpSecret();
    const otpauthUrl = generateOtpauthUrl(admin.email, plainSecret, '4THEPEOPLE Platform');
    const secretBuf = base32Decode(plainSecret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const liveCode = generateHotp(secretBuf, counter, 6);
    const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

    return res.status(200).json({
      success: true,
      requiresTotpSetup: true,
      message: 'Password verified. Please configure your two-factor authenticator.',
      admin: {
        email: admin.email,
        name: admin.name,
      },
      setup: {
        secret: plainSecret,
        otpauthUrl,
        liveCode,
        secondsRemaining,
      },
    });
  }

  // Case B: Admin is enrolling TOTP during login (submitting setupSecret + code)
  if (!admin.totpSecret && setupSecret && code) {
    const isTotpValid = verifyTotp(code, setupSecret.trim());
    if (!isTotpValid) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Invalid two-factor authentication code for setup key', 401);
    }

    const encryptedSecret = encryptTotpSecret(setupSecret.trim());
    await platformPrisma.platformAdmin.update({
      where: { id: admin.id },
      data: { totpSecret: encryptedSecret },
    });
    admin.totpSecret = encryptedSecret;
  }

  // Case C: Standard TOTP Verification (admin has enrolled totpSecret)
  if (admin.totpSecret) {
    if (!code) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Two-factor authentication code required', 400);
    }

    const isTotpValid = verifyTotp(code, admin.totpSecret);
    if (!isTotpValid) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Invalid two-factor authentication code', 401);
    }

    // Reject code reuse within its window
    const isFresh = recordAndCheckTotpUsage(admin.id, code);
    if (!isFresh) {
      recordFailedLogin(normalizedEmail, clientIp);
      throw new AppError('Two-factor authentication code has already been used. Please wait for the next code.', 401);
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

  // Do not return token in body when cookie is set, unless ALLOW_BEARER_RESPONSE=true
  const allowBearerResponse = process.env.ALLOW_BEARER_RESPONSE === 'true';

  res.status(200).json({
    success: true,
    message: 'Platform administrator login successful',
    ...(allowBearerResponse ? { token } : {}),
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
    sameSite: 'strict',
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
