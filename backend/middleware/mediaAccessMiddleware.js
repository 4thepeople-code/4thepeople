const { withTenant } = require('../config/db');
const { authenticateToken } = require('./authMiddleware');
const { AppError } = require('./errorHandler');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const checkAdminOrEventManager = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (req.user.role === 'COLLEGE_ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return next();
  }

  if (!req.collegeId) {
    return next(new AppError('Tenant context required: request must be routed through a college subdomain', 400));
  }

  const { eventId } = req.params;
  if (!eventId || !UUID_REGEX.test(eventId)) {
    return next(new AppError('Invalid event ID (must be a valid UUID)', 400));
  }

  try {
    const userId = req.user.id || req.user.userId;
    const isAuthorized = await withTenant(req.collegeId, async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, collegeId: req.collegeId },
        select: { clubId: true },
      });
      if (!event) {
        throw new AppError('Event not found', 404);
      }

      const membership = await tx.membership.findFirst({
        where: {
          collegeId: req.collegeId,
          userId,
          clubId: event.clubId,
          role: 'MANAGER',
        },
      });

      return !!membership;
    });

    if (!isAuthorized) {
      return next(new AppError("Access denied: You do not manage this event's club", 403));
    }
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdminOrEventManager = (req, res, next) => {
  if (!req.user) {
    return authenticateToken(req, res, (err) => {
      if (err) return next(err);
      checkAdminOrEventManager(req, res, next);
    });
  }
  checkAdminOrEventManager(req, res, next);
};

module.exports = { requireAdminOrEventManager };
