const express = require('express');
const router = express.Router();
const { authenticateToken, requireClubManager } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { withTenant } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { clubParams } = require('../validators/schemas');

/**
 * Example Club Manager Protected Route
 * GET /club/:clubId/dashboard
 */
router.get(
  '/:clubId/dashboard',
  validate({ params: clubParams }),
  authenticateToken,
  requireClubManager('clubId'),
  asyncHandler(async (req, res) => {
    if (!req.collegeId) {
      throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
    }
    const { clubId } = req.params;
    const club = await withTenant(req.collegeId, async (tx) => {
      return await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
        },
      });
    });

    if (!club) {
      throw new AppError('Club not found', 404);
    }

    res.status(200).json({
      success: true,
      message: `Club manager dashboard access granted for club ${clubId}`,
      data: club,
    });
  })
);

module.exports = router;
