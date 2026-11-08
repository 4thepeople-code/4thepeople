/**
 * Hostname and tenant routing resolver for 4thepeople Next.js frontend.
 * 
 * Enforces the exact same multi-tenant routing security rules as the Express backend:
 * - Strict hostname normalization (port stripping, trailing DNS root dot stripping, lowercase).
 * - Multi-tenant subdomain extraction (<slug>.4thepeople.in).
 * - Development tenant support (<slug>.localhost, <slug>.local) ONLY when NODE_ENV !== 'production'.
 * - Protection against evil-suffix attacks (*.4thepeople.in.evil.com) and nested subdomains (*.*.4thepeople.in).
 * - Strict rejection of unknown or malformed hosts (no silent fallback to public directory).
 */

export type HostType = 'PUBLIC' | 'COLLEGE' | 'PLATFORM_ADMIN' | 'INVALID';

export interface HostResolutionResult {
  type: HostType;
  slug?: string;
  cleanHost: string;
  isTrusted: boolean;
  reason?: string;
}

const RESERVED_SLUGS = new Set([
  'www',
  'admin',
  'api',
  'mail',
  'app',
  'static',
  'assets',
  'public',
  'auth',
]);

/**
 * Normalizes a raw hostname string by:
 * 1. Stripping port (:3000, :443, etc.)
 * 2. Stripping trailing DNS root dot (e.g. "lbrce.4thepeople.in.")
 * 3. Lowercasing and trimming
 */
export function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost || typeof rawHost !== 'string') {
    return '';
  }

  // Strip port
  let host = rawHost.split(':')[0].trim().toLowerCase();

  // Strip trailing DNS root dot
  if (host.endsWith('.')) {
    host = host.slice(0, -1);
  }

  return host;
}

/**
 * Resolves host identity and tenant routing mode from a clean host string.
 *
 * @param rawHost - Incoming Host or X-Forwarded-Host header value
 * @param options - Environment override for testability
 */
export function resolveHost(
  rawHost: string | null | undefined,
  options: {
    isProduction?: boolean;
    trustProxy?: boolean;
    forwardedHost?: string | null;
  } = {}
): HostResolutionResult {
  const isProduction =
    options.isProduction !== undefined
      ? options.isProduction
      : process.env.NODE_ENV === 'production';

  // Strict proxy check: Only use X-Forwarded-Host if trustProxy is explicitly enabled
  let hostToInspect = rawHost;
  if (options.trustProxy && options.forwardedHost) {
    hostToInspect = options.forwardedHost.split(',')[0].trim();
  }

  const cleanHost = normalizeHost(hostToInspect);

  if (!cleanHost) {
    return {
      type: 'INVALID',
      cleanHost: '',
      isTrusted: false,
      reason: 'Empty or missing host header',
    };
  }

  // Reject invalid characters or obvious header injections
  if (!/^[a-z0-9.-]+$/i.test(cleanHost)) {
    return {
      type: 'INVALID',
      cleanHost,
      isTrusted: false,
      reason: 'Host contains illegal characters',
    };
  }

  // 1. Production domain routing: *.4thepeople.in
  if (cleanHost === '4thepeople.in' || cleanHost === 'www.4thepeople.in') {
    return {
      type: 'PUBLIC',
      cleanHost,
      isTrusted: true,
    };
  }

  const prodSubdomainMatch = cleanHost.match(/^([a-z0-9-]+)\.4thepeople\.in$/i);
  if (prodSubdomainMatch) {
    const slug = prodSubdomainMatch[1].toLowerCase();

    if (slug === 'admin') {
      return {
        type: 'PLATFORM_ADMIN',
        cleanHost,
        isTrusted: true,
      };
    }

    if (slug === 'www') {
      return {
        type: 'PUBLIC',
        cleanHost,
        isTrusted: true,
      };
    }

    if (RESERVED_SLUGS.has(slug)) {
      return {
        type: 'INVALID',
        cleanHost,
        isTrusted: false,
        reason: `Subdomain '${slug}' is a reserved infrastructure slug`,
      };
    }

    return {
      type: 'COLLEGE',
      slug,
      cleanHost,
      isTrusted: true,
    };
  }

  // 2. Development-only domain routing: *.localhost or *.local
  if (!isProduction) {
    if (
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost === 'www.localhost'
    ) {
      return {
        type: 'PUBLIC',
        cleanHost,
        isTrusted: true,
      };
    }

    const devSubdomainMatch = cleanHost.match(/^([a-z0-9-]+)\.(localhost|local)$/i);
    if (devSubdomainMatch) {
      const slug = devSubdomainMatch[1].toLowerCase();

      if (slug === 'admin') {
        return {
          type: 'PLATFORM_ADMIN',
          cleanHost,
          isTrusted: true,
        };
      }

      if (slug === 'www') {
        return {
          type: 'PUBLIC',
          cleanHost,
          isTrusted: true,
        };
      }

      if (RESERVED_SLUGS.has(slug)) {
        return {
          type: 'INVALID',
          cleanHost,
          isTrusted: false,
          reason: `Development subdomain '${slug}' is reserved`,
        };
      }

      return {
        type: 'COLLEGE',
        slug,
        cleanHost,
        isTrusted: true,
      };
    }
  } else {
    // In production, reject any localhost or local requests
    if (cleanHost.includes('localhost') || cleanHost.includes('local')) {
      return {
        type: 'INVALID',
        cleanHost,
        isTrusted: false,
        reason: 'Localhost domains are forbidden in production mode',
      };
    }
  }

  // 3. Fallback: Any unrecognized or malformed host
  // Crucial: Must NEVER silently resolve to PUBLIC directory!
  return {
    type: 'INVALID',
    cleanHost,
    isTrusted: false,
    reason: `Unrecognized or unauthorized hostname '${cleanHost}'`,
  };
}

