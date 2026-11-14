'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  collegeAdminLoginHref,
  managerLoginHref,
  platformLoginHref,
  studentLoginHref,
  type DashboardRole,
} from '@/lib/auth/roleRedirect';import { SkeletonLines } from './ui/Skeleton';
import { guard } from '@/lib/copy';

export interface RoleGuardProps {
  role: DashboardRole;
  /** College slug for college-scoped roles; unused for superAdmin. */
  slug?: string;
  children: ReactNode;
}

function loginHrefFor(role: DashboardRole, slug?: string): string {
  switch (role) {
    case 'collegeAdmin':
      return slug ? collegeAdminLoginHref(slug) : '/admin/login';
    case 'eventManager':
      return slug ? managerLoginHref(slug) : '/login/manager';
    case 'student':
      return slug ? studentLoginHref(slug) : '/';
    case 'superAdmin':
      return platformLoginHref();
  }
}

/**
 * Layout-level role guard (UX only — the backend remains the authority).
 *
 * - Loading: skeleton, never a spinner.
 * - Signed out: back to the role's login, carrying the current path as
 *   ?returnUrl so the user lands back here.
 * - Signed in as the wrong role: sent to their own dashboard instead of
 *   showing an error (e.g. College Admin is bounced out of manager routes —
 *   the pre-existing behaviour, kept).
 *
 * Note: Event Manager authorization is data-driven (role 'USER' + active
 * memberships) and stays in the manager pages; this guard handles session and
 * coarse role routing only.
 */
export default function RoleGuard({ role, slug, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, loading, dashboardHref } = useAuth();
  const redirecting = useRef(false);

  useEffect(() => {
    if (loading || redirecting.current) return;
    if (!user) {
      redirecting.current = true;
      const returnUrl = encodeURIComponent(
        typeof window === 'undefined' ? '' : window.location.pathname + window.location.search,
      );
      const login = loginHrefFor(role, slug);
      router.replace(returnUrl ? `${login}?returnUrl=${returnUrl}` : login);
      return;
    }
    const ownDashboard = dashboardHref(slug);
    const allowed = isAllowed(user.role, user.isPlatformAdmin, role);
    if (!allowed && ownDashboard) {
      redirecting.current = true;
      router.replace(ownDashboard);
    }
  }, [user, loading, role, slug, router, dashboardHref]);

  if (loading || !user) {
    return (
      <div className="dashboard-scope flex min-h-screen items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-sm space-y-3" role="status" aria-label={guard.authChecking}>
          <SkeletonLines count={3} />
        </div>
      </div>
    );
  }

  if (!isAllowed(user.role, user.isPlatformAdmin, role)) {
    // Wrong-role users are being redirected by the effect above; keep the
    // screen quiet and non-blaming while that happens.
    return null;
  }

  return <>{children}</>;
}

function isAllowed(
  userRole: string,
  isPlatformAdmin: boolean | undefined,
  role: DashboardRole,
): boolean {
  switch (role) {
    case 'superAdmin':
      return userRole === 'PLATFORM_SUPER_ADMIN' || isPlatformAdmin === true;
    case 'collegeAdmin':
      return userRole === 'COLLEGE_ADMIN' || userRole === 'ADMIN';
    case 'eventManager':
      // Managers authenticate as 'USER' with memberships; membership-level
      // authorization is handled by the manager pages themselves.
      return userRole === 'MANAGER' || userRole === 'USER';
    case 'student':
      return userRole === 'STUDENT' || userRole === 'USER' || userRole === 'MANAGER';
  }
}
