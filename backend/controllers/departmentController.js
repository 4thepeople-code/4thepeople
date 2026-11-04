const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { serializeClub } = require('../utils/clubDepartments');

const throwDuplicateDepartmentError = (error) => {
  if (error.code === 'P2002') {
    throw new AppError('A department with this name or short code already exists for this college.', 409);
  }
  throw error;
};

/**
 * POST /admin/departments
 * Admin creates a new academic department within their college tenant.
 */
exports.createDepartment = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { name, shortCode, description } = req.body;

  let department;
  try {
    department = await withTenant(req.collegeId, async (tx) => {
      return await tx.department.create({
        data: {
          collegeId: req.collegeId,
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          description: description ? description.trim() : null,
        },
      });
    });
  } catch (error) {
    throwDuplicateDepartmentError(error);
  }

  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: { department },
  });
});

/**
 * PATCH /admin/departments/:departmentId
 * Admin updates department details within their college tenant.
 */
exports.updateDepartment = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { departmentId } = req.params;
  const { name, shortCode, description } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (shortCode !== undefined) data.shortCode = shortCode.trim().toUpperCase();
  if (description !== undefined) data.description = description ? description.trim() : null;

  let department;
  try {
    department = await withTenant(req.collegeId, async (tx) => {
      const existing = await tx.department.findFirst({
        where: { id: departmentId, collegeId: req.collegeId },
        select: { id: true },
      });
      if (!existing) throw new AppError('Department not found', 404);

      return await tx.department.update({
        where: { id: departmentId },
        data,
      });
    });
  } catch (error) {
    throwDuplicateDepartmentError(error);
  }

  res.status(200).json({
    success: true,
    message: 'Department updated successfully',
    data: { department },
  });
});

/**
 * DELETE /admin/departments/:departmentId
 * Deletes a department and removes its club relationships within the tenant.
 */
exports.deleteDepartment = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { departmentId } = req.params;

  await withTenant(req.collegeId, async (tx) => {
    const department = await tx.department.findFirst({
      where: { id: departmentId, collegeId: req.collegeId },
      select: { id: true },
    });
    if (!department) throw new AppError('Department not found', 404);

    await tx.clubDepartment.deleteMany({
      where: {
        departmentId,
        collegeId: req.collegeId,
      },
    });
    await tx.department.delete({ where: { id: departmentId } });
  });

  res.status(200).json({
    success: true,
    message: 'Department deleted successfully',
    data: { departmentId },
  });
});

/**
 * PUT /admin/departments/:departmentId/clubs
 * Replaces the list of clubs associated with a department.
 */
exports.replaceDepartmentClubs = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { departmentId } = req.params;
  const { clubIds } = req.body;

  try {
    await withTenant(req.collegeId, async (tx) => {
      const department = await tx.department.findFirst({
        where: { id: departmentId, collegeId: req.collegeId },
        select: { id: true },
      });
      if (!department) throw new AppError('Department not found', 404);

      const clubs = clubIds && clubIds.length
        ? await tx.club.findMany({
          where: {
            id: { in: clubIds },
            collegeId: req.collegeId,
          },
          select: { id: true, clubType: true },
        })
        : [];

      if (clubs.length !== (clubIds ? clubIds.length : 0)) {
        throw new AppError('One or more clubs do not exist for this college.', 400);
      }
      if (clubs.some((club) => club.clubType === 'CENTRAL')) {
        throw new AppError('Central clubs cannot be linked to a department.', 409);
      }

      await tx.clubDepartment.deleteMany({
        where: {
          departmentId,
          collegeId: req.collegeId,
        },
      });

      for (const club of clubs) {
        await tx.clubDepartment.create({
          data: {
            collegeId: req.collegeId,
            departmentId,
            clubId: club.id,
          },
        });
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('check_violation')) {
      throw new AppError('Central clubs cannot be linked to a department.', 409);
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    message: 'Department clubs replaced successfully',
    data: { departmentId, clubIds },
  });
});

/**
 * PUT /admin/clubs/:clubId/departments
 * Replaces the list of departments associated with a club.
 */
exports.replaceClubDepartments = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  const { departmentIds } = req.body;

  try {
    await withTenant(req.collegeId, async (tx) => {
      const club = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
        select: { id: true, clubType: true },
      });
      if (!club) throw new AppError('Club not found', 404);
      if (club.clubType === 'CENTRAL' && departmentIds && departmentIds.length > 0) {
        throw new AppError('Central clubs cannot be linked to a department.', 409);
      }

      const departments = departmentIds && departmentIds.length
        ? await tx.department.findMany({
          where: {
            id: { in: departmentIds },
            collegeId: req.collegeId,
          },
          select: { id: true },
        })
        : [];

      if (departments.length !== (departmentIds ? departmentIds.length : 0)) {
        throw new AppError('One or more departments do not exist for this college.', 400);
      }

      await tx.clubDepartment.deleteMany({
        where: {
          clubId,
          collegeId: req.collegeId,
        },
      });

      for (const department of departments) {
        await tx.clubDepartment.create({
          data: {
            collegeId: req.collegeId,
            clubId,
            departmentId: department.id,
          },
        });
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('check_violation')) {
      throw new AppError('Central clubs cannot be linked to a department.', 409);
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    message: 'Club departments replaced successfully',
    data: { clubId, departmentIds },
  });
});

/**
 * GET /departments
 * Lists departments for the current college with pagination.
 */
exports.listDepartments = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const departments = await withTenant(req.collegeId, async (tx) => {
    return await tx.department.findMany({
      where: { collegeId: req.collegeId },
      include: {
        clubs: {
          where: { club: { clubType: { not: 'CENTRAL' } } },
          select: { clubId: true },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip,
    });
  });

  res.status(200).json({
    success: true,
    message: 'Departments retrieved successfully',
    data: {
      departments: departments.map(({ clubs, ...department }) => ({
        ...department,
        clubCount: clubs.length,
      })),
    },
  });
});

/**
 * GET /departments/:departmentId
 * Retrieves a single department and its associated clubs.
 */
exports.getDepartment = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { departmentId } = req.params;

  const department = await withTenant(req.collegeId, async (tx) => {
    return await tx.department.findFirst({
      where: { id: departmentId, collegeId: req.collegeId },
      include: {
        clubs: {
          where: { club: { clubType: { not: 'CENTRAL' } } },
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
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  });

  if (!department) throw new AppError('Department not found', 404);

  res.status(200).json({
    success: true,
    message: 'Department retrieved successfully',
    data: {
      department: {
        ...department,
        clubs: department.clubs.map(({ club }) => serializeClub(club)),
      },
    },
  });
});
