import type { AuthUser } from '@/types/auth';

/**
 * Single source of truth for "where does each role land" and "where does each
 * role log in". Used by the login clients, AuthContext and RoleGuard so the
 * routing quirks live in exactly one place.
 *
 * Preserved quirks (do not change without product sign-off):
 * - Event Managers authenticate with role 'USER' + active memberships, so the
 *   login *portal* — not the user object — decides the student/manager target.
 * - A signed-in College Admin is always bounced to the College Admin
 *   dashboard, whichever portal they used.
 * - College-scoped dashboards are used when the login happens under
 *   /college/[slug]/…; the bare fallbacks ('/admin', '/manager') keep the
 *   behaviour of the platform/subdomain-hosted login pages.
 */

export type DashboardRole = 'collegeAdmin' | 'eventManager' | 'student' | 'superAdmin';

export type LoginPortal = 'student' | 'manager' | 'collegeAdmin' | 'platform';

export function adminDashboardHref(slug: string): string {
  return `/college/${slug}/admin`;
}

export function managerDashboardHref(slug: string): string {
  return `/college/${slug}/manager`;
}

export function studentDashboardHref(slug: string): string {
  return `/college/${slug}/student`;
}

export function platformDashboardHref(): string {
  return '/admin';
}

export function studentLoginHref(slug: string): string {
  return `/college/${slug}/login`;
}

export function managerLoginHref(slug: string): string {
  return `/college/${slug}/login/manager`;
}

export function collegeAdminLoginHref(slug: string): string {
  return `/college/${slug}/login/admin`;
}

export function platformLoginHref(): string {
  return '/admin/login';
}

/** "/college/acme/admin/users" -> "acme"; null outside a college path. */
export function slugFromCollegePath(pathname: string): string | null {
  const match = pathname.match(/^\/college\/([a-z0-9-]+)(?:\/|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function isUnderCollegePath(slug: string, currentPath?: string): boolean {
  return typeof currentPath === 'string' && currentPath.startsWith(`/college/${slug}`);
}

/** Where each dashboard role should land once signed in. */
export function dashboardHrefForRole(role: DashboardRole, slug?: string): string {
  switch (role) {
    case 'collegeAdmin':
      return slug ? adminDashboardHref(slug) : '/admin';
    case 'eventManager':
      return slug ? managerDashboardHref(slug) : '/manager';
    case 'student':
      return slug ? studentDashboardHref(slug) : '/';
    case 'superAdmin':
      return platformDashboardHref();
  }
}

/** Best-effort dashboard target for an arbitrary authenticated user. */
export function dashboardHrefForUser(user: AuthUser | null, slug?: string): string | null {
  if (!user) return null;
  if (user.role === 'PLATFORM_SUPER_ADMIN' || user.isPlatformAdmin) return platformDashboardHref();
  if (user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN') {
    return slug ? adminDashboardHref(slug) : '/admin';
  }
  if (user.role === 'MANAGER') {
    return slug ? managerDashboardHref(slug) : '/manager';
  }
  // role 'USER' / 'STUDENT': students; managers are 'USER' with memberships and
  // are bounced to the Event Manager workspace by the manager-side guard.
  return slug ? studentDashboardHref(slug) : null;
}

/** Default returnUrl for a portal, matching the pre-existing login page logic. */
export function defaultReturnUrl(
  portal: LoginPortal,
  slug: string,
  currentPath?: string,
): string {
  if (portal === 'student') return studentDashboardHref(slug);
  if (portal === 'manager') {
    return isUnderCollegePath(slug, currentPath) ? managerDashboardHref(slug) : '/manager';
  }
  if (portal === 'collegeAdmin') {
    return isUnderCollegePath(slug, currentPath) ? adminDashboardHref(slug) : '/admin';
  }
  return platformDashboardHref();
}

/**
 * Target after a successful login. `returnUrl` wins for non-admin portals
 * (it is already validated by the caller), except when the authenticated user
 * turns out to be a College Admin — admins always land on their dashboard.
 */
export function resolvePostLoginTarget(options: {
  portal: LoginPortal;
  user: AuthUser;
  slug: string;
  currentPath?: string;
  returnUrl?: string;
}): string {
  const { portal, user, slug, currentPath, returnUrl } = options;

  if (user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN') {
    return isUnderCollegePath(slug, currentPath) ? adminDashboardHref(slug) : '/admin';
  }

  if (returnUrl) return returnUrl;

  switch (portal) {
    case 'student':
      return studentDashboardHref(slug);
    case 'manager':
      return isUnderCollegePath(slug, currentPath) ? managerDashboardHref(slug) : '/manager';
    case 'collegeAdmin':
      return isUnderCollegePath(slug, currentPath) ? adminDashboardHref(slug) : '/admin';
    case 'platform':
      return platformDashboardHref();
  }
}

/**
 * Where to send a user who opens a login page while already authenticated.
 * Returns null when no redirect is needed. College Admins are bounced out of
 * every portal into their own workspace.
 */
export function redirectIfAlreadyAuthenticated(options: {
  portal: LoginPortal;
  user: AuthUser | null;
  slug: string;
  currentPath?: string;
}): string | null {
  const { portal, user, slug, currentPath } = options;
  if (!user) return null;
  if (user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN') {
    return isUnderCollegePath(slug, currentPath) ? adminDashboardHref(slug) : '/admin';
  }
  if (portal === 'platform' && (user.role === 'PLATFORM_SUPER_ADMIN' || user.isPlatformAdmin)) {
    return platformDashboardHref();
  }
  return null;
}
