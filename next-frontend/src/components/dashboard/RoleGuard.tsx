'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  collegeAdminLoginHref,
  managerLoginHref,
  platformLoginHref,
  studentLoginHref,
  type DashboardRole,
} from '@/lib/auth/roleRedirect';
import { SkeletonLines } from './ui/Skeleton';
import DashboardButton from './ui/DashboardButton';
import { guard, roleNames } from '@/lib/copy';

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
 * - Signed in as the wrong role:
 *   - College dashboards: sent to their own dashboard (e.g. College Admin is
 *     bounced out of manager routes — the pre-existing behaviour, kept).
 *   - Super Admin (platform): explicit "sign out & switch account" screen —
 *     platform routes must not redirect college accounts anywhere.
 *
 * Note: Event Manager authorization is data-driven (role 'USER' + active
 * memberships) and stays in the manager pages; this guard handles session and
 * coarse role routing only.
 */
export default function RoleGuard({ role, slug, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, loading, logout, dashboardHref } = useAuth();
  const redirecting = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (loading || redirecting.current || role === 'superAdmin') return;
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
    // Super Admin surfaces name the situation and offer the switch, matching
    // the old PlatformAdminLayout behaviour. Other roles are being redirected
    // by the effect above; keep the screen quiet and non-blaming meanwhile.
    if (role === 'superAdmin') {
      const handleSignOut = async () => {
        setSigningOut(true);
        try {
          await logout();
        } finally {
          window.location.href = platformLoginHref();
        }
      };
      return (
        <div className="dashboard-scope flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-[var(--ink)]">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
            <span
              aria-hidden="true"
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--secondary-soft)] text-[var(--secondary)]"
            >
              <ShieldAlert className="h-7 w-7" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold">{guard.platformDeniedTitle}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                {guard.platformDeniedDescription(roleNames.collegeAdmin)}
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--ink-soft)]">
                {user.email} · {String(user.role)}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <DashboardButton
                variant="danger"
                size="sm"
                onClick={handleSignOut}
                loading={signingOut}
                loadingLabel={guard.signOutAndSwitch}
                leftIcon={signingOut ? undefined : <LogOut aria-hidden="true" className="h-4 w-4" />}
              >
                {guard.signOutAndSwitch}
              </DashboardButton>
              <DashboardButton variant="secondary" size="sm" href="/">
                {guard.returnToPublicSite}
              </DashboardButton>
            </div>
          </div>
        </div>
      );
    }
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
