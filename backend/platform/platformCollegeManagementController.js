const crypto = require('crypto');
const { platformPrisma } = require('../config/platformDb');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { sendCollegeAdminInviteEmail } = require('../services/emailService');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Computes human-readable and UI-categorized status for a College Admin user.
 */
function computeAdminStatus(user) {
  if (!user) return 'NOT_ASSIGNED';
  if (user.isActive) return 'ACTIVE';
  if (user.inviteTokenHash) {
    const isExpired = user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date();
    return isExpired ? 'INVITATION_EXPIRED' : 'PENDING_ACTIVATION';
  }
  return 'SUSPENDED';
}

/**
 * Serializes college model with assigned admin summary.
 */
function serializeCollegeWithAdmin(college) {
  const admins = college.users || [];
  // Primary admin is the first active, or first pending/expired, or latest created admin
  const primaryAdmin = admins.find((u) => u.isActive) || admins[0] || null;

  return {
    id: college.id,
    name: college.name,
    slug: college.slug,
    code: college.code || college.slug.toUpperCase(),
    officialEmail: college.officialEmail,
    address: college.address,
    city: college.city,
    state: college.state,
    contactNumber: college.contactNumber,
    isActive: Boolean(college.isActive),
    createdAt: college.createdAt,
    updatedAt: college.updatedAt,
    admin: primaryAdmin
      ? {
          id: primaryAdmin.id,
          name: primaryAdmin.name,
          email: primaryAdmin.email,
          isActive: primaryAdmin.isActive,
          status: computeAdminStatus(primaryAdmin),
          inviteExpiresAt: primaryAdmin.inviteExpiresAt,
          createdAt: primaryAdmin.createdAt,
        }
      : null,
    adminCount: admins.length,
  };
}

/**
 * GET /api/platform/colleges
 * Lists all registered colleges with live admin status summary.
 * Supports search and status filters.
 */
exports.getColleges = asyncHandler(async (req, res) => {
  const { search, status, adminStatus } = req.query;

  const whereClause = {};

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    whereClause.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { code: { contains: term, mode: 'insensitive' } },
      { slug: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (status === 'active') {
    whereClause.isActive = true;
  } else if (status === 'inactive') {
    whereClause.isActive = false;
  }

  const colleges = await platformPrisma.college.findMany({
    where: whereClause,
    include: {
      users: {
        where: { role: 'COLLEGE_ADMIN' },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          inviteTokenHash: true,
          inviteExpiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  let serialized = colleges.map(serializeCollegeWithAdmin);

  // In-memory filter for computed admin status if requested
  if (adminStatus && typeof adminStatus === 'string' && adminStatus !== 'ALL') {
    const targetStatus = adminStatus.toUpperCase();
    serialized = serialized.filter((col) => {
      if (targetStatus === 'NOT_ASSIGNED') return !col.admin;
      return col.admin && col.admin.status === targetStatus;
    });
  }

  res.status(200).json({
    success: true,
    message: 'Colleges retrieved successfully',
    data: serialized,
  });
});

/**
 * GET /api/platform/colleges/:id
 * Fetches a single college with its complete details and assigned administrators.
 */
exports.getCollegeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const college = await platformPrisma.college.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'COLLEGE_ADMIN' },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          inviteTokenHash: true,
          inviteExpiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!college) {
    throw new AppError('College not found', 404);
  }

  const serialized = serializeCollegeWithAdmin(college);
  // Also include full list of all administrators for future multi-admin support
  serialized.admins = (college.users || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isActive: u.isActive,
    status: computeAdminStatus(u),
    inviteExpiresAt: u.inviteExpiresAt,
    createdAt: u.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: serialized,
  });
});

/**
 * POST /api/platform/colleges
 * Creates a new college.
 * Supports optional administrator creation in a single transaction.
 * If admin creation is omitted, creates ONLY the college with 0 placeholder records.
 */
exports.createCollege = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    officialEmail,
    address,
    city,
    state,
    contactNumber,
    admin,
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('College name is required', 400);
  }

  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new AppError('College code is required', 400);
  }

  const cleanCode = code.trim().toUpperCase();
  const slug = cleanCode.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (!slug) {
    throw new AppError('College code must contain alphanumeric characters', 400);
  }

  // Check for duplicate code or slug
  const existingCollege = await platformPrisma.college.findFirst({
    where: {
      OR: [
        { slug },
        { code: cleanCode },
      ],
    },
  });

  if (existingCollege) {
    throw new AppError(`A college with code '${cleanCode}' or slug '${slug}' already exists`, 409);
  }

  let rawInviteToken = null;
  let adminRecord = null;
  let collegeRecord = null;

  // Validate admin payload if supplied
  if (admin && admin.email) {
    if (!admin.name || typeof admin.name !== 'string' || !admin.name.trim()) {
      throw new AppError('Administrator full name is required when assigning an admin', 400);
    }

    const normalizedAdminEmail = admin.email.toLowerCase().trim();

    // Check if email already exists globally in users table
    const existingUser = await platformPrisma.user.findFirst({
      where: { email: normalizedAdminEmail },
    });

    if (existingUser) {
      throw new AppError(`An account with email '${normalizedAdminEmail}' already exists`, 409);
    }

    rawInviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = hashToken(rawInviteToken);
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Atomic transaction: Create college and administrator together
    const result = await platformPrisma.$transaction(async (tx) => {
      const createdCollege = await tx.college.create({
        data: {
          name: name.trim(),
          slug,
          code: cleanCode,
          officialEmail: officialEmail ? officialEmail.trim().toLowerCase() : null,
          address: address ? address.trim() : null,
          city: city ? city.trim() : null,
          state: state ? state.trim() : null,
          contactNumber: contactNumber ? contactNumber.trim() : null,
          isActive: true,
        },
      });

      const createdAdmin = await tx.user.create({
        data: {
          collegeId: createdCollege.id,
          name: admin.name.trim(),
          email: normalizedAdminEmail,
          passwordHash: null,
          role: 'COLLEGE_ADMIN',
          isActive: false, // Pending activation
          inviteTokenHash,
          inviteExpiresAt,
        },
      });

      return { college: createdCollege, admin: createdAdmin };
    });

    collegeRecord = result.college;
    adminRecord = result.admin;
  } else {
    // Standalone college creation without administrator: zero user records created
    collegeRecord = await platformPrisma.college.create({
      data: {
        name: name.trim(),
        slug,
        code: cleanCode,
        officialEmail: officialEmail ? officialEmail.trim().toLowerCase() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        contactNumber: contactNumber ? contactNumber.trim() : null,
        isActive: true,
      },
    });
  }

  // Dispatch invitation email OUTSIDE database transaction
  let emailSent = false;
  let emailError = null;

  if (adminRecord && rawInviteToken) {
    try {
      await sendCollegeAdminInviteEmail({
        toEmail: adminRecord.email,
        name: adminRecord.name,
        collegeName: collegeRecord.name,
        collegeSlug: collegeRecord.slug,
        inviteToken: rawInviteToken,
      });
      emailSent = true;
    } catch (err) {
      console.error('Brevo invitation email dispatch failed:', err.message);
      emailSent = false;
      emailError = err.message;
    }
  }

  res.status(201).json({
    success: true,
    message: adminRecord
      ? 'College and administrator provisioned successfully'
      : 'College created successfully without an administrator',
    data: {
      college: {
        id: collegeRecord.id,
        name: collegeRecord.name,
        slug: collegeRecord.slug,
        code: collegeRecord.code,
        officialEmail: collegeRecord.officialEmail,
        address: collegeRecord.address,
        city: collegeRecord.city,
        state: collegeRecord.state,
        contactNumber: collegeRecord.contactNumber,
        isActive: collegeRecord.isActive,
        createdAt: collegeRecord.createdAt,
      },
      admin: adminRecord
        ? {
            id: adminRecord.id,
            name: adminRecord.name,
            email: adminRecord.email,
            status: 'PENDING_ACTIVATION',
            inviteExpiresAt: adminRecord.inviteExpiresAt,
            emailSent,
            emailError,
          }
        : null,
    },
  });
});

/**
 * PUT /api/platform/colleges/:id
 * Updates college metadata (name, officialEmail, address, city, state, contactNumber).
 */
exports.updateCollege = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, officialEmail, address, city, state, contactNumber } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('College name is required', 400);
  }

  const existing = await platformPrisma.college.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('College not found', 404);
  }

  const updated = await platformPrisma.college.update({
    where: { id },
    data: {
      name: name.trim(),
      officialEmail: officialEmail !== undefined ? (officialEmail ? officialEmail.trim().toLowerCase() : null) : existing.officialEmail,
      address: address !== undefined ? (address ? address.trim() : null) : existing.address,
      city: city !== undefined ? (city ? city.trim() : null) : existing.city,
      state: state !== undefined ? (state ? state.trim() : null) : existing.state,
      contactNumber: contactNumber !== undefined ? (contactNumber ? contactNumber.trim() : null) : existing.contactNumber,
    },
  });

  res.status(200).json({
    success: true,
    message: 'College details updated successfully',
    data: updated,
  });
});

/**
 * PATCH /api/platform/colleges/:id/status
 * Activates or deactivates a college.
 * Completely independent of College Admin account status.
 */
exports.toggleCollegeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const college = await platformPrisma.college.findUnique({ where: { id } });
  if (!college) {
    throw new AppError('College not found', 404);
  }

  const nextStatus = typeof isActive === 'boolean' ? isActive : !college.isActive;

  const updated = await platformPrisma.college.update({
    where: { id },
    data: { isActive: nextStatus },
  });

  res.status(200).json({
    success: true,
    message: `College ${nextStatus ? 'activated' : 'deactivated'} successfully`,
    data: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      isActive: updated.isActive,
    },
  });
});

/**
 * POST /api/platform/colleges/:id/admins
 * Provisions a new College Admin for an existing college.
 */
exports.provisionCollegeAdmin = asyncHandler(async (req, res) => {
  const { id: collegeId } = req.params;
  const { name, email } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Administrator full name is required', 400);
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new AppError('Administrator email is required', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const college = await platformPrisma.college.findUnique({
    where: { id: collegeId },
    include: {
      users: {
        where: { role: 'COLLEGE_ADMIN' },
      },
    },
  });

  if (!college) {
    throw new AppError('College not found', 404);
  }

  // Check if college already has an active administrator
  const existingActiveAdmin = college.users.find((u) => u.isActive);
  if (existingActiveAdmin) {
    throw new AppError(
      `College already has an active administrator (${existingActiveAdmin.email}). Suspend or modify the existing administrator before reassigning.`,
      400
    );
  }

  // Check if email is already in use
  const existingUser = await platformPrisma.user.findFirst({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new AppError(`An account with email '${normalizedEmail}' already exists`, 409);
  }

  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = hashToken(rawInviteToken);
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const newAdmin = await platformPrisma.user.create({
    data: {
      collegeId: college.id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: null,
      role: 'COLLEGE_ADMIN',
      isActive: false, // Pending activation
      inviteTokenHash,
      inviteExpiresAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      inviteExpiresAt: true,
    },
  });

  // Dispatch Brevo email outside transaction
  let emailSent = false;
  let emailError = null;

  try {
    await sendCollegeAdminInviteEmail({
      toEmail: newAdmin.email,
      name: newAdmin.name,
      collegeName: college.name,
      collegeSlug: college.slug,
      inviteToken: rawInviteToken,
    });
    emailSent = true;
  } catch (err) {
    console.error('Brevo invite email dispatch failed:', err.message);
    emailSent = false;
    emailError = err.message;
  }

  res.status(201).json({
    success: true,
    message: 'College administrator provisioned and invitation dispatched',
    data: {
      admin: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        status: 'PENDING_ACTIVATION',
        inviteExpiresAt: newAdmin.inviteExpiresAt,
        emailSent,
        emailError,
      },
    },
  });
});

/**
 * POST /api/platform/college-admins/:id/resend-invitation
 * Securely invalidates old invitation token and generates a new token and 48h expiration.
 * Handles expired invitations gracefully.
 */
exports.resendCollegeAdminInvitation = asyncHandler(async (req, res) => {
  const { id: adminId } = req.params;

  const admin = await platformPrisma.user.findFirst({
    where: { id: adminId, role: 'COLLEGE_ADMIN' },
    include: { college: true },
  });

  if (!admin) {
    throw new AppError('College administrator account not found', 404);
  }

  if (admin.isActive) {
    throw new AppError('Administrator account is already active. Password has already been set.', 400);
  }

  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = hashToken(rawInviteToken);
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // New 48h window

  const updatedAdmin = await platformPrisma.user.update({
    where: { id: admin.id },
    data: {
      inviteTokenHash,
      inviteExpiresAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      inviteExpiresAt: true,
    },
  });

  let emailSent = false;
  let emailError = null;

  try {
    await sendCollegeAdminInviteEmail({
      toEmail: updatedAdmin.email,
      name: updatedAdmin.name,
      collegeName: admin.college ? admin.college.name : 'Your Institution',
      collegeSlug: admin.college ? admin.college.slug : '',
      inviteToken: rawInviteToken,
    });
    emailSent = true;
  } catch (err) {
    console.error('Brevo resend invite dispatch failed:', err.message);
    emailSent = false;
    emailError = err.message;
  }

  res.status(200).json({
    success: true,
    message: 'Invitation email resent successfully with refreshed 48-hour expiration',
    data: {
      admin: {
        id: updatedAdmin.id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        status: 'PENDING_ACTIVATION',
        inviteExpiresAt: updatedAdmin.inviteExpiresAt,
        emailSent,
        emailError,
      },
    },
  });
});

/**
 * PATCH /api/platform/college-admins/:id/status
 * Suspends or reactivates a College Administrator account.
 * Completely independent of college status.
 */
exports.toggleCollegeAdminStatus = asyncHandler(async (req, res) => {
  const { id: adminId } = req.params;
  const { isActive } = req.body;

  const admin = await platformPrisma.user.findFirst({
    where: { id: adminId, role: 'COLLEGE_ADMIN' },
  });

  if (!admin) {
    throw new AppError('College administrator not found', 404);
  }

  // If account has not set password yet (pending invite), it cannot be set to active directly
  if (!admin.isActive && admin.inviteTokenHash && isActive === true) {
    throw new AppError(
      'Cannot directly activate an account with a pending invitation. The administrator must set their password via the invitation link.',
      400
    );
  }

  const nextStatus = typeof isActive === 'boolean' ? isActive : !admin.isActive;

  const updated = await platformPrisma.user.update({
    where: { id: admin.id },
    data: {
      isActive: nextStatus,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      inviteTokenHash: true,
      inviteExpiresAt: true,
    },
  });

  const computedStatus = computeAdminStatus(updated);

  res.status(200).json({
    success: true,
    message: `College administrator account ${nextStatus ? 'reactivated' : 'suspended'} successfully`,
    data: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      isActive: updated.isActive,
      status: computedStatus,
    },
  });
});
