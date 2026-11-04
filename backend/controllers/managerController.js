const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteAsset } = require('../utils/cloudinaryUpload');
const { sanitizeUser } = require('../utils/sanitizeUser');
const { serializeClub } = require('../utils/clubDepartments');

/**
 * GET /manager/my-clubs
 * Returns clubs for which the authenticated user has a MANAGER membership in the current college.
 */
exports.getMyClubs = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const memberships = await withTenant(req.collegeId, async (tx) => {
    return await tx.membership.findMany({
      where: {
        userId: req.user.id,
        role: 'MANAGER',
        collegeId: req.collegeId,
      },
      select: {
        club: {
          select: {
            id: true,
            name: true,
            description: true,
            clubType: true,
            logoUrl: true,
            logoPublicId: true,
            coverImageUrl: true,
            coverImagePublicId: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  });

  if (memberships.length === 0) {
    throw new AppError('Access denied: Manager membership required', 403);
  }

  res.status(200).json({
    success: true,
    message: 'Fetched managed clubs successfully',
    clubs: memberships.map(({ club }) => serializeClub(club)),
  });
});

/**
 * PATCH /manager/clubs/:clubId
 * Updates only manager-editable Club fields after requireClubManager authorizes it.
 */
exports.updateManagedClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  const allowedFields = ['name', 'description'];
  const body = req.body;

  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new AppError('Update data must be an object', 400);
  }

  const receivedFields = Object.keys(body);

  if (receivedFields.length === 0) {
    throw new AppError('At least one field (name or description) is required', 400);
  }

  const unexpectedField = receivedFields.find((field) => !allowedFields.includes(field));
  if (unexpectedField) {
    throw new AppError(`Field '${unexpectedField}' cannot be updated`, 400);
  }

  const updateData = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw new AppError('Club name cannot be empty', 400);
    }
    updateData.name = body.name.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new AppError('Club description must be a string or null', 400);
    }
    updateData.description = body.description === null ? null : body.description.trim();
  }

  try {
    const club = await withTenant(req.collegeId, async (tx) => {
      const existing = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
      });
      if (!existing) throw new AppError('Club not found', 404);

      return await tx.club.update({
        where: { id: clubId },
        data: updateData,
      });
    });

    res.status(200).json({
      success: true,
      message: 'Club updated successfully',
      data: serializeClub(club),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('A club with this name already exists for this college.', 409);
    }
    throw error;
  }
});

/**
 * GET /manager/profile
 * Returns profile details for the authenticated manager.
 */
exports.getManagerProfile = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;
  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: { role: 'MANAGER', collegeId: req.collegeId },
          select: {
            club: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  });

  if (!user) {
    throw new AppError('User profile not found', 404);
  }

  res.status(200).json({
    success: true,
    data: {
      ...sanitizeUser(user),
      managedClubs: user.memberships?.map((m) => m.club) || [],
    },
  });
});

/**
 * PATCH /manager/profile
 * Updates manager's name and/or password.
 */
exports.updateManagerProfile = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;
  const { name, currentPassword, newPassword } = req.body;

  const updateData = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new AppError('Name cannot be empty', 400);
    }
    updateData.name = name.trim();
  }

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required to set a new password', 400);
      }
      if (!user.passwordHash) {
        throw new AppError('Account password is not set', 400);
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Current password is incorrect', 401);
      }

      if (newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters', 400);
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No profile changes provided', 400);
    }

    return await tx.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
        updatedAt: true,
      },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: sanitizeUser(updatedUser),
  });
});

/**
 * POST /manager/profile/avatar
 * Uploads profile avatar image to Cloudinary.
 */
exports.uploadManagerAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("An image file is required in the 'avatar' field", 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;

  // 1. Upload new image to Cloudinary first
  const uploadResult = await uploadBuffer(req.file.buffer, `users/${userId}/avatar`);

  // 2. Commit to database first (with compensation if DB fails)
  let updatedUser;
  let oldAvatarPublicId = null;
  try {
    const result = await withTenant(req.collegeId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, collegeId: req.collegeId },
        select: { avatarPublicId: true },
      });
      if (!user) throw new AppError('User not found', 404);

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          avatarUrl: uploadResult.url,
          avatarPublicId: uploadResult.publicId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          avatarPublicId: true,
        },
      });
      return { updated, oldAvatar: user.avatarPublicId };
    });
    updatedUser = result.updated;
    oldAvatarPublicId = result.oldAvatar;
  } catch (dbError) {
    try {
      await deleteAsset(uploadResult.publicId);
    } catch (cleanupErr) {
      console.error('Failed to compensate newly uploaded manager avatar after DB failure:', cleanupErr.message);
    }
    throw dbError;
  }

  // 3. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldAvatarPublicId) {
    try {
      await deleteAsset(oldAvatarPublicId);
    } catch (e) {
      console.warn('Failed to delete old avatar asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: sanitizeUser(updatedUser),
  });
});

/**
 * DELETE /manager/profile/avatar
 * Deletes profile picture from Cloudinary and clears user avatar.
 */
exports.deleteManagerAvatar = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;

  // 1. Commit database changes first
  const { updatedUser, oldAvatarPublicId } = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
      select: { avatarPublicId: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
      },
    });
    return { updatedUser: updated, oldAvatarPublicId: user.avatarPublicId };
  });

  // 2. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldAvatarPublicId) {
    try {
      await deleteAsset(oldAvatarPublicId);
    } catch (e) {
      console.warn('Failed to delete avatar asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Profile picture removed successfully',
    data: sanitizeUser(updatedUser),
  });
});
