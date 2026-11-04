const { withTenant } = require('../config/db');
const { clubDepartmentsSelect, serializeClub } = require('../utils/clubDepartments');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Public fields exposed to unauthenticated visitors.
 * Internal fields (created_by_user_id, legacy_mongo_id) are omitted.
 */
const publicClubSelect = {
  id: true,
  collegeId: true,
  name: true,
  description: true,
  clubType: true,
  logoUrl: true,
  logoPublicId: true,
  coverImageUrl: true,
  coverImagePublicId: true,
  createdAt: true,
  updatedAt: true,
  departments: clubDepartmentsSelect,
};

/**
 * GET /clubs
 * Returns the public directory of clubs for the resolved college tenant.
 */
exports.listPublicClubs = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const clubs = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findMany({
      where: { collegeId: req.collegeId },
      select: publicClubSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  });

  const responseClubs = clubs.map(serializeClub);

  res.status(200).json({
    success: true,
    clubs: responseClubs,
  });
});

/**
 * GET /clubs/:clubId
 * Returns public information for one club within the resolved college tenant.
 */
exports.getPublicClub = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;

  if (!UUID_REGEX.test(clubId)) {
    throw new AppError('Invalid club ID', 400);
  }

  const club = await withTenant(req.collegeId, async (tx) => {
    return await tx.club.findFirst({
      where: {
        id: clubId,
        collegeId: req.collegeId,
      },
      select: publicClubSelect,
    });
  });

  if (!club) {
    throw new AppError('Club not found', 404);
  }

  res.status(200).json({
    success: true,
    club: serializeClub(club),
  });
});
