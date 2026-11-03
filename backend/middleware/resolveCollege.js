const { getCollegeBySlug } = require('../config/collegeResolver');

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

/**
 * Extracts the trusted hostname from the request.
 * Strict proxy verification: Only honors X-Forwarded-Host if Express
 * proxy trusting ('trust proxy') is explicitly configured on the app.
 */
function getTrustedHost(req) {
  const isProxyTrusted = Boolean(req.app && req.app.get('trust proxy'));

  if (isProxyTrusted && req.headers['x-forwarded-host']) {
    // If multiple proxies appended headers, take the client-facing (first) host
    const forwarded = req.headers['x-forwarded-host'].split(',')[0].trim();
    if (forwarded) {
      return forwarded.split(':')[0].trim().toLowerCase();
    }
  }

  const rawHost = req.headers['host'] || req.hostname || '';
  return rawHost.split(':')[0].trim().toLowerCase();
}

/**
 * Parses the subdomain slug from the trusted host based on environment.
 * In production: strictly enforces <slug>.4thepeople.in.
 * In development (NODE_ENV !== 'production'): additionally allows <slug>.localhost.
 */
function extractSubdomain(host) {
  if (!host || typeof host !== 'string') return null;
  const cleanHost = host.split(':')[0].trim().toLowerCase();
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

    // 4. Resolve slug against the PostgreSQL colleges table
    const college = await getCollegeBySlug(slug);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: `College tenant '${slug}' not found`,
      });
    }

    // 5. Attach resolved tenant context to the request
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
};
