'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Menu, X, ArrowUpRight, LogIn, Sun, Moon, UserCheck } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { actions } from '@/lib/copy';
import BrandLogo from '@/components/BrandLogo';

export interface PublicNavbarProps {
  collegeSlug?: string;
  collegeName?: string;
}

export function PublicNavbar({ collegeSlug, collegeName }: PublicNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();

  // College pages (collegeSlug present) render the single-theme campus chrome
  // with no theme toggle. Marketing surfaces (e.g. /directory) keep the
  // original theme-aware chrome and its toggle.
  const campus = Boolean(collegeSlug);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard-operable mobile menu: Escape closes and returns focus to the toggle.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Compute canonical navigation URLs based on whether we are on a direct /college/[slug] path or subdomain
  const getPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${collegeSlug}`)) {
      return `/college/${collegeSlug}${subPath === '/' ? '' : subPath}`;
    }
    return subPath;
  };

  const homeHref = getPath('/');
  const eventsHref = getPath('/events');
  const clubsHref = getPath('/clubs');
  const departmentsHref = getPath('/departments');
  const loginHref = getPath('/login');
  const studentHref = getPath('/student');
  const managerHref = getPath('/manager');

  const scrollToEvents = (event: React.MouseEvent) => {
    if (pathname === homeHref || pathname === '/') {
      event.preventDefault();
      document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /* ================================================================== */
  /* Campus chrome (college pages) — single light theme, no toggle       */
  /* ================================================================== */
  if (campus) {
    const isClubPage = pathname.startsWith(`/college/${collegeSlug}/clubs`);
    const desktopLink = (active: boolean) =>
      `inline-flex h-11 items-center text-sm font-semibold transition-colors ${
        active
          ? 'font-bold text-[var(--accent-strong)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`;

    const portalLink = (active: boolean) =>
      `inline-flex h-11 items-center gap-1.5 rounded-xl border-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${
        active
          ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
          : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
      }`;

    return (
      <header
        className={`fixed left-0 right-0 top-0 z-50 border-b bg-[var(--surface-page)] transition-all duration-300 ${
          isScrolled ? 'border-[var(--border-strong)] py-3 shadow-brutal-xs' : 'border-transparent py-5'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href={homeHref} className="group flex items-center gap-2.5">
              <BrandLogo size="md" className="text-[var(--text-primary)]" />
              <span aria-hidden className="hidden h-4 w-px bg-[var(--border-strong)] sm:inline-block" />
              {collegeName && (
                <span className="hidden font-display text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] sm:inline">
                  {collegeName}
                </span>
              )}
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden items-center gap-6 md:flex" aria-label="College">
              <Link href={homeHref} className={desktopLink(pathname === homeHref || pathname === '/')}>
                Home
              </Link>

              <Link href={eventsHref} className={desktopLink(pathname === eventsHref || pathname.startsWith(`${eventsHref}/`))}>
                Events
              </Link>

              <Link href={clubsHref} className={desktopLink(pathname.includes('/clubs'))}>
                Clubs Directory
              </Link>

              <Link href={departmentsHref} className={desktopLink(pathname.includes('/departments'))}>
                Departments
              </Link>
            </nav>

            {/* Right Actions & Portal Links */}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
                <Link href={managerHref} className={portalLink(pathname.includes('/manager'))}>
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  <span>Manager Portal</span>
                </Link>
              ) : isAuthenticated && user?.role === 'USER' ? (
                <Link href={studentHref} className={portalLink(pathname.includes('/student'))}>
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  <span>Student Portal</span>
                </Link>
              ) : (
                <Link href={loginHref} className={portalLink(false)}>
                  <LogIn className="h-3.5 w-3.5" aria-hidden />
                  <span>Portal Login</span>
                </Link>
              )}

              <Link
                href={isClubPage ? eventsHref : clubsHref}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                <Compass className="h-4 w-4" aria-hidden />
                <span>{isClubPage ? actions.browseEvents : 'Explore Clubs'}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-controls="campus-mobile-menu"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)]"
              >
                <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
                {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div
            id="campus-mobile-menu"
            className="border-b-2 border-[var(--border-strong)] bg-[var(--surface-page)] md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pb-6 pt-4">
              <Link
                href={homeHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                  pathname === homeHref || pathname === '/'
                    ? 'bg-[var(--surface-tile)] font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                }`}
              >
                Home
              </Link>
              <Link
                href={eventsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
              >
                Events
              </Link>
              <Link
                href={clubsHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                  pathname.includes('/clubs')
                    ? 'bg-[var(--surface-tile)] font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                }`}
              >
                Clubs Directory
              </Link>
              <Link
                href={departmentsHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                  pathname.includes('/departments')
                    ? 'bg-[var(--surface-tile)] font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                }`}
              >
                Departments
              </Link>
              {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
                <Link
                  href={managerHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
                >
                  Manager Portal
                </Link>
              ) : isAuthenticated && user?.role === 'USER' ? (
                <Link
                  href={studentHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
                >
                  Student Portal
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
                >
                  Portal Login
                </Link>
              )}

              <div className="mt-2 border-t-2 border-dashed border-[var(--border-soft)] pt-3">
                <Link
                  href={isClubPage ? eventsHref : clubsHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  <Compass className="h-4 w-4" aria-hidden />
                  <span>{isClubPage ? actions.browseEvents : 'Explore Clubs'}</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  /* ================================================================== */
  /* Marketing chrome (e.g. /directory) — original theme-aware look      */
  /* ================================================================== */
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? isDark
            ? 'bg-[#0B0C10]/90 backdrop-blur-md border-b border-white/10 py-3 shadow-2xl shadow-black/60'
            : 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 py-3 shadow-md shadow-slate-900/5'
          : isDark
            ? 'bg-[#0B0C10]/80 backdrop-blur-sm py-5 border-b border-white/5'
            : 'bg-white/80 backdrop-blur-sm py-5 border-b border-slate-200/50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            href={homeHref}
            className="group flex items-center gap-2.5 font-extrabold tracking-tight text-xl sm:text-2xl"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-[#3B82F6] flex items-center justify-center text-black font-black shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
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
              {collegeName && (
                <span className="text-[9px] font-bold tracking-wider text-cyan-400 uppercase mt-0.5">
                  {collegeName}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider">
            <Link
              href={homeHref}
              className={`transition-colors ${
                pathname === homeHref || pathname === '/'
                  ? isDark
                    ? 'text-[#00F0FF]'
                    : 'text-cyan-600 font-extrabold'
                  : isDark
                    ? 'text-gray-300 hover:text-[#00F0FF]'
                    : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Home
            </Link>

            <a
              href={`${homeHref}#upcoming-events`}
              onClick={scrollToEvents}
              className={`transition-colors ${
                isDark ? 'text-gray-300 hover:text-[#00F0FF]' : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Events
            </a>

            <Link
              href={clubsHref}
              className={`transition-colors ${
                pathname.includes('/clubs')
                  ? isDark
                    ? 'text-[#00F0FF]'
                    : 'text-cyan-600 font-extrabold'
                  : isDark
                    ? 'text-gray-300 hover:text-[#00F0FF]'
                    : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Clubs Directory
            </Link>

            <Link
              href={departmentsHref}
              className={`transition-colors ${
                pathname.includes('/departments')
                  ? isDark
                    ? 'text-[#00F0FF]'
                    : 'text-cyan-600 font-extrabold'
                  : isDark
                    ? 'text-gray-300 hover:text-[#00F0FF]'
                    : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Departments
            </Link>
          </nav>

          {/* Right Action, Theme Toggle & Portal Links */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>

            {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
              <Link
                href={managerHref}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                  pathname.includes('/manager')
                    ? 'bg-[#FF5733]/15 border-[#FF5733]/40 text-[#FF5733]'
                    : isDark
                      ? 'text-orange-400 hover:text-white hover:bg-white/5 border-orange-500/30'
                      : 'text-orange-600 hover:text-orange-800 hover:bg-orange-50 border-orange-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#FF5733]" />
                <span>Manager Portal</span>
              </Link>
            ) : isAuthenticated && user?.role === 'USER' ? (
              <Link
                href={studentHref}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                  pathname.includes('/student')
                    ? 'bg-[#00F0FF]/15 border-[#00F0FF]/40 text-[#00F0FF]'
                    : isDark
                      ? 'text-cyan-300 hover:text-white hover:bg-white/5 border-cyan-500/30'
                      : 'text-cyan-700 hover:text-cyan-900 hover:bg-cyan-50 border-cyan-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Student Portal</span>
              </Link>
            ) : (
              <Link
                href={loginHref}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                  isDark
                    ? 'text-gray-300 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Portal Login</span>
              </Link>
            )}

            <Link
              href={clubsHref}
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider overflow-hidden hover:bg-[#38f2ff] transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-black group-hover:rotate-45 transition-transform" />
              <span>Explore Clubs</span>
              <ArrowUpRight className="w-4 h-4 text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile Hamburger Toggle & Mobile Theme Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
              aria-label="Toggle theme mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="marketing-mobile-menu"
              className={`p-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="marketing-mobile-menu"
          className={`md:hidden border-b overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            isDark ? 'bg-[#0F1117] border-white/10' : 'bg-white border-slate-200 shadow-xl'
          }`}
        >
          <div className="px-4 pt-4 pb-6 space-y-3">
            <Link
              href={homeHref}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                pathname === homeHref || pathname === '/'
                  ? isDark
                    ? 'text-[#00F0FF] bg-white/5'
                    : 'text-cyan-600 bg-slate-100 font-bold'
                  : isDark
                    ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
              }`}
            >
              Home
            </Link>
            <a
              href={`${homeHref}#upcoming-events`}
              onClick={(e) => {
                setMobileMenuOpen(false);
                scrollToEvents(e);
              }}
              className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                isDark
                  ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
              }`}
            >
              Events
            </a>
            <Link
              href={clubsHref}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                pathname.includes('/clubs')
                  ? isDark
                    ? 'text-[#00F0FF] bg-white/5'
                    : 'text-cyan-600 bg-slate-100 font-bold'
                  : isDark
                    ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
              }`}
            >
              Clubs Directory
            </Link>
            <Link
              href={departmentsHref}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                pathname.includes('/departments')
                  ? isDark
                    ? 'text-[#00F0FF] bg-white/5'
                    : 'text-cyan-600 bg-slate-100 font-bold'
                  : isDark
                    ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
              }`}
            >
              Departments
            </Link>
            {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
              <Link
                href={managerHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  pathname.includes('/manager')
                    ? isDark
                      ? 'text-[#FF5733] bg-white/5'
                      : 'text-orange-600 bg-slate-100 font-bold'
                    : isDark
                      ? 'text-orange-400 hover:bg-white/5 hover:text-white'
                      : 'text-orange-600 hover:bg-slate-100 hover:text-orange-800'
                }`}
              >
                Manager Portal
              </Link>
            ) : isAuthenticated && user?.role === 'USER' ? (
              <Link
                href={studentHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  pathname.includes('/student')
                    ? isDark
                      ? 'text-[#00F0FF] bg-white/5'
                      : 'text-cyan-600 bg-slate-100 font-bold'
                    : isDark
                      ? 'text-cyan-300 hover:bg-white/5 hover:text-white'
                      : 'text-cyan-700 hover:bg-slate-100 hover:text-cyan-900'
                }`}
              >
                Student Portal
              </Link>
            ) : (
              <Link
                href={loginHref}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Portal Login
              </Link>
            )}

            {/* Mobile Drawer Theme Switch */}
            <div
              className={`pt-3 border-t flex items-center justify-between px-3 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-gray-400' : 'text-slate-600'
                }`}
              >
                Theme Mode
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-amber-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
            </div>

            <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <Link
                href={clubsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20"
              >
                <Compass className="w-4 h-4 text-black" />
                <span>Explore Clubs</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicNavbar;
