const { prisma } = require('../config/db');
const { DEFAULT_COLLEGE_ID } = require('../config/college');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

const departmentWhere = (departmentId) => ({
  id: departmentId,
  collegeId: DEFAULT_COLLEGE_ID,
});

const throwDuplicateDepartmentError = (error) => {
  if (error.code === 'P2002') {
    throw new AppError('A department with this name or short code already exists for this college.', 409);
  }
  throw error;
};

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, shortCode, description } = req.body;

  let department;
  try {
    department = await prisma.department.create({
      data: {
        name: name.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        description: description ?? null,
        collegeId: DEFAULT_COLLEGE_ID,
      },
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

exports.updateDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { name, shortCode, description } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (shortCode !== undefined) data.shortCode = shortCode.trim().toUpperCase();
  if (description !== undefined) data.description = description ? description.trim() : null;

  let department;
  try {
    department = await prisma.$transaction(async (tx) => {
      const existing = await tx.department.findFirst({
        where: departmentWhere(departmentId),
        select: { id: true },
      });
      if (!existing) throw new AppError('Department not found', 404);

      return tx.department.update({
        where: departmentWhere(departmentId),
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

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;

  await prisma.$transaction(async (tx) => {
    const department = await tx.department.findFirst({
      where: departmentWhere(departmentId),
      select: { id: true },
    });
    if (!department) throw new AppError('Department not found', 404);

    await tx.clubDepartment.deleteMany({
      where: {
        departmentId,
        department: { collegeId: DEFAULT_COLLEGE_ID },
      },
    });
    await tx.department.delete({ where: departmentWhere(departmentId) });
  });

  res.status(200).json({
    success: true,
    message: 'Department deleted successfully',
    data: { departmentId },
  });
});

exports.replaceDepartmentClubs = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { clubIds } = req.body;

  await prisma.$transaction(async (tx) => {
    const department = await tx.department.findFirst({
      where: departmentWhere(departmentId),
      select: { id: true },
    });
    if (!department) throw new AppError('Department not found', 404);

    const clubs = clubIds.length
      ? await tx.club.findMany({
        where: {
          id: { in: clubIds },
          collegeId: DEFAULT_COLLEGE_ID,
        },
        select: { id: true, isCentral: true },
      })
      : [];
    if (clubs.length !== clubIds.length) {
      throw new AppError('One or more clubs do not exist for this college.', 400);
    }
    if (clubs.some((club) => club.isCentral === true)) {
      throw new AppError('Central clubs cannot be linked to a department.', 409);
    }

    await tx.clubDepartment.deleteMany({
      where: {
        departmentId,
        department: { collegeId: DEFAULT_COLLEGE_ID },
      },
    });
    for (const club of clubs) {
      await tx.clubDepartment.create({
        data: { departmentId, clubId: club.id },
      });
    }
  });

  res.status(200).json({
    success: true,
    message: 'Department clubs replaced successfully',
    data: { departmentId, clubIds },
  });
});

exports.replaceClubDepartments = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { departmentIds } = req.body;

  await prisma.$transaction(async (tx) => {
    const club = await tx.club.findFirst({
      where: { id: clubId, collegeId: DEFAULT_COLLEGE_ID },
      select: { id: true, isCentral: true },
    });
    if (!club) throw new AppError('Club not found', 404);
    if (club.isCentral === true && departmentIds.length > 0) {
      throw new AppError('Central clubs cannot be linked to a department.', 409);
    }

    const departments = departmentIds.length
      ? await tx.department.findMany({
        where: {
          id: { in: departmentIds },
          collegeId: DEFAULT_COLLEGE_ID,
        },
        select: { id: true },
      })
      : [];
    if (departments.length !== departmentIds.length) {
      throw new AppError('One or more departments do not exist for this college.', 400);
    }

    await tx.clubDepartment.deleteMany({
      where: {
        clubId,
        department: { collegeId: DEFAULT_COLLEGE_ID },
      },
    });
    for (const department of departments) {
      await tx.clubDepartment.create({
        data: { clubId, departmentId: department.id },
      });
    }
  });

  res.status(200).json({
    success: true,
    message: 'Club departments replaced successfully',
    data: { clubId, departmentIds },
  });
});

exports.listDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    where: { collegeId: DEFAULT_COLLEGE_ID },
    include: {
      clubs: {
        where: { club: { isCentral: false } },
        select: { clubId: true },
      },
    },
    orderBy: { name: 'asc' },
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

exports.getDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const department = await prisma.department.findFirst({
    where: departmentWhere(departmentId),
    include: {
      clubs: {
        where: { club: { isCentral: false } },
        select: {
          club: {
            select: {
              id: true,
              name: true,
              description: true,
              logo: true,
              coverImage: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!department) throw new AppError('Department not found', 404);

  res.status(200).json({
    success: true,
    message: 'Department retrieved successfully',
    data: {
      department: {
        ...department,
        clubs: department.clubs.map(({ club }) => club),
      },
    },
  });
});
