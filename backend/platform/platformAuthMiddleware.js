const jwt = require('jsonwebtoken');
const { AppError } = require('../middleware/errorHandler');

const getEffectivePlatformSecret = () => {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PLATFORM_JWT_SECRET configuration missing in production');
    }
    return 'dev_platform_super_admin_jwt_secret_fallback_key';
  }
  return secret;
};

/**
 * Middleware that authenticates privileged platform administrators.
 * Enforces:
 * 1. Token must be signed with PLATFORM_JWT_SECRET (different key from college JWT).
 * 2. Token type must be strictly 'platform'.
 * 3. College tokens are rejected.
 */
const authenticatePlatformToken = (req, res, next) => {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.yuva_platform_token) {
    token = req.cookies.yuva_platform_token;
  }

  if (!token) {
    return next(new AppError('Platform authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, getEffectivePlatformSecret());

    if (decoded.type !== 'platform' || !decoded.platformAdminId) {
      return next(new AppError('Access denied: College tokens cannot authenticate platform routes', 403));
    }

    req.platformAdmin = {
      id: decoded.platformAdminId,
      platformAdminId: decoded.platformAdminId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return next(new AppError('Invalid or expired platform authentication token', 401));
  }
};

module.exports = {
  authenticatePlatformToken,
};
