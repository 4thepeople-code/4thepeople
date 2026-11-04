const jwt = require('jsonwebtoken');
const { withTenant } = require('../config/db');
const { AppError } = require('./errorHandler');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extracts and verifies JWT token for college users.
 * Enforces:
 * 1. Cryptographic signature against JWT_SECRET.
 * 2. Token type must be 'college' (platform tokens rejected).
 * 3. Tenant cross-boundary check: decoded.collegeId MUST match req.collegeId.
 * 4. Fresh user re-load under withTenant on every request:
 *    - Rejects if user row is deleted.
 *    - Rejects if account isActive is false.
 *    - Rejects if user's role has changed since token issuance.
 */
const authenticateToken = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && (req.cookies.yuva_token || req.cookies.token)) {
    token = req.cookies.yuva_token || req.cookies.token;
  }

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    return next(new Error('JWT_SECRET configuration missing in production'));
  }
  const effectiveSecret = jwtSecret || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';

  try {
    const decoded = jwt.verify(token, effectiveSecret);

    // Reject platform admin tokens on college routes
    if (decoded.type === 'platform' || decoded.platformAdminId) {
      return next(new AppError('Access denied: Platform token cannot authenticate college routes', 403));
    }

    // Tenant boundary check: if request is on a college subdomain, enforce token matches collegeId
    if (req.collegeId && decoded.collegeId && decoded.collegeId !== req.collegeId) {
      return next(new AppError('Access denied: Token belongs to a different college tenant', 403));
    }

    const tenantId = req.collegeId || decoded.collegeId;
    const userId = decoded.userId || decoded.id;

    if (!tenantId || !userId) {
      return next(new AppError('Invalid token claims: Missing tenant or user identity', 401));
    }

    // Re-load user inside withTenant under PostgreSQL RLS on every request
    const freshUser = await withTenant(tenantId, async (tx) => {
      return await tx.user.findFirst({
        where: {
          id: userId,
          collegeId: tenantId,
        },
        select: {
          id: true,
          collegeId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
    });

    if (!freshUser) {
      return next(new AppError('User account not found', 401));
    }

    if (!freshUser.isActive) {
      return next(new AppError('Account is inactive. Please contact system administrator.', 403));
    }

    if (freshUser.role !== decoded.role) {
      return next(new AppError('User role has changed. Please log in again.', 401));
    }

    req.user = {
      ...decoded,
      id: freshUser.id,
      userId: freshUser.id,
      collegeId: freshUser.collegeId,
      name: freshUser.name,
      email: freshUser.email,
      role: freshUser.role,
      isActive: freshUser.isActive,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired', 401));
    }
    return next(new AppError('Invalid authentication token', 401));
  }
};

/**
 * Middleware requiring the user to have role COLLEGE_ADMIN (or legacy ADMIN).
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return authenticateToken(req, res, (err) => {
      if (err) return next(err);
      checkAdminRole(req, res, next);
    });
  }
  checkAdminRole(req, res, next);
};

const checkAdminRole = (req, res, next) => {
  if (req.user.role !== 'COLLEGE_ADMIN' && req.user.role !== 'ADMIN') {
    return next(new AppError('Access denied: User is not an admin', 403));
  }
  next();
};

/**
 * Middleware requiring the authenticated user to be a MANAGER of the specified club.
 * Extracts clubId from req.params.clubId (or req.params.id).
 * Queries under withTenant using PostgreSQL RLS.
 */
const requireClubManager = (paramName = 'clubId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return authenticateToken(req, res, async (err) => {
        if (err) return next(err);
        await checkClubManagerMembership(req, res, next, paramName);
      });
    }
    await checkClubManagerMembership(req, res, next, paramName);
  };
};

const checkClubManagerMembership = async (req, res, next, paramName) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const clubId = req.params[paramName] || req.params.clubId || req.params.id;
  if (!clubId) {
    return next(new AppError(`Club ID parameter '${paramName}' missing in route`, 400));
  }

  // Verify UUID format for PostgreSQL primary key
  if (!UUID_REGEX.test(clubId)) {
    return next(new AppError('Invalid club ID (must be a valid UUID)', 400));
  }

  const tenantId = req.collegeId || req.user.collegeId;
  if (!tenantId) {
    return next(new AppError('Tenant context required for club verification', 400));
  }

  try {
    await withTenant(tenantId, async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true },
      });

        if (!club) {
          throw new AppError('Club not found', 404);
        }

        const userId = req.user.userId || req.user.id;
        const membership = await tx.membership.findFirst({
          where: {
            userId: userId,
            clubId: clubId,
            role: 'MANAGER',
          },
        });

        if (!membership) {
          throw new AppError('Access denied: You do not have manager permissions for this club', 403);
        }
      });

      next();
    } catch (error) {
      next(error);
    }
};

const requireAdminOrClubManager = (paramName = 'clubId') => {
  return (req, res, next) => {
    if (!req.user) {
      return authenticateToken(req, res, (err) => {
        if (err) return next(err);
        checkAdminOrClubManager(req, res, next, paramName);
      });
    }
    checkAdminOrClubManager(req, res, next, paramName);
  };
};

const checkAdminOrClubManager = (req, res, next, paramName) => {
  if (req.user.role === 'COLLEGE_ADMIN' || req.user.role === 'ADMIN') return next();
  requireClubManager(paramName)(req, res, next);
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireCollegeAdmin: requireAdmin,
  requireClubManager,
  requireAdminOrClubManager,
};
