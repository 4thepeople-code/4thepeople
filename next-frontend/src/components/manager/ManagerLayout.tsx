'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMyClubsQuery } from '@/lib/api/manager';
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Menu,
  X,
  User as UserIcon,
  ChevronRight,
  ExternalLink,
  Sun,
  Moon,
  ShieldAlert,
  LogIn,
} from 'lucide-react';

export interface ManagerLayoutProps {
  slug: string;
  children: React.ReactNode;
}

export function ManagerLayout({ slug, children }: ManagerLayoutProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Computes path depending on whether user is on a direct /college/[slug] path or subdomain
  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const dashboardHref = getCanonicalPath('/manager');
  const clubsHref = getCanonicalPath('/manager/clubs');
  const profileHref = getCanonicalPath('/manager/profile');
  const publicHref = getCanonicalPath('/');
  const loginHref = getCanonicalPath('/login/manager');

  const navItems = [
    { label: 'Dashboard', href: dashboardHref, icon: LayoutDashboard },
    { label: 'My Clubs', href: clubsHref, icon: Building2 },
    { label: 'Profile Settings', href: profileHref, icon: UserIcon },
  ];

  const getBreadcrumb = () => {
    if (pathname.includes('/manager/profile')) return 'Profile Settings';
    if (pathname.includes('/events/')) return 'Event Management';
    if (pathname.includes('/manager/clubs/') && pathname.split('/').length > 5) return 'Club Management';
    if (pathname.includes('/manager/clubs')) return 'My Clubs';
    return 'Dashboard';
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push(loginHref);
    } catch {
      router.push(publicHref);
    }
  };

  // If user is a College Administrator, redirect them to the College Admin Command Center
  React.useEffect(() => {
    if (user && user.role === 'COLLEGE_ADMIN') {
      const adminHref =
        typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
          ? `/college/${slug}/admin`
          : '/admin';
      router.replace(adminHref);
    }
  }, [user, slug, router]);

  // Fetch user's managed clubs to authorize role 'USER' with manager memberships
  const { data: myClubs = [], isLoading: clubsLoading } = useMyClubsQuery(slug, !!user && user.role !== 'COLLEGE_ADMIN');

  // Auth Guard: In PostgreSQL RLS, manager user.role is 'USER' with active manager memberships
  const isManager = myClubs.length > 0;
  const isAuthorized = Boolean(user && (user.role === 'MANAGER' || isManager));
  const validating = authLoading || (user && user.role !== 'COLLEGE_ADMIN' && !isAuthorized && clubsLoading);

  if (user && user.role === 'COLLEGE_ADMIN') {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-[#0B0C10] text-white' : 'bg-[#FAF9F5] text-[#0F172A]'
        }`}
      >
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#B08D57] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-[#B08D57]">
            College Administrator detected. Redirecting to Admin Command Center...
          </p>
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-[#0B0C10] text-white' : 'bg-[#FAF9F5] text-[#0F172A]'
        }`}
      >
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Validating Manager Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    const isStudentWithoutClubs = Boolean(user && user.role === 'USER' && !isManager);
    const studentHref =
      typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
        ? `/college/${slug}/student`
        : '/student';

    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-[#0B0C10] text-white' : 'bg-[#FAF9F5] text-[#0F172A]'
        }`}
      >
        <div
          className={`max-w-md w-full p-8 rounded-3xl border shadow-xl text-center space-y-5 ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
              isStudentWithoutClubs
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}
          >
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="font-['Syne',sans-serif] text-xl font-black uppercase">
              {isStudentWithoutClubs ? 'No Managed Clubs Assigned' : 'Manager Access Required'}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isStudentWithoutClubs ? (
                <>
                  Your account is active, but you have not been assigned as a manager to any student clubs in{' '}
                  <strong className="text-[#00F0FF]">{slug ? slug.toUpperCase() : 'this campus'}</strong> yet.
                  Please ask your College Administrator to link you to a club in the College Admin Portal.
                </>
              ) : (
                <>
                  This workspace is restricted to authorized Club and Event Managers of{' '}
                  <strong className="text-[#00F0FF]">{slug ? slug.toUpperCase() : 'this campus'}</strong>.
                </>
              )}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {isStudentWithoutClubs ? (
              <>
                <Link
                  href={studentHref}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 transition"
                >
                  <span>Go to Student Portal</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-bold uppercase tracking-wider transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`${loginHref}?returnUrl=${encodeURIComponent(pathname)}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Manager Portal Login</span>
                </Link>

                <Link
                  href={publicHref}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-full border text-xs font-bold uppercase tracking-wider transition ${
                    isDark
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Return to Public Directory</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex font-sans antialiased transition-colors duration-300 ${
        isDark ? 'bg-[#0B0C10] text-slate-100 dark' : 'bg-[#FAF9F5] text-[#0F172A]'
      }`}
    >
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r flex flex-col justify-between transition-all duration-300 transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDark
            ? 'bg-[#12141C] border-white/10 shadow-2xl'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div
            className={`py-4 px-6 flex items-center justify-between border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <Link href={dashboardHref} className="flex flex-col gap-1 cursor-pointer group">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-blue-600 flex items-center justify-center text-black font-black shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform shrink-0">
                  <span className="font-['Syne',sans-serif] text-2xl font-black leading-none">4</span>
                </div>
                <div className="flex flex-col justify-center leading-none">
                  <span className="text-[10px] font-black tracking-[0.25em] text-[#00F0FF] uppercase leading-none mb-0.5">
                    THE
                  </span>
                  <span
                    className={`font-['Syne',sans-serif] text-xl font-black tracking-tight leading-none ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    PEOPLE<span className="text-[#00F0FF]">.</span>
                  </span>
                </div>
              </div>
              <div className="pl-[50px]">
                <span className="text-[8px] font-black uppercase tracking-wider text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded-full inline-block border border-[#00F0FF]/25">
                  Club Manager
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={`lg:hidden p-1.5 rounded-lg border transition ${
                isDark ? 'border-white/10 text-gray-400 hover:text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === dashboardHref
                  ? pathname === dashboardHref
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                    isActive
                      ? isDark
                        ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/25'
                        : 'bg-[#0F172A] text-white shadow-md'
                      : isDark
                        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Controls */}
        <div
          className={`p-4 border-t space-y-3 ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              {isDark ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
            </span>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-700'
              }`}
            >
              {isDark ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Public Portal Link */}
          <Link
            href={publicHref}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition ${
              isDark
                ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>Public Directory</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </Link>

          {/* Profile Quick Access */}
          {user && (
            <Link
              href={profileHref}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition group shadow-xs ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] font-black text-xs shrink-0 group-hover:bg-[#00F0FF] group-hover:text-black transition-all">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p
                  className={`text-xs font-bold group-hover:text-[#00F0FF] transition truncate ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  {user.name || 'Club Manager'}
                </p>
                <p className={`text-[10px] truncate font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  {user.email}
                </p>
              </div>
            </Link>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 hover:bg-rose-500 hover:text-white border text-xs font-extrabold uppercase tracking-wider rounded-2xl transition-all cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 text-gray-400 hover:border-transparent'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-transparent'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <header
          className={`h-16 px-6 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md transition-colors ${
            isDark
              ? 'bg-[#12141C]/90 border-white/10 text-white'
              : 'bg-white/90 border-slate-200 text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`lg:hidden p-2 rounded-xl border ${
                isDark
                  ? 'bg-white/5 border-white/10 text-gray-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="uppercase text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                {slug ? slug.toUpperCase() : 'CAMPUS'}
              </span>
              <span className={isDark ? 'text-gray-600' : 'text-slate-300'}>/</span>
              <span className={`uppercase tracking-wider font-extrabold ${isDark ? 'text-gray-200' : 'text-slate-900'}`}>
                {getBreadcrumb()}
              </span>
            </div>
          </div>

          {/* Quick Theme Toggle Icon */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 text-xs font-extrabold ${
              isDark
                ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </header>

        {/* Viewport Outlet */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default ManagerLayout;
