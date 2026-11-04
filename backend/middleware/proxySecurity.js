const crypto = require('crypto');

/**
 * Validates the proxy shared secret on incoming requests.
 * In production (or when PROXY_SHARED_SECRET is configured):
 * Direct connections bypassing the trusted reverse proxy (e.g. hitting Render directly)
 * cannot provide the shared secret, preventing attackers from spoofing X-Forwarded-For,
 * X-Forwarded-Host, or Cloudflare/Render client headers.
 */
function validateProxySharedSecret(req, res, next) {
  // Exempt health-check paths from proxy shared secret check (e.g. Render / Cloud health monitors)
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const sharedSecret = process.env.PROXY_SHARED_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, PROXY_SHARED_SECRET is strictly mandatory
  if (isProduction && !sharedSecret) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: PROXY_SHARED_SECRET is required in production',
      errors: {},
    });
  }

  // When PROXY_SHARED_SECRET is configured, enforce it on incoming requests
  if (sharedSecret) {
    const incomingHeader = req.headers['x-proxy-shared-secret'];
    if (!incomingHeader) {
      return res.status(403).json({
        success: false,
        message: 'Direct origin access denied: Missing proxy shared secret',
        errors: {},
      });
    }

    // Hash both to fixed-length SHA-256 digests to prevent timingSafeEqual length mismatch exceptions and length leakage
    const incomingHash = crypto.createHash('sha256').update(String(incomingHeader)).digest();
    const secretHash = crypto.createHash('sha256').update(String(sharedSecret)).digest();

    if (!crypto.timingSafeEqual(incomingHash, secretHash)) {
      return res.status(403).json({
        success: false,
        message: 'Direct origin access denied: Invalid proxy shared secret',
        errors: {},
      });
    }
  }

  next();
}

module.exports = { validateProxySharedSecret };
