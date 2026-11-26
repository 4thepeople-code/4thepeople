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
    const tokenCollegeId = decoded.collegeId || decoded.hostCollegeId;
    if (req.collegeId && tokenCollegeId && tokenCollegeId !== req.collegeId) {
      return next(new AppError('Access denied: Token belongs to a different college tenant', 403));
    }

    const tenantId = req.collegeId || tokenCollegeId;
    const userId = decoded.userId || decoded.id;

    if (!tenantId || !userId) {
      return next(new AppError('Invalid token claims: Missing tenant or user identity', 401));
    }

    // Handle EXTERNAL participant token
    if (decoded.type === 'external' || decoded.role === 'EXTERNAL') {
      const freshParticipant = await withTenant(tenantId, async (tx) => {
        return await tx.externalParticipant.findFirst({
          where: {
            id: userId,
            collegeId: tenantId,
          },
          select: {
            id: true,
            collegeId: true,
            name: true,
            email: true,
            phone: true,
            institutionName: true,
            rollNumber: true,
            department: true,
            gender: true,
            yearOfStudy: true,
            isEmailVerified: true,
            college: { select: { id: true, name: true, slug: true } },
          },
        });
      });

      if (!freshParticipant) {
        return next(new AppError('External participant account not found', 401));
      }

      req.user = {
        ...decoded,
        ...freshParticipant,
        id: freshParticipant.id,
        userId: freshParticipant.id,
        collegeId: freshParticipant.collegeId,
        name: freshParticipant.name,
        email: freshParticipant.email,
        phone: freshParticipant.phone,
        institutionName: freshParticipant.institutionName,
        collegeName: freshParticipant.institutionName,
        rollNumber: freshParticipant.rollNumber,
        department: freshParticipant.department,
        gender: freshParticipant.gender,
        yearOfStudy: freshParticipant.yearOfStudy,
        role: 'EXTERNAL',
        isActive: true,
      };

      return next();
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
          rollNumber: true,
          phone: true,
          gender: true,
          yearOfStudy: true,
          section: true,
          departmentId: true,
          department: { select: { id: true, name: true, shortCode: true } },
          college: { select: { id: true, name: true, slug: true } },
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
      ...freshUser,
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

/**
 * crossCollegeRegisterMiddleware
 *
 * A relaxed authentication middleware used exclusively on cross-college student
 * registration endpoints. Unlike authenticateToken, it accepts JWTs where
 * decoded.collegeId !== req.collegeId (cross-college scenario).
 *
 * It still:
 *   1. Verifies JWT signature and type.
 *   2. Re-loads the student's user record from their home college using
 *      withTenant(decoded.collegeId), ensuring RLS is enforced.
 *   3. Validates the user is active and role is unchanged.
 *
 * Sets req.user (with college.name from home college), req.homeCollegeId,
 * and req.isCrossCollege.
 *
 * NEVER use this middleware on admin, manager, or other privileged endpoints.
 */
const crossCollegeRegisterMiddleware = async (req, res, next) => {
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

    // Reject platform tokens and external tokens — only college student tokens allowed
    if (decoded.type === 'platform' || decoded.platformAdminId) {
      return next(new AppError('Access denied: Platform token cannot authenticate this route', 403));
    }
    if (decoded.type === 'external') {
      return next(new AppError('Access denied: External verification token cannot authenticate this route', 403));
    }
    if (decoded.type !== 'college') {
      return next(new AppError('Access denied: Invalid token type for this route', 403));
    }

    const homeCollegeId = decoded.collegeId;
    const userId = decoded.userId || decoded.id;

    if (!homeCollegeId || !userId) {
      return next(new AppError('Invalid token claims: Missing tenant or user identity', 401));
    }

    // Re-load student from their HOME college under RLS.
    // This is intentionally a separate transaction from any subsequent write.
    const freshUser = await withTenant(homeCollegeId, async (tx) => {
      return tx.user.findFirst({
        where: { id: userId, collegeId: homeCollegeId },
        select: {
          id: true,
          collegeId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          rollNumber: true,
          phone: true,
          gender: true,
          yearOfStudy: true,
          section: true,
          departmentId: true,
          department: { select: { id: true, name: true, shortCode: true } },
          college: { select: { name: true } },
        },
      });
    });

    if (!freshUser) {
      return next(new AppError('User account not found', 401));
    }
    if (!freshUser.isActive) {
      return next(new AppError('Account is inactive. Please contact your college administrator.', 403));
    }
    if (freshUser.role !== decoded.role) {
      return next(new AppError('User role has changed. Please log in again.', 401));
    }

    req.user = {
      ...decoded,
      ...freshUser,
      id: freshUser.id,
      userId: freshUser.id,
      collegeId: freshUser.collegeId,
      name: freshUser.name,
      email: freshUser.email,
      role: freshUser.role,
      isActive: freshUser.isActive,
      rollNumber: freshUser.rollNumber || null,
      college: freshUser.college || null,
    };
    req.homeCollegeId = homeCollegeId;
    req.isCrossCollege = req.collegeId ? (homeCollegeId !== req.collegeId) : false;

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
 * authenticateExternalToken
 *
 * Verifies an external participant JWT (type: 'external') issued after OTP verification.
 * Rejects college and platform tokens.
 * Enforces that the token's hostCollegeId matches the current req.collegeId to prevent
 * cross-college token replay.
 *
 * Sets req.externalUser = { email, hostCollegeId } on success.
 * Does NOT set req.user.
 */
const authenticateExternalToken = (req, res, next) => {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && (req.cookies.token || req.cookies.yuva_token)) {
    token = req.cookies.token || req.cookies.yuva_token;
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

    // Reject non-external tokens
    if (decoded.type !== 'external') {
      return next(new AppError('Access denied: This endpoint requires an external verification token', 403));
    }

    // Require OTP verification to have completed
    if (!decoded.isEmailVerified) {
      return next(new AppError('Access denied: Email verification is required', 403));
    }

    // Enforce college context binding: token must have been issued for this exact college
    if (req.collegeId && decoded.hostCollegeId && decoded.hostCollegeId !== req.collegeId) {
      return next(new AppError('Access denied: Token issued for a different college', 403));
    }

    req.externalUser = {
      email: decoded.email,
      hostCollegeId: decoded.hostCollegeId || req.collegeId,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Verification token has expired. Please request a new code.', 401));
    }
    return next(new AppError('Invalid verification token', 401));
  }
};

/**
 * authenticateAnyParticipant
 *
 * Authenticates either a student user (including cross-college students)
 * or an external participant (via external verification JWT).
 *
 * Sets req.user (for students) OR req.externalUser (for external participants).
 */
const authenticateAnyParticipant = async (req, res, next) => {
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

    if (decoded.type === 'external') {
      if (!decoded.email) {
        return next(new AppError('Malformed external verification token', 401));
      }
      if (req.collegeId && decoded.hostCollegeId && decoded.hostCollegeId !== req.collegeId) {
        return next(new AppError('Access denied: Token issued for a different college', 403));
      }
      const effectiveHostId = decoded.hostCollegeId || req.collegeId;
      req.externalUser = {
        email: decoded.email,
        hostCollegeId: effectiveHostId,
      };

      if (effectiveHostId) {
        try {
          const extRecord = await withTenant(effectiveHostId, async (tx) => {
            return tx.externalParticipant.findFirst({
              where: { collegeId: effectiveHostId, email: decoded.email },
            });
          });
          if (extRecord) {
            req.externalUser = {
              ...req.externalUser,
              id: extRecord.id,
              name: extRecord.name,
              phone: extRecord.phone,
              institutionName: extRecord.institutionName,
              rollNumber: extRecord.rollNumber,
              department: extRecord.department,
              gender: extRecord.gender,
              yearOfStudy: extRecord.yearOfStudy,
            };
          }
        } catch (_) {}
      }
      return next();
    }

    // Student or Manager token
    const tokenCollegeId = decoded.collegeId;
    if (!tokenCollegeId || !decoded.userId) {
      return next(new AppError('Invalid token payload', 401));
    }

    const user = await withTenant(tokenCollegeId, async (tx) => {
      return tx.user.findFirst({
        where: { id: decoded.userId, collegeId: tokenCollegeId },
        select: {
          id: true,
          collegeId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          rollNumber: true,
          phone: true,
          gender: true,
          yearOfStudy: true,
          section: true,
          departmentId: true,
          department: { select: { id: true, name: true, shortCode: true } },
          college: { select: { name: true } },
        },
      });
    });

    if (!user || !user.isActive) {
      return next(new AppError('User not found or account is deactivated', 401));
    }

    req.user = user;
    req.homeCollegeId = tokenCollegeId;
    req.isCrossCollege = req.collegeId ? (tokenCollegeId !== req.collegeId) : false;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401));
    }
    return next(new AppError('Invalid token', 401));
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireCollegeAdmin: requireAdmin,
  requireClubManager,
  requireAdminOrClubManager,
  crossCollegeRegisterMiddleware,
  authenticateExternalToken,
  authenticateAnyParticipant,
};
