const { AppError } = require('./errorHandler');

const PROD_ORIGIN_REGEX = /^https:\/\/([a-z0-9-]+\.)?4thepeople\.in$/i;
const DEV_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Validates whether an incoming HTTP Origin is an authorized origin for the application.
 *
 * @param {string} origin - Incoming Origin header value
 * @returns {boolean} True if origin is allowed
 */
function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;

  const isProduction = process.env.NODE_ENV === 'production';

  // In production, strictly match *.4thepeople.in or 4thepeople.in over HTTPS
  if (PROD_ORIGIN_REGEX.test(origin)) {
    return true;
  }

  // In non-production environments, additionally permit local development origins
  if (!isProduction) {
    if (DEV_ORIGIN_REGEX.test(origin)) {
      return true;
    }
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return true;
    }
  }

  return false;
}

/**
 * Parses origin from a Referer URL if Origin header is absent.
 */
function extractOriginFromReferer(referer) {
  if (!referer || typeof referer !== 'string') return null;
  try {
    const parsed = new URL(referer);
    return parsed.origin;
  } catch (err) {
    return null;
  }
}

/**
 * Origin and Referer validation middleware for state-changing HTTP methods
 * (POST, PUT, PATCH, DELETE).
 *
 * SameSite cookies do NOT protect sibling subdomains because all *.4thepeople.in
 * subdomains share the same registrable domain ('4thepeople.in').
 * This middleware verifies that cross-origin or cross-subdomain state-changing
 * requests originate from the EXACT expected origin matching the target host.
 */
function validateOriginOrReferer(req, res, next) {
  const method = req.method.toUpperCase();

  // Safe HTTP methods do not mutate state
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const rawOrigin = req.headers['origin'];
  const rawReferer = req.headers['referer'];
  const requestOrigin = rawOrigin || extractOriginFromReferer(rawReferer);

  // Check if request is authenticated via HttpOnly cookies
  const hasCookieAuth = Boolean(
    req.cookies && (req.cookies.yuva_token || req.cookies.yuva_platform_token || req.cookies.token)
  );

  // Crucial security invariant: Reject cookie-authenticated non-GET requests with neither Origin nor Referer
  if (hasCookieAuth && !requestOrigin) {
    return next(new AppError('Cross-site request blocked: Cookie-authenticated state-changing requests must include Origin or Referer header', 403));
  }

  // If no Origin or Referer header was supplied on non-cookie requests:
  // In test environment, permit server-to-server tests (unless explicit Origin testing)
  if (!requestOrigin) {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    // In production, require an Origin or Referer for state-changing browser requests
    return next(new AppError('Origin or Referer header required for state-changing requests', 403));
  }

  // 1. First, origin must be within the overall allowed application origins
  if (!isAllowedOrigin(requestOrigin)) {
    return next(new AppError(`Cross-origin request blocked: '${requestOrigin}' is not an authorized origin`, 403));
  }

  // 2. Next, tenant-specific origin isolation:
  // Requests targeting a specific college tenant must originate from that exact college's origin
  // Requests targeting the platform administration host must originate from the platform admin origin
  try {
    const originHost = new URL(requestOrigin).hostname.toLowerCase();
    const reqHost = (req.hostname || (req.headers['host'] || '').split(':')[0]).toLowerCase();

    // Check platform origin isolation
    if (req.isPlatform) {
      if (originHost !== 'admin.4thepeople.in' && originHost !== 'admin.localhost') {
        return next(new AppError('Cross-tenant request blocked: Platform administration requests must originate from admin domain', 403));
      }
    }

    // Check college tenant origin isolation
    if (req.college && req.college.slug) {
      const expectedSlug = req.college.slug.toLowerCase();
      const originSlug = originHost.split('.')[0];

      // Origin must be the exact college subdomain (e.g. lbrce.4thepeople.in or lbrce.localhost)
      if (originSlug !== expectedSlug) {
        return next(new AppError(`Cross-tenant request blocked: Origin '${originHost}' cannot access tenant '${expectedSlug}'`, 403));
      }
    }
  } catch (err) {
    return next(new AppError('Malformed Origin or Referer header', 400));
  }

  next();
}

/**
 * Dynamic CORS options delegate.
 */
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');

  // Allow requests without Origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  if (isAllowedOrigin(origin)) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-Host'],
    });
  }

  return callback(new AppError(`Origin '${origin}' not allowed by CORS policy`, 403));
};

module.exports = {
  isAllowedOrigin,
  validateOriginOrReferer,
  corsOptionsDelegate,
};

