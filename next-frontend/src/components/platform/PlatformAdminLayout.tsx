'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Lock,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Loader2,
  Building2,
  Activity,
  KeyRound,
  ExternalLink,
  Users,
} from 'lucide-react';

export interface PlatformAdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function PlatformAdminLayout({
  children,
  activeTab = 'overview',
  onTabChange,
}: PlatformAdminLayoutProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Platform Auth Guard: Strictly requires PLATFORM_SUPER_ADMIN role or isPlatformAdmin flag
  const isPlatformAuthorized =
    Boolean(user) &&
    (user?.role === 'PLATFORM_SUPER_ADMIN' || user?.isPlatformAdmin === true);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/admin/login');
    } catch {
      // Ignored - router push navigates anyway
      router.push('/admin/login');
    } finally {
      setLoggingOut(false);
    }
  };

  // 1. Session verification loading state
  if (authLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="text-center space-y-4 p-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-sm">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Validating Platform Security Credentials
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verifying dedicated host-only platform session cookie...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Prompt to sign in
  if (!user) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-full mb-2">
              Platform Operations
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Platform Authentication Required
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              This administrative area requires a validated platform super-administrator session with multi-factor TOTP verification.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>Go to Platform Admin Login</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthorized State (e.g. COLLEGE_ADMIN, MANAGER, or STUDENT role attempting platform access)
  if (!isPlatformAuthorized) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 p-8 rounded-2xl shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-full mb-2">
              Cross-Boundary Access Blocked
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Access Denied: Super-Admin Privileges Required
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              You are currently authenticated as{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-mono">
                {user.email}
              </strong>{' '}
              with role{' '}
              <strong className="text-red-600 dark:text-red-400 font-mono">
                {user.role}
              </strong>
              . College-level accounts cannot authenticate or manage platform operations routes.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span>Sign Out & Switch Account</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Return to Public Directory</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated Platform Administrator Portal Layout
  const navTabs = [
    { id: 'overview', label: 'Platform Dashboard', icon: Activity },
    { id: 'admins', label: 'Super-Administrators', icon: Users },
    { id: 'colleges', label: 'Institutions & Tenancy', icon: Building2 },
    { id: 'security', label: 'Security & Access Control', icon: Lock },
    { id: 'telemetry', label: 'System Architecture', icon: Server },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Banner: Host & Security Status */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-[11px] font-mono border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Platform Host:</span>
          <span className="text-white font-semibold">admin.4thepeople.in</span>
          <span className="text-slate-500">|</span>
          <span className="text-purple-400">PostgreSQL RLS Platform Bypass (platform_ops)</span>
        </div>
        <div className="hidden sm:flex items-center space-x-3">
          <span className="text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> TOTP MFA Active
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Cookie: yuva_platform_token (Strict)</span>
        </div>
      </div>

      {/* Main Platform Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm group-hover:bg-purple-700 transition-colors">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    4thepeople
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                    Platform Ops
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Super-Administrator Control Center
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Super Admin Identity Badge */}
            <div className="flex items-center space-x-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                {user.name ? user.name[0] : user.email[0]}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-none">
                  {user.name || user.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {user.email}
                </span>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                ACTIVE
              </span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/60 transition-colors disabled:opacity-50"
            >
              {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              <span>Sign Out</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-3">
            <div className="flex items-center space-x-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                {user.name ? user.name[0] : user.email[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {user.name || 'Platform Administrator'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            {/* Navigation Tabs (Mobile) */}
            <div className="space-y-1">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (onTabChange) onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950 transition-colors"
              >
                {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>Sign Out of Platform</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Desktop Navigation Tabs */}
        {onTabChange && (
          <div className="hidden md:flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 mb-8 pb-3">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {children}
      </main>

      {/* Platform Operations Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              4thepeople Platform Operations
            </span>
            <span>&bull;</span>
            <span>Version 2.0 (PostgreSQL RLS Architecture)</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span>Isolation: Tenant Schema Keyed</span>
            <span>&bull;</span>
            <span>BFF: Same-Origin Strict Proxy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PlatformAdminLayout;
