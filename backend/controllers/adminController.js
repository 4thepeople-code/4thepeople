const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sendInviteEmail, sendDeletionVerificationCode } = require('../services/emailService');
const { sanitizeUser } = require('../utils/sanitizeUser');
const { clubDepartmentsSelect, getClubDepartments, serializeClub } = require('../utils/clubDepartments');
const { uploadBuffer, deleteAsset, deleteAssetsBestEffort } = require('../utils/cloudinaryUpload');

const deletionCodeExpiryMs = 10 * 60 * 1000;
const invalidDeletionCodeMessage = 'Invalid or expired verification code. Request a new one.';

const getUserDeletionTarget = async (db, userId) => {
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError('User not found', 404);
  if (existing.role === 'ADMIN') throw new AppError('Admin accounts cannot be deleted.', 403);

  const ownedClubCount = await db.club.count({ where: { createdById: userId } });
  if (ownedClubCount > 0) {
    throw new AppError(
      `Cannot delete user: they own ${ownedClubCount} club(s). Reassign or delete those clubs first.`,
      409
    );
  }
  return existing;
};

const getClubDeletionTarget = async (db, clubId) => {
  const existingClub = await db.club.findUnique({
    where: { id: clubId },
    select: { logo: true, events: { select: { coverImage: true, gallery: true } } },
  });
  if (!existingClub) throw new AppError('Club not found', 404);

  const blockingEventCount = await db.event.count({
    where: { clubId, status: { not: 'CANCELLED' } },
  });
  if (blockingEventCount > 0) {
    throw new AppError(
      `Cannot delete club: ${blockingEventCount} active or completed events exist. Delete or ensure all events are cancelled first.`,
      409
    );
  }
  return existingClub;
};

const consumeDeletionVerification = async (adminId, targetType, targetId, code) => {
  const verification = await prisma.deletionVerification.findFirst({
    where: { adminId, targetType, targetId, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!verification || verification.expiresAt < new Date() || !(await bcrypt.compare(code, verification.codeHash))) {
    throw new AppError(invalidDeletionCodeMessage, 400);
  }
  await prisma.deletionVerification.update({
    where: { id: verification.id },
    data: { consumed: true },
  });
};

const requestDeletionCode = async (req, res, targetType, targetId) => {
  if (targetType === 'USER') await getUserDeletionTarget(prisma, targetId);
  else await getClubDeletionTarget(prisma, targetId);

  const admin = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, name: true },
  });
  if (!admin) throw new AppError('Admin account not found', 404);

  const code = crypto.randomInt(100000, 1000000).toString();
  await prisma.deletionVerification.updateMany({
    where: { adminId: req.user.id, targetType, targetId, consumed: false },
    data: { consumed: true },
  });
  await prisma.deletionVerification.create({
    data: {
      adminId: req.user.id,
      targetType,
      targetId,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + deletionCodeExpiryMs),
    },
  });
  await sendDeletionVerificationCode(admin.email, admin.name, code);

  res.status(200).json({
    success: true,
    message: 'A verification code has been sent to your admin email address.',
  });
};

exports.requestUserDeletionCode = asyncHandler(async (req, res) => {
  await requestDeletionCode(req, res, 'USER', req.params.userId);
});

exports.requestClubDeletionCode = asyncHandler(async (req, res) => {
  await requestDeletionCode(req, res, 'CLUB', req.params.clubId);
});

/**
 * POST /admin/managers
 * Admin-only route to invite a new manager
 */
exports.createManager = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { name, email } = req.body;

  if (!name || !email) {
    throw new AppError('Name and email are required', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  let user;
  try {
    user = await withTenant(req.collegeId, async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: normalizedEmail, collegeId: req.collegeId },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      return await tx.user.create({
        data: {
          collegeId: req.collegeId,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: null,
          role: 'USER',
          isActive: false,
          inviteTokenHash,
          inviteExpiresAt,
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('User with this email already exists', 409);
    }
    throw error;
  }

  // Send invitation email OUTSIDE transaction
  try {
    await sendInviteEmail(user.email, user.name, rawInviteToken);
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError);
  }

  res.status(201).json({
    success: true,
    message: 'Manager invitation sent successfully',
    user: sanitizeUser(user),
  });
});

/**
 * POST /admin/managers/:userId/resend-invite
 * Admin-only route to resend an invitation email
 */
exports.resendInvite = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { userId } = req.params;
  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isActive) {
      throw new AppError('User account is already active', 400);
    }

    return await tx.user.update({
      where: { id: userId },
      data: {
        inviteTokenHash,
        inviteExpiresAt,
      },
    });
  });

  // Send invitation email OUTSIDE transaction
  try {
    await sendInviteEmail(updatedUser.email, updatedUser.name, rawInviteToken);
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError);
  }

  res.status(200).json({
    success: true,
    message: 'Invitation email resent successfully',
    user: sanitizeUser(updatedUser),
  });
});

/**
 * POST /admin/clubs
 * Admin-only route to create a club
 */
exports.createClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { name, description, isCentral, clubType } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('Club name is required', 400);
  }

  const resolvedClubType = clubType === 'CENTRAL' || isCentral === true ? 'CENTRAL' : 'DEPARTMENTAL';

  let createdClub;
  try {
    createdClub = await withTenant(req.collegeId, async (tx) => {
      return await tx.club.create({
        data: {
          collegeId: req.collegeId,
          name: name.trim(),
          description: description ? description.trim() : null,
          clubType: resolvedClubType,
          createdByUserId: req.user.id,
        },
        include: {
          departments: clubDepartmentsSelect,
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('A club with this name already exists for this college.', 409);
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'Club created successfully',
    data: serializeClub(createdClub),
  });
});

/**
 * PATCH /admin/clubs/:clubId
 * Admin-only route to update a club
 */
exports.updateClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  const { name, description, isCentral, clubType } = req.body;

  // Build update data only for fields that were provided
  const updateData = {};

  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError('Club name cannot be empty', 400);
    }
    updateData.name = name.trim();
  }

  if (description !== undefined) {
    updateData.description = description ? description.trim() : null;
  }

  if (clubType !== undefined) {
    updateData.clubType = clubType;
  } else if (isCentral !== undefined) {
    updateData.clubType = isCentral ? 'CENTRAL' : 'DEPARTMENTAL';
  }

  // Nothing to update
  if (Object.keys(updateData).length === 0) {
    throw new AppError('At least one club field is required', 400);
  }

  let updatedClub;
  try {
    updatedClub = await withTenant(req.collegeId, async (tx) => {
      const existingClub = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
      });
      if (!existingClub) throw new AppError('Club not found', 404);

      const targetIsCentral = updateData.clubType === 'CENTRAL';
      if (targetIsCentral && existingClub.clubType !== 'CENTRAL') {
        const departmentLinkCount = await tx.clubDepartment.count({
          where: {
            clubId,
            collegeId: req.collegeId,
          },
        });
        if (departmentLinkCount > 0) {
          throw new AppError('A club with department links cannot be marked central.', 409);
        }
      }

      return await tx.club.update({
        where: { id: clubId },
        data: updateData,
        include: {
          departments: clubDepartmentsSelect,
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('A club with this name already exists for this college.', 409);
    }
    if (error.message && error.message.includes('check_violation')) {
      throw new AppError('Central clubs cannot be linked to a department.', 409);
    }
    throw error;
  }

  res.status(200).json({
    success: true,
    message: 'Club updated successfully',
    data: serializeClub(updatedClub),
  });
});

/**
 * PATCH /admin/memberships/:membershipId
 * Admin-only route to change a member's role within a club.
 */
exports.updateMembership = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { membershipId } = req.params;
  const { role } = req.body;

  if (role === undefined) {
    throw new AppError('Role is required', 400);
  }

  // Club memberships use MEMBER, while USER is accepted as a legacy-friendly
  // client alias for demoting a manager.
  const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
  const membershipRole = normalizedRole === 'USER' ? 'MEMBER' : normalizedRole;

  if (!['MANAGER', 'MEMBER'].includes(membershipRole)) {
    throw new AppError('Role must be either MANAGER or MEMBER', 400);
  }

  const updatedMembership = await withTenant(req.collegeId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, collegeId: req.collegeId },
    });

    if (!membership) {
      throw new AppError('Membership not found', 404);
    }

    // Demoting the final manager would leave the club unmanaged.
    if (membership.role === 'MANAGER' && membershipRole === 'MEMBER') {
      const managerCount = await tx.membership.count({
        where: {
          clubId: membership.clubId,
          collegeId: req.collegeId,
          role: 'MANAGER',
        },
      });

      if (managerCount <= 1) {
        throw new AppError('A club must have at least one manager', 400);
      }
    }

    return await tx.membership.update({
      where: { id: membershipId },
      data: { role: membershipRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Membership updated successfully',
    data: updatedMembership,
  });
});

/**
 * DELETE /admin/memberships/:membershipId
 * Admin-only route to remove a member from a club.
 */
exports.deleteMembership = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { membershipId } = req.params;

  const deletedMembership = await withTenant(req.collegeId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, collegeId: req.collegeId },
    });

    if (!membership) {
      throw new AppError('Membership not found', 404);
    }

    // Removing the final manager would leave the club unmanaged.
    if (membership.role === 'MANAGER') {
      const managerCount = await tx.membership.count({
        where: {
          clubId: membership.clubId,
          collegeId: req.collegeId,
          role: 'MANAGER',
        },
      });

      if (managerCount <= 1) {
        throw new AppError('A club must have at least one manager', 400);
      }
    }

    return await tx.membership.delete({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Membership deleted successfully',
    data: deletedMembership,
  });
});

/**
 * POST /admin/clubs/:clubId/managers
 * Admin-only route to invite a new manager to a club
 */
exports.inviteManagerToClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  const { name, email } = req.body;

  if (!name || !email) {
    throw new AppError('Name and email are required', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  let user;
  try {
    user = await withTenant(req.collegeId, async (tx) => {
      const club = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
      });
      if (!club) {
        throw new AppError('Club not found', 404);
      }

      const existingUser = await tx.user.findFirst({
        where: { email: normalizedEmail, collegeId: req.collegeId },
      });
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const newUser = await tx.user.create({
        data: {
          collegeId: req.collegeId,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: null,
          role: 'USER',
          isActive: false,
          inviteTokenHash,
          inviteExpiresAt,
        },
      });

      await tx.membership.create({
        data: {
          collegeId: req.collegeId,
          userId: newUser.id,
          clubId,
          role: 'MANAGER',
        },
      });

      return newUser;
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('User or membership already exists', 409);
    }
    throw error;
  }

  // Send invitation email OUTSIDE transaction
  try {
    await sendInviteEmail(user.email, user.name, rawInviteToken);
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError);
  }

  res.status(201).json({
    success: true,
    message: 'Manager invitation sent successfully',
    user: sanitizeUser(user),
  });
});

/**
 * POST /admin/clubs/:clubId/managers/existing
 * Admin-only route to add an active existing user as a club manager
 */
exports.addExistingManagerToClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  let membership;
  try {
    membership = await withTenant(req.collegeId, async (tx) => {
      const club = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
      });
      if (!club) {
        throw new AppError('Club not found', 404);
      }

      const user = await tx.user.findFirst({
        where: { id: userId, collegeId: req.collegeId },
      });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.isActive) {
        throw new AppError('User account is not active', 400);
      }

      return await tx.membership.create({
        data: {
          collegeId: req.collegeId,
          userId,
          clubId,
          role: 'MANAGER',
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('User is already a member of this club', 409);
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'Existing user added as club manager successfully',
    data: membership,
  });
});

/**
 * GET /admin/clubs/:clubId/managers
 * Admin-only route to list managers of a specific club
 */
exports.getClubManagers = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;

  const result = await withTenant(req.collegeId, async (tx) => {
    const club = await tx.club.findFirst({
      where: { id: clubId, collegeId: req.collegeId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!club) {
      throw new AppError('Club not found', 404);
    }

    const managers = await tx.membership.findMany({
      where: {
        clubId,
        collegeId: req.collegeId,
        role: 'MANAGER',
      },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return { club, managers };
  });

  res.status(200).json({
    success: true,
    message: 'Fetched club managers successfully',
    data: result,
  });
});

/**
 * GET /admin/clubs
 * Admin-only route to list clubs with their member counts
 */
exports.listClubs = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const clubs = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findMany({
      where: { collegeId: req.collegeId },
      include: {
        _count: {
          select: { members: true },
        },
        departments: clubDepartmentsSelect,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  });

  const serializedClubs = clubs.map(serializeClub);

  res.status(200).json({
    success: true,
    message: 'Fetched all clubs',
    data: serializedClubs,
  });
});

/**
 * GET /admin/clubs/:clubId
 * Admin-only route to view a club and all of its members
 */
exports.getClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;

  const club = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findFirst({
      where: { id: clubId, collegeId: req.collegeId },
      include: {
        members: {
          select: {
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        departments: clubDepartmentsSelect,
      },
    });
  });

  if (!club) {
    throw new AppError('Club not found', 404);
  }

  res.status(200).json({
    success: true,
    message: `View club with ID ${clubId}`,
    data: serializeClub(club),
  });
});

/**
 * GET /admin/users/:id or /admin/viewUser/:id
 */
exports.viewUser = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { id } = req.params;
  const user = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findFirst({
      where: { id, collegeId: req.collegeId },
      include: {
        memberships: {
          where: { collegeId: req.collegeId },
          include: {
            club: {
              select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    message: `View user with ID ${id}`,
    data: sanitizeUser(user),
  });
});

/**
 * GET /admin/users or /admin/viewAllUsers
 */
exports.viewAllUsers = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const users = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.findMany({
      where: { collegeId: req.collegeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        avatarPublicId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  });

  res.status(200).json({
    success: true,
    message: 'Fetched all users',
    data: sanitizeUser(users),
  });
});

/**
 * GET /admin/clubs/:id or /admin/viewClub/:id
 */
exports.viewClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { id } = req.params;

  const club = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findFirst({
      where: { id, collegeId: req.collegeId },
      include: {
        departments: clubDepartmentsSelect,
      },
    });
  });

  if (!club) {
    throw new AppError('Club not found', 404);
  }

  res.status(200).json({
    success: true,
    message: `View club with ID ${id}`,
    data: serializeClub(club),
  });
});

/**
 * GET /admin/clubs or /admin/viewAllClubs
 */
exports.viewAllClubs = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const clubs = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findMany({
      where: { collegeId: req.collegeId },
      include: {
        departments: clubDepartmentsSelect,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  });

  res.status(200).json({
    success: true,
    message: 'Fetched all clubs',
    data: clubs.map(serializeClub),
  });
});

/**
 * DELETE /admin/users/:id or /admin/deleteUser/:id
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await consumeDeletionVerification(req.user.id, 'USER', id, req.body.code);

  const user = await prisma.$transaction(async (tx) => {
    const existing = await getUserDeletionTarget(tx, id);

    await tx.membership.deleteMany({ where: { userId: id } });
    return tx.user.delete({ where: { id } });
  });

  res.status(200).json({
    success: true,
    message: `Deleted user with ID ${id}`,
    data: sanitizeUser(user),
  });
});

/**
 * DELETE /admin/clubs/:clubId or /admin/deleteClub/:id
 */
exports.deleteClub = asyncHandler(async (req, res) => {
  const clubId = req.params.clubId || req.params.id;
  await consumeDeletionVerification(req.user.id, 'CLUB', clubId, req.body.code);

  const existingClub = await getClubDeletionTarget(prisma, clubId);

  const assetIds = [
    existingClub.logo?.publicId,
    ...existingClub.events.flatMap((event) => [
      event.coverImage?.publicId,
      ...(event.gallery || []).map((image) => image.publicId),
    ]),
  ];
  await deleteAssetsBestEffort(assetIds, `club ${clubId}`);

  const club = await prisma.$transaction(async (tx) => {
    const concurrentBlockingEventCount = await tx.event.count({
      where: { clubId, status: { not: 'CANCELLED' } },
    });
    if (concurrentBlockingEventCount > 0) {
      throw new AppError(
        `Cannot delete club: ${concurrentBlockingEventCount} active or completed events exist. Delete or ensure all events are cancelled first.`,
        409
      );
    }

    // Memberships and cancelled events reference the club, so remove them first.
    await tx.membership.deleteMany({ where: { clubId } });
    await tx.event.deleteMany({ where: { clubId, status: 'CANCELLED' } });

    return tx.club.delete({ where: { id: clubId } });
  });

  res.status(200).json({
    success: true,
    message: `Deleted club with ID ${clubId}`,
    data: club,
  });
});

/**
 * GET /admin/profile
 * Fetch logged-in admin's profile and system metrics
 */
exports.getAdminProfile = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;

  const result = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        avatarPublicId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Admin profile not found', 404);
    }

    const totalUsers = await tx.user.count({ where: { collegeId: req.collegeId } });
    const totalClubs = await tx.club.count({ where: { collegeId: req.collegeId } });
    const createdClubs = await tx.club.count({ where: { createdByUserId: userId, collegeId: req.collegeId } });

    return {
      user: sanitizeUser(user),
      stats: {
        totalUsers,
        totalClubs,
        createdClubs,
      },
    };
  });

  res.status(200).json({
    success: true,
    message: 'Fetched admin profile',
    data: {
      ...result.user,
      stats: result.stats,
    },
  });
});

/**
 * PATCH /admin/profile
 * Update logged-in admin's profile name and/or password
 */
exports.updateAdminProfile = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;
  const { name, currentPassword, newPassword } = req.body;

  const updateData = {};

  if (name && name.trim()) {
    updateData.name = name.trim();
  }

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
    });

    if (!user) {
      throw new AppError('Admin user not found', 404);
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required to change password', 400);
      }
      if (!user.passwordHash) {
        throw new AppError('Password not set for this account', 400);
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Current password is incorrect', 400);
      }
      if (newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters', 400);
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No valid profile fields provided for update', 400);
    }

    return await tx.user.update({
      where: { id: userId },
      data: updateData,
    });
  });

  res.status(200).json({
    success: true,
    message: 'Admin profile updated successfully',
    data: sanitizeUser(updatedUser),
  });
});

/**
 * POST /admin/profile/avatar
 * Uploads the logged-in admin's profile picture to Cloudinary.
 */
exports.uploadAdminAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("An image file is required in the 'avatar' field", 400);
  }

  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;

  const currentAvatarPublicId = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
      select: { avatarPublicId: true },
    });
    if (!user) throw new AppError('Admin user not found', 404);
    return user.avatarPublicId;
  });

  if (currentAvatarPublicId) {
    try {
      await deleteAsset(currentAvatarPublicId);
    } catch (e) {
      console.warn('Failed to delete old avatar asset:', e.message);
    }
  }

  const uploadResult = await uploadBuffer(req.file.buffer, `users/${userId}/avatar`);

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.update({
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
  });

  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: sanitizeUser(updatedUser),
  });
});

/**
 * DELETE /admin/profile/avatar
 * Deletes the logged-in admin's profile picture.
 */
exports.deleteAdminAvatar = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const userId = req.user.id;

  const currentAvatarPublicId = await withTenant(req.collegeId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, collegeId: req.collegeId },
      select: { avatarPublicId: true },
    });
    if (!user) throw new AppError('Admin user not found', 404);
    return user.avatarPublicId;
  });

  if (currentAvatarPublicId) {
    try {
      await deleteAsset(currentAvatarPublicId);
    } catch (e) {
      console.warn('Failed to delete avatar asset:', e.message);
    }
  }

  const updatedUser = await withTenant(req.collegeId, async (tx) => {
    return await tx.user.update({
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
  });

  res.status(200).json({
    success: true,
    message: 'Profile picture removed successfully',
    data: sanitizeUser(updatedUser),
  });
});
