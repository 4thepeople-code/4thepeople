'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthUser, AuthContextState } from '@/types/auth';
import { User } from '@/types/models';
import {
  getStoredToken,
  parseAndValidateToken,
  setStoredAuth,
  clearStoredAuth,
} from '@/lib/auth/tokenStorage';
import { clearAllQueryCache } from '@/lib/query/queryClient';
import { apiClient } from '@/lib/api/axios';

const AuthContext = createContext<AuthContextState | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Authoritatively restores user session from backend HttpOnly cookies (/auth/me or /platform/auth/me)
   * with local storage token fallback.
   */
  const refreshSession = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;

      const isPlatformHost =
        window.location.hostname.startsWith('admin.') ||
        ((window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '4thepeople.in') &&
          window.location.pathname.startsWith('/admin'));

      const meEndpoint = isPlatformHost ? '/platform/auth/me' : '/auth/me';

      const response = await apiClient.get(meEndpoint);
      const res = response.data;

      const backendUser: AuthUser | null =
        res?.data?.user || res?.data?.admin || res?.user || res?.admin || null;

      if (backendUser) {
        setUser({
          id: backendUser.id,
          userId: backendUser.id,
          name: backendUser.name,
          email: backendUser.email,
          role: backendUser.role,
          collegeId: backendUser.collegeId,
          isPlatformAdmin: isPlatformHost || backendUser.role === 'PLATFORM_SUPER_ADMIN',
        });
        const stored = getStoredToken();
        if (stored) setToken(stored);
      } else {
        // Fallback to local token parsing if me endpoint returned no user
        const stored = getStoredToken();
        if (stored) {
          const parsed = parseAndValidateToken(stored);
          if (parsed) {
            setToken(stored);
            setUser(parsed);
          } else {
            clearStoredAuth();
            setToken(null);
            setUser(null);
          }
        }
      }
    } catch {
      // 401 or network error - check stored token fallback or clear
      const stored = getStoredToken();
      if (stored) {
        const parsed = parseAndValidateToken(stored);
        if (parsed) {
          setToken(stored);
          setUser(parsed);
        } else {
          clearStoredAuth();
          setToken(null);
          setUser(null);
        }
      } else {
        clearStoredAuth();
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isSubscribed = true;
    void (async () => {
      if (isSubscribed) {
        await refreshSession();
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [refreshSession]);

  /**
   * Cookie-first login handler. Supports both:
   * 1. login(user: AuthUser, token?: string) - preferred cookie-first signature
   * 2. login(token: string, userData?: Partial<User>) - legacy hybrid signature
   */
  const login = (
    userOrToken: AuthUser | string,
    tokenOrData?: string | Partial<User> | null
  ) => {
    if (!userOrToken) return;

    // Reset query cache before establishing new session to prevent cross-account cache leakage
    clearAllQueryCache();

    if (typeof userOrToken === 'string') {
      // Legacy signature: token was returned in body
      const rawToken = userOrToken;
      const parsed = parseAndValidateToken(rawToken);
      if (!parsed) {
        logout();
        return;
      }

      const mergedUser: AuthUser = {
        ...parsed,
        ...(typeof tokenOrData === 'object' && tokenOrData !== null ? tokenOrData : {}),
        name: (typeof tokenOrData === 'object' && tokenOrData?.name) || parsed.name,
      };

      setStoredAuth(rawToken, tokenOrData as Record<string, unknown> | null);
      setToken(rawToken);
      setUser(mergedUser);
    } else {
      // Preferred cookie-first signature: user metadata supplied from login response
      const incomingUser = userOrToken;
      const rawToken = typeof tokenOrData === 'string' ? tokenOrData : null;

      if (rawToken) {
        setStoredAuth(rawToken, incomingUser as unknown as Record<string, unknown>);
        setToken(rawToken);
      }

      setUser(incomingUser);
    }
  };

  /**
   * Authoritative logout: clears server-side HttpOnly cookies and client query cache.
   */
  const logout = async () => {
    try {
      const isPlatformHost =
        typeof window !== 'undefined' &&
        (window.location.hostname.startsWith('admin.') ||
          window.location.pathname.startsWith('/admin'));

      const logoutEndpoint = isPlatformHost ? '/platform/auth/logout' : '/auth/logout';
      await apiClient.post(logoutEndpoint).catch(() => {});
    } finally {
      clearStoredAuth();
      clearAllQueryCache();
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
