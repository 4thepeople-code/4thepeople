'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getRoleNav, isNavActive } from './navConfig';
import BrandLogo from '@/components/BrandLogo';
import { studentLoginHref } from '@/lib/auth/roleRedirect';
import { actions, brand, shell } from '@/lib/copy';

export interface StudentShellProps {
  slug: string;
  collegeName?: string;
  children: React.ReactNode;
}

/**
 * Campus-look shell for the student workspace (the single light theme). Visual
 * sibling of the public college chrome: cream page, warm-ink borders,
 * shadow-brutal accents, Anton/Sora type. Manager and admin dashboards keep
 * the shared DashboardShell — this variant is mounted only by
 * StudentDashboardFrame, so nothing here can change their behavior.
 *
 * Deliberately has no theme toggle: dark is blocked on the student segment
 * (see lib/routing/themeSurface). Nav items, active states and logout behavior
 * match DashboardShell exactly (navConfig is the single source).
 */
export default function StudentShell({ slug, collegeName, children }: StudentShellProps) {
  const nav = getRoleNav('student', slug);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Same scroll cue as the public campus navbar.
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Esc closes the drawer; focus returns to the hamburger.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll and focus the drawer while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    window.location.href = studentLoginHref(slug);
  };

  const desktopLinkClass = (active: boolean) =>
    `inline-flex min-h-11 items-center text-sm font-semibold transition-colors motion-reduce:transition-none ${
      active
        ? 'font-bold text-[var(--accent-strong)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  const drawerLinkClass = (active: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${
      active
        ? 'bg-[var(--surface-tile)] font-bold text-[var(--accent-strong)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
    }`;

  const navList = (onNavigate?: () => void) => (
    <nav aria-label={shell.mainNavLabel} className="flex-1 space-y-6 px-3 pb-6">
      {nav.sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {section.title}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item, pathname);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href ?? '#'}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={drawerLinkClass(active)}
                  >
                    <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brandBlock = (
    <Link href={nav.sections[0]?.items[0]?.href ?? '#'} className="group flex min-h-11 items-center gap-2.5">
      <BrandLogo size="md" className="text-[var(--text-primary)]" />
      <span aria-hidden className="hidden h-4 w-px bg-[var(--border-strong)] sm:inline-block" />
      <span className="hidden font-display text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] sm:inline">
        {collegeName ?? brand.name}
      </span>
    </Link>
  );

  const primary = nav.primaryAction;
  const PrimaryIcon = primary.icon;

  return (
    <div className="college-scope student-scope min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <a
        href="#student-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--surface-inverse)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--text-inverse)]"
      >
        {shell.skipToContent}
      </a>

      {/* Topbar */}
      <header
        className={`sticky top-0 z-40 border-b bg-[var(--surface-page)]/90 backdrop-blur-md transition-all duration-300 motion-reduce:transition-none ${
          isScrolled ? 'border-[var(--border-strong)] shadow-brutal-xs' : 'border-[var(--border-soft)]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={shell.openMenu}
              aria-expanded={drawerOpen}
              aria-controls="student-drawer"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] md:hidden motion-reduce:transition-none"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
            {brandBlock}
          </div>

          {/* Desktop nav */}
          <nav aria-label={shell.mainNavLabel} className="hidden items-center gap-6 md:flex">
            {nav.sections.flatMap((section) =>
              section.items.map((item) => {
                const active = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href ?? '#'}
                    aria-current={active ? 'page' : undefined}
                    className={desktopLinkClass(active)}
                  >
                    {item.label}
                  </Link>
                );
              }),
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={primary.href ?? '#'}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] motion-reduce:transition-none sm:px-5"
            >
              <PrimaryIcon aria-hidden="true" className="h-4 w-4" />
              <span>{primary.label}</span>
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label={actions.logOut}
              className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
            >
              <LogOut aria-hidden="true" className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main
        id="student-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
      >
        {children}
      </main>

      {/* Mobile drawer (below md) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            aria-label={shell.closeDrawer}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={shell.drawerLabel}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r-2 border-[var(--border-strong)] bg-[var(--surface-page)] shadow-brutal-lg outline-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="px-2 pt-2">{brandBlock}</div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={shell.closeMenu}
                className="m-2 grid h-11 w-11 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            {navList(() => setDrawerOpen(false))}
            <div className="mt-auto border-t-2 border-dashed border-[var(--border-soft)] px-3 py-4">
              {user && (
                <p className="px-3 pb-2 text-xs text-[var(--text-muted)]">
                  <span className="sr-only">{shell.signedInAs}: </span>
                  <span className="font-semibold text-[var(--text-primary)]">{user.name ?? user.email}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
              >
                <LogOut aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                {actions.logOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
