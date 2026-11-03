const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sanitizeUser } = require('../utils/sanitizeUser');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * GET /invite/:token/validate
 * Public route to validate invitation token expiry and active status.
 * Requires college tenant context.
 */
exports.validateInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new AppError('Invite token is required', 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const tokenHash = hashToken(token);

  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        inviteTokenHash: tokenHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        inviteExpiresAt: true,
      },
    });
  });

  if (!user || user.isActive || !user.inviteExpiresAt || new Date(user.inviteExpiresAt) < new Date()) {
    return res.status(200).json({
      success: true,
      message: 'Invitation validation completed',
      data: { valid: false },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Invitation validation completed',
    data: {
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    },
  });
});

/**
 * POST /invite/:token/accept
 * Public route to accept invitation and set password.
 * Requires college tenant context.
 */
exports.acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const tokenHash = hashToken(token);
  const hashedPassword = await bcrypt.hash(password, 10);

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        collegeId: req.collegeId,
        inviteTokenHash: tokenHash,
      },
    });

    if (!user) {
      throw new AppError('Invalid invitation token', 400);
    }

    if (user.isActive) {
      throw new AppError('Invitation has already been accepted', 400);
    }

    if (!user.inviteExpiresAt || new Date(user.inviteExpiresAt) < new Date()) {
      throw new AppError('Invitation token has expired. Please ask an admin to resend your invite.', 400);
    }

    return await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        isActive: true,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Invitation accepted successfully. You can now log in.',
    user: sanitizeUser(updatedUser),
  });
});
