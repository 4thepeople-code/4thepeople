import { slugFromCollegePath, type DashboardRole } from './roleRedirect';
import type { AuthUser } from '@/types/auth';

/**
 * Client-side tenant binding: remembers which college slug the user logged
 * into (login pages live at /college/[slug]/login, and a successful login is
 * same-tenant by construction — the backend scopes the login query to the
 * request's tenant). RoleGuard uses it to detect a signed-in user opening a
 * DIFFERENT college's dashboard and show a clean "wrong college" screen
 * instead of screens full of 403 error states.
 *
 * UX-only: the backend remains the authority (authenticateToken rejects any
 * cross-tenant data access with 403). Bindings are per-browser; a session
 * restored from another device has no binding and simply skips the check.
 */

const BINDING_KEY = 'yuvaCollegeBinding';

export interface CollegeBinding {
  collegeId: string;
  slug: string;
}

/** Call from AuthContext.login(): records the tenant the user just signed into. */
export function rememberCollegeBinding(user: AuthUser | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!user?.collegeId) return; // platform accounts have no college
  const slug = slugFromCollegePath(window.location.pathname);
  if (!slug) return; // login happened off a college path; nothing to bind
  try {
    window.localStorage.setItem(
      BINDING_KEY,
      JSON.stringify({ collegeId: user.collegeId, slug } satisfies CollegeBinding),
    );
  } catch {
    // storage unavailable (private mode etc.) — check silently disabled
  }
}

/** The binding for this exact account, or null (unknown → skip the check). */
export function getCollegeBindingFor(user: AuthUser | null): CollegeBinding | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  if (!user?.collegeId) return null;
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CollegeBinding>;
    if (parsed && parsed.collegeId === user.collegeId && parsed.slug) {
      return { collegeId: parsed.collegeId, slug: parsed.slug };
    }
    return null; // stale binding from a different account — not usable
  } catch {
    return null;
  }
}

/** Which dashboard section this role lives under (/college/[slug]/<section>). */
export function dashboardSectionForRole(role: DashboardRole): string | null {
  switch (role) {
    case 'collegeAdmin':
      return 'admin';
    case 'eventManager':
      return 'manager';
    case 'student':
      return 'student';
    default:
      return null; // superAdmin is platform-scoped, not college-scoped
  }
}

export function clearCollegeBinding(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(BINDING_KEY);
  } catch {
    // ignore
  }
}
