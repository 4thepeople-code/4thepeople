/**
 * Pure path-routing decisions for college pages.
 *
 * Combines the request path with the host resolution (hostResolver.ts) into a single
 * decision object the middleware can execute:
 * - which tenant headers the request should carry,
 * - whether the path must be rewritten internally (a college subdomain serves "/"
 *   and mismatched /college/* paths from the same shared page, browser URL unchanged),
 * - whether the request must be rejected outright.
 *
 * Pure function: no next/server imports, so tests can run it directly under tsx.
 */
import type { HostResolutionResult } from './hostResolver';

/**
 * Slugs that are reserved for platform paths and can never be used as a
 * path-based college slug on a plain host (www|api|admin are also blocked as
 * subdomains inside hostResolver).
 */
export const RESERVED_PATH_SLUGS: ReadonlySet<string> = new Set([
  'www',
  'admin',
  'api',
  'mail',
  'app',
  'static',
  'assets',
  'public',
  'auth',
  'demo',
  'directory',
]);

export type RoutingHostType = 'PUBLIC' | 'COLLEGE' | 'PLATFORM_ADMIN';

export interface CollegeRoutingDecision {
  /** Value for the x-yuva-host-type forwarding header. */
  hostType: RoutingHostType;
  /** Value for the x-yuva-tenant-slug forwarding header, when the request is tenant-scoped. */
  tenantSlug?: string;
  /** Internal path to rewrite to; the browser URL stays unchanged. */
  rewritePath?: string;
  /** Set when the request must be rejected with this HTTP status (reserved path slug). */
  status?: number;
}

const COLLEGE_PATH_PATTERN = /^\/college\/([a-z0-9-]+)(?:\/|$)/i;

/**
 * Decides routing for a request from its path plus host resolution.
 *
 * Rules:
 * 1. /admin paths are platform-admin surface on any host.
 * 2. On a plain host (localhost, 4thepeople.in), /college/<slug> routes by path slug.
 * 3. On a college subdomain (<slug>.localhost / <slug>.4thepeople.in), the subdomain
 *    slug wins: "/" is rewritten to /college/<slug>, and /college/<other> is rewritten
 *    to /college/<slug> (preserving any sub-path) so both URLs render the same page
 *    component with no duplicated code.
 * 4. /api and static assets are never rewritten (the middleware matcher already
 *    excludes static assets; this function only ever rewrites "/" and /college/*).
 */
export function resolveCollegeRouting(
  pathname: string,
  resolution: HostResolutionResult
): CollegeRoutingDecision {
  // Platform administration uses the /admin path (on any host).
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { hostType: 'PLATFORM_ADMIN' };
  }

  const collegeMatch = pathname.match(COLLEGE_PATH_PATTERN);
  if (collegeMatch) {
    const pathSlug = collegeMatch[1].toLowerCase();

    // College subdomain: the subdomain slug always wins over a mismatched path slug.
    if (resolution.type === 'COLLEGE' && resolution.slug) {
      const subdomainSlug = resolution.slug;

      if (pathSlug === subdomainSlug) {
        return { hostType: 'COLLEGE', tenantSlug: subdomainSlug };
      }

      // Preserve any sub-path (/college/<other>/clubs/x -> /college/<slug>/clubs/x).
      const subPath = pathname.slice('/college/'.length + collegeMatch[1].length);
      return {
        hostType: 'COLLEGE',
        tenantSlug: subdomainSlug,
        rewritePath: `/college/${subdomainSlug}${subPath}`,
      };
    }

    // Plain host: path-based college routing (existing behavior).
    if (RESERVED_PATH_SLUGS.has(pathSlug)) {
      return { hostType: 'PUBLIC', status: 400 };
    }
    return { hostType: 'COLLEGE', tenantSlug: pathSlug };
  }

  // College subdomain root serves the tenant college page.
  if (resolution.type === 'COLLEGE' && resolution.slug && pathname === '/') {
    return {
      hostType: 'COLLEGE',
      tenantSlug: resolution.slug,
      rewritePath: `/college/${resolution.slug}`,
    };
  }

  // Everything else is public platform surface (landing, /directory, /demo, /api proxy).
  return { hostType: 'PUBLIC' };
}
