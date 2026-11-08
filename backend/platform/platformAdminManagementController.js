const bcrypt = require('bcryptjs');
const { platformPrisma } = require('../config/platformDb');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const {
  generateTotpSecret,
  encryptTotpSecret,
  generateOtpauthUrl,
  generateHotp,
  base32Decode,
} = require('../utils/totp');

/**
 * GET /api/platform/admins
 * List all platform super-administrators.
 * Protected: requires valid yuva_platform_token (authenticatePlatformToken).
 */
exports.listAdmins = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform endpoint only', 403);
  }

  const admins = await platformPrisma.platformAdmin.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      totpSecret: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({
    success: true,
    data: {
      admins: admins.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        isActive: a.isActive,
        totpEnrolled: Boolean(a.totpSecret),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    },
  });
});

/**
 * POST /api/platform/admins
 * Create a new platform super-administrator.
 * Protected: requires existing authenticated super-admin.
 * New account is ACTIVE but has NO totpSecret — they must enroll TOTP on first login.
 */
exports.createAdmin = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform endpoint only', 403);
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await platformPrisma.platformAdmin.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new AppError(`A platform administrator with email '${normalizedEmail}' already exists`, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await platformPrisma.platformAdmin.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      isActive: true,
      // No totpSecret — must be enrolled separately
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.status(201).json({
    success: true,
    message: `Platform administrator '${admin.email}' created. They must enroll TOTP before they can log in.`,
    data: {
      admin: {
        ...admin,
        totpEnrolled: false,
      },
    },
  });
});

/**
 * PATCH /api/platform/admins/:id
 * Update a platform administrator's active status or name.
 * A super-admin cannot deactivate their own account.
 */
exports.updateAdmin = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform endpoint only', 403);
  }

  const { id } = req.params;
  const { isActive, name } = req.body;

  const target = await platformPrisma.platformAdmin.findUnique({ where: { id } });
  if (!target) {
    throw new AppError('Platform administrator not found', 404);
  }

  // Prevent self-deactivation
  if (typeof isActive === 'boolean' && !isActive && req.platformAdmin.id === id) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  const updateData = {};
  if (typeof isActive === 'boolean') updateData.isActive = isActive;
  if (name && typeof name === 'string' && name.trim()) updateData.name = name.trim();

  if (Object.keys(updateData).length === 0) {
    throw new AppError('Nothing to update — provide isActive or name', 400);
  }

  const updated = await platformPrisma.platformAdmin.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      totpSecret: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Platform administrator updated',
    data: {
      admin: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        isActive: updated.isActive,
        totpEnrolled: Boolean(updated.totpSecret),
        updatedAt: updated.updatedAt,
      },
    },
  });
});

/**
 * POST /api/platform/admins/:id/totp/reset
 * Reset (clear) the TOTP secret for a platform administrator.
 * After reset the target admin CANNOT log in until they re-enroll TOTP.
 * A super-admin cannot reset their own TOTP via this endpoint (use /totp/enroll instead).
 */
exports.resetAdminTotp = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform endpoint only', 403);
  }

  const { id } = req.params;

  if (req.platformAdmin.id === id) {
    throw new AppError('Use POST /api/platform/auth/totp/enroll to manage your own TOTP', 400);
  }

  const target = await platformPrisma.platformAdmin.findUnique({ where: { id } });
  if (!target) {
    throw new AppError('Platform administrator not found', 404);
  }

  await platformPrisma.platformAdmin.update({
    where: { id },
    data: { totpSecret: null },
  });

  res.status(200).json({
    success: true,
    message: `TOTP has been cleared for ${target.email}. They must re-enroll before logging in.`,
  });
});

/**
 * POST /api/platform/auth/totp/enroll
 * Self-service TOTP enrollment for the currently authenticated platform admin.
 * Returns the otpauth:// URI and a live 6-digit code.
 * This is called at first login if totpSecret is null, or to rotate the key.
 */
exports.enrollOwnTotp = asyncHandler(async (req, res) => {
  if (!req.isPlatform) {
    throw new AppError('Platform endpoint only', 403);
  }

  const { verificationCode } = req.body;

  const admin = await platformPrisma.platformAdmin.findUnique({
    where: { id: req.platformAdmin.id },
  });
  if (!admin) {
    throw new AppError('Platform administrator not found', 404);
  }

  // Generate a new TOTP secret
  const plainSecret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(plainSecret);
  const otpauthUrl = generateOtpauthUrl(admin.email, plainSecret, '4THEPEOPLE Platform');

  // If a verificationCode is provided, verify it and commit the secret
  if (verificationCode) {
    const secretBuf = base32Decode(plainSecret);
    const counter = Math.floor(Date.now() / 1000 / 30);

    // Check current and adjacent windows
    const isValid = [-1, 0, 1].some(offset => {
      const code = generateHotp(secretBuf, counter + offset, 6);
      return code === String(verificationCode).trim();
    });

    if (!isValid) {
      throw new AppError('Verification code does not match the generated secret — please try again', 400);
    }

    await platformPrisma.platformAdmin.update({
      where: { id: admin.id },
      data: { totpSecret: encryptedSecret },
    });

    return res.status(200).json({
      success: true,
      message: 'TOTP enrolled successfully. Use your authenticator app for future logins.',
      data: { totpEnrolled: true },
    });
  }

  // No verificationCode — return the setup info so the UI can show the QR/secret
  const secretBuf = base32Decode(plainSecret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const liveCode = generateHotp(secretBuf, counter, 6);
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  // Store the pending secret temporarily in the response only — UI must call again with verificationCode
  res.status(200).json({
    success: true,
    message: 'Scan the QR code or enter the secret key in your authenticator app, then call this endpoint again with verificationCode.',
    data: {
      otpauthUrl,
      secret: plainSecret,
      liveCode,
      secondsRemaining,
      totpEnrolled: false,
    },
  });
});

