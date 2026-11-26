import { jwtDecode } from 'jwt-decode';
import type { DecodedToken, AuthUser } from '@/types/auth';

const TOKEN_KEYS = [
  'token',
  'studentToken',
  'managerToken',
  'adminToken',
  'platformToken',
] as const;

const USER_KEYS = [
  'studentUser',
  'managerUser',
  'adminUser',
  'platformUser',
  'currentUser',
] as const;

/**
 * Safe local storage reader for tokens in browser environment.
 * Optionally accepts a role to look up the exact role-scoped token.
 */
export function getStoredToken(role?: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  if (role) {
    if (role === 'PLATFORM_ADMIN' || role === 'PLATFORM_SUPER_ADMIN') {
      const p = window.localStorage.getItem('platformToken');
      if (p) return p;
    } else if (role === 'COLLEGE_ADMIN') {
      const a = window.localStorage.getItem('adminToken');
      if (a) return a;
    } else if (role === 'MANAGER' || role === 'CLUB_MANAGER' || role === 'EVENT_MANAGER') {
      const m = window.localStorage.getItem('managerToken');
      if (m) return m;
    } else if (role === 'STUDENT' || role === 'MEMBER' || role === 'USER') {
      const s = window.localStorage.getItem('studentToken');
      if (s) return s;
    }
  }

  // Fallback in priority order
  for (const key of TOKEN_KEYS) {
    const val = window.localStorage.getItem(key);
    if (val) return val;
  }
  return null;
}

/**
 * Parses and verifies JWT claims and expiration client-side.
 * Note: Client-side decoding is for UI state only; authorization is
 * authoritatively verified by the Express backend on every request.
 */
export function parseAndValidateToken(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const decoded = jwtDecode<DecodedToken>(token);

    // Expiry check (exp is in seconds)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    const isPlatform =
      decoded.type === 'platform' ||
      decoded.role === 'PLATFORM_ADMIN' ||
      decoded.role === 'PLATFORM_SUPER_ADMIN';

    const isExternal = decoded.type === 'external' || decoded.role === 'EXTERNAL';

    const rawUserId = decoded.userId || decoded.id;
    const userId = rawUserId || (isExternal && decoded.email ? `ext_${decoded.email}` : null);
    if (!userId) return null;

    let cachedUser: Record<string, unknown> = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item =
          window.localStorage.getItem('currentUser') ||
          (isExternal ? window.localStorage.getItem('externalUser') : null);
        if (item) cachedUser = JSON.parse(item);
      } catch {
        // ignore parse error
      }
    }

    const effectiveRole: AuthUser['role'] = isExternal
      ? 'EXTERNAL'
      : (decoded.role as AuthUser['role']) || (isPlatform ? 'PLATFORM_ADMIN' : 'USER');

    return {
      id: String(userId),
      userId: String(userId),
      role: effectiveRole,
      email: decoded.email || (cachedUser.email as string) || '',
      collegeId: decoded.collegeId
        ? String(decoded.collegeId)
        : decoded.hostCollegeId
        ? String(decoded.hostCollegeId)
        : undefined,
      platformAdminId: decoded.platformAdminId ? String(decoded.platformAdminId) : undefined,
      isPlatformAdmin: isPlatform,
      name: typeof decoded.name === 'string' ? decoded.name : (cachedUser.name as string | undefined),
      phone: (cachedUser.phone as string) || undefined,
      rollNumber: (cachedUser.rollNumber as string) || undefined,
      gender: (cachedUser.gender as string) || undefined,
      yearOfStudy: (cachedUser.yearOfStudy as string) || undefined,
      institutionName:
        (cachedUser.institutionName as string) || (cachedUser.collegeName as string) || undefined,
      collegeName:
        (cachedUser.collegeName as string) || (cachedUser.institutionName as string) || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Stores token and user metadata in browser storage with strict role separation.
 */
export function setStoredAuth(token: string, userData?: Record<string, unknown> | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const decoded = parseAndValidateToken(token);
  if (!decoded) {
    clearStoredAuth();
    return;
  }

  window.localStorage.setItem('token', token);
  if (userData) {
    window.localStorage.setItem('currentUser', JSON.stringify(userData));
  }

  // Partition role-specific keys to eliminate collisions
  if (decoded.role === 'EXTERNAL') {
    window.localStorage.setItem('externalToken', token);
    if (userData) {
      window.localStorage.setItem('externalUser', JSON.stringify(userData));
      setStoredExternalUser(userData as unknown as StoredExternalUser);
    }
    setStoredExternalToken(token);
  } else if (decoded.isPlatformAdmin) {
    window.localStorage.setItem('platformToken', token);
    if (userData) window.localStorage.setItem('platformUser', JSON.stringify(userData));
  } else if (decoded.role === 'COLLEGE_ADMIN') {
    window.localStorage.setItem('adminToken', token);
    if (userData) window.localStorage.setItem('adminUser', JSON.stringify(userData));
  } else if (
    decoded.role === 'MANAGER' ||
    decoded.role === 'CLUB_MANAGER' ||
    decoded.role === 'EVENT_MANAGER'
  ) {
    window.localStorage.setItem('managerToken', token);
    if (userData) window.localStorage.setItem('managerUser', JSON.stringify(userData));
  } else {
    // Student / Member
    window.localStorage.setItem('studentToken', token);
    if (userData) window.localStorage.setItem('studentUser', JSON.stringify(userData));
  }
}

/**
 * Clears all tokens and cached user objects from storage.
 */
export function clearStoredAuth(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  for (const key of TOKEN_KEYS) {
    window.localStorage.removeItem(key);
  }
  for (const key of USER_KEYS) {
    window.localStorage.removeItem(key);
  }
  clearStoredExternalToken();
  clearStoredExternalUser();
}

const EXTERNAL_REGISTRATION_TOKEN_KEY = 'yuva_external_reg_token';
const EXTERNAL_USER_KEY = 'yuva_external_user';

export interface StoredExternalUser {
  name: string;
  email: string;
  phone?: string;
  institutionName?: string;
  collegeName?: string;
  rollNumber?: string;
  department?: string;
  gender?: string;
  yearOfStudy?: string;
}

/**
 * Safe storage reader for external participant tokens.
 * Checks sessionStorage first, then localStorage fallback.
 */
export function getStoredExternalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    (window.sessionStorage && window.sessionStorage.getItem(EXTERNAL_REGISTRATION_TOKEN_KEY)) ||
    (window.localStorage && window.localStorage.getItem(EXTERNAL_REGISTRATION_TOKEN_KEY)) ||
    null
  );
}

export function setStoredExternalToken(token: string): void {
  if (typeof window === 'undefined') return;
  if (window.sessionStorage) window.sessionStorage.setItem(EXTERNAL_REGISTRATION_TOKEN_KEY, token);
  if (window.localStorage) window.localStorage.setItem(EXTERNAL_REGISTRATION_TOKEN_KEY, token);
}

export function clearStoredExternalToken(): void {
  if (typeof window === 'undefined') return;
  if (window.sessionStorage) window.sessionStorage.removeItem(EXTERNAL_REGISTRATION_TOKEN_KEY);
  if (window.localStorage) window.localStorage.removeItem(EXTERNAL_REGISTRATION_TOKEN_KEY);
  clearStoredExternalUser();
}

export function getStoredExternalUser(): StoredExternalUser | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(EXTERNAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredExternalUser;
  } catch {
    return null;
  }
}

export function setStoredExternalUser(user: StoredExternalUser): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(EXTERNAL_USER_KEY, JSON.stringify(user));
}

export function clearStoredExternalUser(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(EXTERNAL_USER_KEY);
}
