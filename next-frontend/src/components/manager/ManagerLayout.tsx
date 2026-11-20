'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMyClubsQuery } from '@/lib/api/manager';
import BrandLogo from '@/components/landing/BrandLogo';
import { LBRCE_LOGO_URL } from '@/components/public/PublicNavbar';
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

  const mainNavItems = [
    { label: 'Overview', href: dashboardHref, icon: LayoutDashboard },
    { label: 'My clubs', href: clubsHref, icon: Building2 },
  ];

  const accountNavItems = [
    { label: 'Profile', href: profileHref, icon: UserIcon },
  ];

  const getBreadcrumb = () => {
    if (pathname.includes('/manager/profile')) return 'Profile Settings';
    if (pathname.includes('/events/')) return 'Event Management';
    if (pathname.includes('/manager/clubs/') && pathname.split('/').length > 5) return 'Club Management';
    if (pathname.includes('/manager/clubs')) return 'My clubs';
    return 'Overview';
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
      <div className="dashboard-scope manager-dashboard-scope min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink)]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
            College Administrator detected. Redirecting to Admin Command Center...
          </p>
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="dashboard-scope manager-dashboard-scope min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink)]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
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
      <div className="dashboard-scope manager-dashboard-scope min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--ink)]">
        <div className="max-w-md w-full p-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xl text-center space-y-5">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
              isStudentWithoutClubs
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-[var(--secondary-soft)] border-[var(--secondary)]/30 text-[var(--secondary)]'
            }`}
          >
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
              {isStudentWithoutClubs ? 'No Managed Clubs Assigned' : 'Manager Access Required'}
            </h2>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
              {isStudentWithoutClubs ? (
                <>
                  Your account is active, but you have not been assigned as a manager to any student clubs in{' '}
                  <strong className="text-[var(--primary)]">{slug ? slug.toUpperCase() : 'this campus'}</strong> yet.
                  Please ask your College Administrator to link you to a club in the College Admin Portal.
                </>
              ) : (
                <>
                  This workspace is restricted to authorized Club and Event Managers of{' '}
                  <strong className="text-[var(--primary)]">{slug ? slug.toUpperCase() : 'this campus'}</strong>.
                </>
              )}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {isStudentWithoutClubs ? (
              <>
                <Link
                  href={studentHref}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] font-semibold text-xs tracking-wide shadow-sm hover:bg-[var(--primary-strong)] transition-colors"
                >
                  <span>Go to Student Portal</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/50 hover:text-[var(--ink)] text-xs font-semibold tracking-wide transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`${loginHref}?returnUrl=${encodeURIComponent(pathname)}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] font-semibold text-xs tracking-wide shadow-sm hover:bg-[var(--primary-strong)] transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Manager Portal Login</span>
                </Link>

                <Link
                  href={publicHref}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--primary)] text-xs font-semibold tracking-wide transition-colors"
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

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav aria-label="Main navigation" className="flex-1 space-y-6 px-3 pt-7 pb-6">
      <div>
        <p className="px-3 pb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Main
        </p>
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === dashboardHref
                ? pathname === dashboardHref
                : pathname.startsWith(item.href);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onItemClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                    isActive
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Account
        </p>
        <ul className="space-y-1">
          {accountNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onItemClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                    isActive
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );

  const isLbrce = slug?.toLowerCase() === 'lbrce';
  const collegeLogoUrl = isLbrce ? LBRCE_LOGO_URL : undefined;

  const renderSidebarBrand = () => (
    <div className="border-b border-[var(--line)] px-5 py-5 pb-6">
      <Link href={dashboardHref} className="group flex items-center gap-3 min-w-0">
        <BrandLogo size="md" />
        <span
          aria-hidden="true"
          className="h-9 w-px bg-[var(--line)] inline-block self-center opacity-70"
        />
        <div className="flex flex-col items-center justify-center shrink-0">
          {collegeLogoUrl ? (
            <img
              src={collegeLogoUrl}
              alt={`${slug.toUpperCase()} Logo`}
              className="h-10 w-10 rounded-full object-contain border border-[var(--line)] bg-white p-0.5 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--primary)] font-display text-xs font-bold text-[var(--on-primary)]">
              {slug ? slug.charAt(0).toUpperCase() : '4'}
            </span>
          )}
          <span className="font-display text-[10px] font-black uppercase tracking-wider text-[var(--ink-soft)] mt-0.5 text-center leading-none group-hover:text-[var(--primary)] transition-colors">
            {slug ? slug.toUpperCase() : 'CAMPUS'}
          </span>
        </div>
      </Link>
      <div className="mt-2.5 flex items-center gap-1.5 px-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
          Event Manager Workspace
        </p>
      </div>
    </div>
  );

  const renderSidebarFooter = () => (
    <div className="border-t border-[var(--line)] px-3 py-4 space-y-2">
      {user && (
        <div className="px-3 pb-1 text-xs text-[var(--ink-soft)]">
          <span className="sr-only">Signed in as: </span>
          <span className="font-semibold text-[var(--ink)] truncate block">
            {user.name || user.email}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          href={publicHref}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)] transition-colors"
          title="Public Campus Directory"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Campus</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-scope manager-dashboard-scope min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans antialiased">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--on-primary)]"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] md:flex">
          {renderSidebarBrand()}
          {renderNavLinks()}
          {renderSidebarFooter()}
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="dashboard-drawer"
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] md:hidden motion-reduce:transition-none"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 flex items-center gap-2">
                <Link href={dashboardHref} className="flex md:hidden items-center gap-2 shrink-0 mr-1">
                  <BrandLogo size="sm" />
                  {collegeLogoUrl && (
                    <img
                      src={collegeLogoUrl}
                      alt="Logo"
                      className="h-7 w-7 rounded-full object-contain bg-white border border-[var(--line)] p-0.5"
                    />
                  )}
                </Link>
                <span className="truncate font-display text-base font-bold text-[var(--ink)] sm:text-lg">
                  {slug ? slug.toUpperCase() : 'CAMPUS'}
                </span>
                <span className="text-[var(--line)] font-normal">/</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)] truncate">
                  {getBreadcrumb()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={
                    myClubs.length === 1
                      ? `/college/${slug}/manager/clubs/${myClubs[0].id}/events/create`
                      : clubsHref
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold tracking-wide transition-colors bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-strong)] shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Create event</span>
                </Link>

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)] transition-colors"
                  title="Toggle Theme"
                >
                  {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </header>

          {/* Viewport Outlet */}
          <main id="dashboard-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40 focus-visible:outline-hidden"
          />
          <div
            id="dashboard-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[var(--line)] bg-[var(--surface)] shadow-xl outline-hidden"
          >
            <div className="flex items-start justify-between">
              {renderSidebarBrand()}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="m-2 grid h-11 w-11 place-items-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileMenuOpen(false))}
            <div className="mt-auto">{renderSidebarFooter()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerLayout;
