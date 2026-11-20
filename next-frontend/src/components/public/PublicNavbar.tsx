'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Menu, X, ArrowUpRight, LogIn, Sun, Moon, UserCheck } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from '@/components/landing/BrandLogo';

export const LBRCE_LOGO_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHvJ0dMVhUyk8IUKWPWGpORWnHGX0g8kM--_hNef35mQecPwBGyggUmvY&s=10';

export interface PublicNavbarProps {
  collegeSlug?: string;
  collegeName?: string;
  collegeLogo?: string;
}

export function PublicNavbar({ collegeSlug, collegeName, collegeLogo }: PublicNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const isLbrce = collegeSlug?.toLowerCase() === 'lbrce';
  const logoUrl = collegeLogo || (isLbrce ? LBRCE_LOGO_URL : undefined);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getPath = (subPath: string) => {
    if (collegeSlug && pathname.startsWith(`/college/${collegeSlug}`)) {
      return `/college/${collegeSlug}${subPath === '/' ? '' : subPath}`;
    }
    return subPath;
  };

  const homeHref = getPath('/');
  const eventsHref = `${getPath('/')}#upcoming-events`;
  const clubsHref = getPath('/clubs');
  const departmentsHref = getPath('/departments');
  const loginHref = getPath('/login');
  const studentHref = getPath('/student');
  const managerHref = getPath('/manager');

  // If in a college tenant context, render the college reference navbar
  if (collegeSlug) {
    const isHome = pathname === homeHref || pathname === `/college/${collegeSlug}`;
    const isEvents = pathname.includes('/events');
    const isClubs = pathname.includes('/clubs');
    const isDepts = pathname.includes('/departments');

    return (
      <header
        className={`fixed left-0 right-0 top-0 z-50 border-b bg-[var(--surface-page)] transition-all duration-300 ${
          isScrolled
            ? 'border-[var(--border-soft)] py-3 shadow-sm bg-[var(--surface-page)]/95 backdrop-blur-md'
            : 'border-transparent py-5'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link className="group flex items-center gap-3" href={homeHref}>
              <BrandLogo size="md" variant="dark" />
              <span
                aria-hidden="true"
                className="h-9 w-px bg-[var(--border-strong)] inline-block self-center opacity-60"
              />
              <div className="flex flex-col items-center justify-center">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={`${collegeName || collegeSlug.toUpperCase()} Logo`}
                    className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-contain border border-[var(--border-strong)] bg-white p-0.5 shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="font-display text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] mt-0.5 text-center leading-none group-hover:text-[var(--accent-strong)] transition-colors">
                  {collegeName || collegeSlug.toUpperCase()}
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden items-center gap-6 md:flex" aria-label="College">
              <Link
                className={`inline-flex h-11 items-center text-sm font-semibold transition-colors ${
                  isHome
                    ? 'font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                href={homeHref}
              >
                Home
              </Link>
              <a
                className={`inline-flex h-11 items-center text-sm font-semibold transition-colors ${
                  isEvents
                    ? 'font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                href={eventsHref}
                onClick={(e) => {
                  if (isHome) {
                    e.preventDefault();
                    document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                Events
              </a>
              <Link
                className={`inline-flex h-11 items-center text-sm font-semibold transition-colors ${
                  isClubs
                    ? 'font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                href={clubsHref}
              >
                Clubs Directory
              </Link>
              <Link
                className={`inline-flex h-11 items-center text-sm font-semibold transition-colors ${
                  isDepts
                    ? 'font-bold text-[var(--accent-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                href={departmentsHref}
              >
                Departments
              </Link>
            </nav>

            {/* Right Action Buttons */}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
                <Link
                  href={managerHref}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)]"
                >
                  <UserCheck className="h-3.5 w-3.5 text-orange-600" />
                  <span>Manager Portal</span>
                </Link>
              ) : isAuthenticated && user?.role === 'USER' ? (
                <Link
                  href={studentHref}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)]"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Student Portal</span>
                </Link>
              ) : (
                <Link
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)]"
                  href={loginHref}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Portal Login</span>
                </Link>
              )}

              <Link
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                href={clubsHref}
              >
                <Compass className="h-4 w-4" />
                <span>Explore Clubs</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                aria-expanded={mobileMenuOpen}
                aria-controls="campus-mobile-menu"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)]"
              >
                <span className="sr-only">Open menu</span>
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div
            id="campus-mobile-menu"
            className="border-b-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-4 md:hidden text-[var(--text-primary)]"
          >
            <div className="flex flex-col space-y-1">
              <Link
                href={homeHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 px-3 rounded-lg font-bold text-sm"
              >
                Home
              </Link>
              <a
                href={eventsHref}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  if (isHome) {
                    e.preventDefault();
                    document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="block py-2.5 px-3 rounded-lg font-bold text-sm"
              >
                Events
              </a>
              <Link
                href={clubsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 px-3 rounded-lg font-bold text-sm"
              >
                Clubs Directory
              </Link>
              <Link
                href={departmentsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 px-3 rounded-lg font-bold text-sm"
              >
                Departments
              </Link>

              <div className="pt-3 border-t border-[var(--border-soft)] space-y-2">
                {isAuthenticated && (user?.role === 'MANAGER' || user?.role === 'COLLEGE_ADMIN') ? (
                  <Link
                    href={managerHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2.5 px-3 rounded-lg font-bold text-sm text-orange-600"
                  >
                    Manager Portal
                  </Link>
                ) : isAuthenticated && user?.role === 'USER' ? (
                  <Link
                    href={studentHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2.5 px-3 rounded-lg font-bold text-sm text-emerald-600"
                  >
                    Student Portal
                  </Link>
                ) : (
                  <Link
                    href={loginHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2.5 px-3 rounded-lg font-bold text-sm"
                  >
                    Portal Login
                  </Link>
                )}

                <Link
                  href={clubsHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent-strong)] text-white font-bold text-xs uppercase tracking-wider"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explore Clubs</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  // Fallback default navbar for non-college pages
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
          <Link
            href={homeHref}
            className="group flex items-center gap-2.5 font-extrabold tracking-tight text-xl sm:text-2xl"
          >
            <BrandLogo size="md" variant={isDark ? 'light' : 'dark'} />
          </Link>

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
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>
            <Link
              href={loginHref}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Login</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 rounded-xl border border-slate-300 text-slate-700"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default PublicNavbar;
