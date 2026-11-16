
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, Menu, Moon, Sun, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  activeNavItems,
  getRoleNav,
  type DashboardRole,
  type NavItem,
} from './navConfig';
import DashboardButton from './ui/DashboardButton';
import { anton, inter, sora } from './fonts';
import { actions, brand, shell, theme, roleNames } from '@/lib/copy';
import {
  collegeAdminLoginHref,
  managerLoginHref,
  platformLoginHref,
  studentLoginHref,
} from '@/lib/auth/roleRedirect';

export interface DashboardShellSecondaryAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface DashboardShellProps {
  /**
   * User role determines which navigation and workspace are displayed.
   */
  role: DashboardRole;

  /**
   * College slug for college-scoped roles.
   * Super Admin screens do not need one.
   */
  slug?: string;

  /** College display name for the sidebar brand line. */
  collegeName?: string;

  /**
   * Optional secondary topbar action.
   * Example: College Admin's "Invite Event Manager" action.
   */
  secondaryAction?: DashboardShellSecondaryAction;

  /**
   * Optional override for the topbar primary action.
   * Used by the Event Manager workspace for club-aware event creation.
   */
  primaryActionOverride?: NavItem;

  children: ReactNode;
}

function loginHrefFor(role: DashboardRole, slug?: string): string {
  const collegeSlug = slug ?? '';

  switch (role) {
    case 'collegeAdmin':
      return collegeAdminLoginHref(collegeSlug);

    case 'eventManager':
      return managerLoginHref(collegeSlug);

    case 'student':
      return studentLoginHref(collegeSlug);

    case 'superAdmin':
      return platformLoginHref();
  }
}

/**
 * Shared dashboard shell for College Admin, Event Manager,
 * Student (where applicable), and Super Admin workspaces.
 *
 * Desktop: sidebar + topbar + content.
 * Mobile: topbar + navigation drawer.
 */
export default function DashboardShell({
  role,
  slug,
  collegeName,
  secondaryAction,
  primaryActionOverride,
  children,
}: DashboardShellProps) {
  const nav = getRoleNav(role, slug);
  const pathname = usePathname();

  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Dashboard role-specific styling.
  const isManager = role === 'eventManager';
  const isCollegeAdmin = role === 'collegeAdmin';

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Close the drawer with Escape and restore focus to the menu button.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  // Lock body scrolling while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  // Logout and redirect to the correct role-specific login page.
  const handleLogout = async () => {
    await logout();
    window.location.href = loginHrefFor(role, slug);
  };

  // Dashboard navigation.
  const navList = (onNavigate?: () => void) => (
    <nav
      aria-label={shell.mainNavLabel}
      className="flex-1 space-y-6 px-3 pb-6"
    >
      {nav.sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            {section.title}
          </p>

          <ul className="space-y-1">
            {section.items.map((item) => {
              const isActive = activeNavItems(
                section.items,
                pathname
              ).some((navItem) => navItem.href === item.href);

              const Icon = item.icon;

              const className = `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                isActive
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)]'
              }`;

              const inner = (
                <>
                  <Icon
                    aria-hidden="true"
                    className="h-4.5 w-4.5 shrink-0"
                  />
                  {item.label}
                </>
              );

              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={className}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={item.onClick}
                      aria-current={isActive ? 'page' : undefined}
                      className={className}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  // Original 4THEPEOPLE branding.
  // The LBRCE logo will be added separately later.
  const brandBlock = (
    <div className="flex items-center gap-3 px-5 py-5">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary)] font-display text-sm font-bold text-[var(--on-primary)]"
      >
        {brand.name.charAt(0)}
      </span>

      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-[var(--ink)]">
          {collegeName ?? brand.name}
        </p>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
          {roleNames[nav.roleName]} workspace
        </p>
      </div>
    </div>
  );

  // Signed-in user information and logout controls.
  const userBlock = (
    <div className="border-t border-[var(--line)] px-3 py-4">
      {user && (
        <p className="px-3 pb-2 text-xs text-[var(--ink-soft)]">
          <span className="sr-only">{shell.signedInAs}: </span>

          <span className="font-semibold text-[var(--ink)]">
            {user.name ?? user.email}
          </span>
        </p>
      )}

      <div className="flex items-center gap-2 px-1">
        {/* Manager dashboard is permanently light. */}
        {!isManager && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? theme.toggleToLight : theme.toggleToDark}
            className="grid h-11 w-11 place-items-center rounded-xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            {isDark ? (
              <Sun aria-hidden="true" className="h-4.5 w-4.5" />
            ) : (
              <Moon aria-hidden="true" className="h-4.5 w-4.5" />
            )}
          </button>
        )}

        <DashboardButton
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          leftIcon={
            <LogOut aria-hidden="true" className="h-4 w-4" />
          }
        >
          {actions.logOut}
        </DashboardButton>
      </div>
    </div>
  );

  const resolvedPrimary =
    primaryActionOverride ?? nav.primaryAction;

  // Primary dashboard action.
  const primaryAction = (className = '') => {
    if (resolvedPrimary.onClick) {
      return (
        <DashboardButton
          variant="primary"
          size="sm"
          className={className}
          onClick={resolvedPrimary.onClick}
          leftIcon={
            <resolvedPrimary.icon
              aria-hidden="true"
              className="h-4 w-4"
            />
          }
        >
          {resolvedPrimary.label}
        </DashboardButton>
      );
    }

    return (
      <DashboardButton
        href={resolvedPrimary.href ?? '/'}
        size="sm"
        className={className}
        leftIcon={
          <resolvedPrimary.icon
            aria-hidden="true"
            className="h-4 w-4"
          />
        }
      >
        {resolvedPrimary.label}
      </DashboardButton>
    );
  };

  // Optional secondary dashboard action.
  const renderSecondaryAction = (className = '') =>
    secondaryAction ? (
      <DashboardButton
        variant="secondary"
        size="sm"
        onClick={secondaryAction.onClick}
        className={className}
        leftIcon={
          secondaryAction.icon ? (
            <secondaryAction.icon
              aria-hidden="true"
              className="h-4 w-4"
            />
          ) : undefined
        }
      >
        {secondaryAction.label}
      </DashboardButton>
    ) : null;

  return (
    <div
      className={`dashboard-scope ${
        isManager ? 'manager-dashboard-scope' : ''
      } ${
        isCollegeAdmin ? 'college-admin-dashboard-scope' : ''
      } ${anton.variable} ${sora.variable} ${inter.variable} min-h-screen bg-[var(--bg)] text-[var(--ink)]`}
    >
      {/* Skip navigation link for keyboard accessibility. */}
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--on-primary)]"
      >
        {shell.skipToContent}
      </a>

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] md:flex">
          {brandBlock}

          {navList()}

          {userBlock}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                ref={hamburgerRef}
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label={shell.openMenu}
                aria-expanded={drawerOpen}
                aria-controls="dashboard-drawer"
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] md:hidden motion-reduce:transition-none"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </button>

              <p className="min-w-0 flex-1 truncate font-display text-base font-bold text-[var(--ink)] sm:text-lg">
                {collegeName ?? brand.name}
              </p>

              <div className="hidden items-center gap-2 sm:flex">
                {renderSecondaryAction()}
                {primaryAction()}
              </div>

              {/* Manager dashboard has no theme toggle. */}
              {!isManager && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    isDark
                      ? theme.toggleToLight
                      : theme.toggleToDark
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                >
                  {isDark ? (
                    <Sun aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Moon aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </header>

          {/* Main dashboard content */}
          <main
            id="dashboard-content"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="presentation"
        >
          <button
            type="button"
            aria-label={shell.closeDrawer}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          />

          <div
            id="dashboard-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={shell.drawerLabel}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[var(--line)] bg-[var(--surface)] shadow-xl outline-hidden"
          >
            <div className="flex items-start justify-between">
              {brandBlock}

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={shell.closeMenu}
                className="m-2 grid h-11 w-11 place-items-center rounded-xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            {navList(() => setDrawerOpen(false))}

            {secondaryAction && (
              <div className="border-t border-[var(--line)] px-3 py-3">
                {renderSecondaryAction('w-full')}
              </div>
            )}

            <div className={secondaryAction ? '' : 'mt-auto'}>
              {userBlock}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
