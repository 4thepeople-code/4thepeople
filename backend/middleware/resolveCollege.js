const { getCollegeBySlug, isSlugCached } = require('../config/collegeResolver');

const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'mail',
  'app',
  'static',
  'assets',
  'public',
  'auth',
]);

// In-memory per-IP rate limiter for un-cached DB tenant resolution lookups
// IP -> { count: number, resetAt: number }
const ipLookupTracker = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60s sliding window
const MAX_DB_LOOKUPS_PER_WINDOW = 30; // Max 30 un-cached DB lookups per IP per minute

/**
 * Extracts client IP from request. Honors X-Forwarded-For ONLY when Express
 * 'trust proxy' is explicitly enabled.
 */
function getClientIp(req) {
  const isProxyTrusted = Boolean(req.app && req.app.get('trust proxy'));
  if (isProxyTrusted && req.headers && req.headers['x-forwarded-for']) {
    const raw = req.headers['x-forwarded-for'].split(',')[0].trim();
    if (raw) return raw;
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

/**
 * Checks and increments the DB lookup rate limit for an IP.
 * Returns true if rate limit exceeded, false otherwise.
 */
function checkAndIncrementIpRateLimit(ip) {
  const now = Date.now();
  let record = ipLookupTracker.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipLookupTracker.set(ip, record);
    return false;
  }

  record.count += 1;
  return record.count > MAX_DB_LOOKUPS_PER_WINDOW;
}

/**
 * Resets the in-memory rate limiter (useful for test isolation).
 */
function resetRateLimiter() {
  ipLookupTracker.clear();
}

/**
 * Extracts the trusted hostname from the request.
 * Strict proxy verification: Only honors X-Forwarded-Host if Express
 * proxy trusting ('trust proxy') is explicitly configured on the app.
 * Normalizes host by stripping port and any trailing DNS root dot.
 */
function getTrustedHost(req) {
  const isProxyTrusted = Boolean(req.app && req.app.get('trust proxy'));

  let raw = '';
  if (isProxyTrusted && req.headers && req.headers['x-forwarded-host']) {
    // If multiple proxies appended headers, take the client-facing (first) host
    raw = req.headers['x-forwarded-host'].split(',')[0].trim();
  } else {
    raw = (req.headers && req.headers['host']) || req.hostname || '';
  }

  // Strip port
  let host = raw.split(':')[0].trim().toLowerCase();

  // Strip trailing DNS root dot (e.g. "lbrce.4thepeople.in.")
  if (host.endsWith('.')) {
    host = host.slice(0, -1);
  }

  return host;
}

/**
 * Parses the subdomain slug from the trusted host based on environment.
 * In production: strictly enforces <slug>.4thepeople.in.
 * In development (NODE_ENV !== 'production'): additionally allows <slug>.localhost.
 *
 * Normalizes case, strips port and trailing dot.
 */
function extractSubdomain(host) {
  if (!host || typeof host !== 'string') return null;

  // Clean port
  let cleanHost = host.split(':')[0].trim().toLowerCase();

  // Clean trailing dot
  if (cleanHost.endsWith('.')) {
    cleanHost = cleanHost.slice(0, -1);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Development-only mapping: <slug>.localhost or <slug>.local
  if (!isProduction) {
    const devMatch = cleanHost.match(/^([a-z0-9-]+)\.(localhost|local)$/i);
    if (devMatch) {
      return devMatch[1].toLowerCase();
    }

    // Bare localhost or 127.0.0.1 is the public directory root
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
      return null;
    }
  }

  // 2. Production & Standard Domain mapping: <slug>.4thepeople.in
  const prodMatch = cleanHost.match(/^([a-z0-9-]+)\.4thepeople\.in$/i);
  if (prodMatch) {
    return prodMatch[1].toLowerCase();
  }

  // Bare root domain 4thepeople.in is the public directory root
  if (cleanHost === '4thepeople.in') {
    return null;
  }

  return null;
}

/**
 * Express middleware that resolves the college tenant from the incoming hostname.
 * Applies per-IP rate limiting before un-cached database queries.
 * Attaches req.college and req.collegeId on success.
 */
async function resolveCollege(req, res, next) {
  try {
    const host = getTrustedHost(req);
    const slug = extractSubdomain(host);

    // 1. Root / Directory Context (no subdomain, or www)
    if (!slug || slug === 'www') {
      req.isPublicRoot = true;
      req.college = null;
      req.collegeId = null;
      return next();
    }

    // 2. Platform Administration Context (admin subdomain)
    if (slug === 'admin') {
      req.isPlatform = true;
      req.college = null;
      req.collegeId = null;
      return next();
    }

    // 3. Reject other reserved subdomains
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(404).json({
        success: false,
        message: `Reserved host identifier '${slug}' is not an active college tenant`,
      });
    }

    // 4. Rate-limit un-cached database lookups per IP
    const cached = isSlugCached(slug);
    if (!cached) {
      const clientIp = getClientIp(req);
      if (checkAndIncrementIpRateLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          message: 'Too many college resolution attempts. Please try again later.',
        });
      }
    }

    // 5. Resolve slug against cache / database (uses 60s negative cache for unknown slugs)
    const college = await getCollegeBySlug(slug);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: `College tenant '${slug}' not found`,
      });
    }

    // 6. Attach resolved tenant context to the request
    req.college = college;
    req.collegeId = college.id;
    req.isPublicRoot = false;
    req.isPlatform = false;

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Middleware requiring that a college context has been successfully resolved.
 * Applied to all college-specific API routes.
 */
function requireCollegeContext(req, res, next) {
  if (!req.collegeId) {
    return res.status(404).json({
      success: false,
      message: 'This endpoint requires a valid college tenant subdomain',
    });
  }
  return next();
}

module.exports = {
  resolveCollege,
  requireCollegeContext,
  getTrustedHost,
  extractSubdomain,
  getClientIp,
  checkAndIncrementIpRateLimit,
  resetRateLimiter,
  MAX_DB_LOOKUPS_PER_WINDOW,
};
