import {
  Building2,
  CalendarPlus,
  GraduationCap,
  LayoutDashboard,
  Network,
  Palette,
  Settings,
  Shield,
  Upload,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { actions, nav, type RoleName } from '@/lib/copy';
import {
  adminDashboardHref,
  managerDashboardHref,
  platformDashboardHref,
  studentDashboardHref,
  type DashboardRole,
} from '@/lib/auth/roleRedirect';

export type { DashboardRole };

export interface NavItem {
  label: string;
  /** Route target; not required when an `onClick` handler is supplied. */
  href?: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface RoleNav {
  role: DashboardRole;
  roleName: RoleName;
  /** Shown in the topbar/drawer; usually the college name. */
  sections: NavSection[];
  /**
   * The role's most frequent action, always in the most prominent spot.
   * Event creation stays scoped to a club, so the manager action opens the
   * club list rather than a create form directly.
   */
  primaryAction: NavItem;
}

export function getRoleNav(role: DashboardRole, slug = ''): RoleNav {
  switch (role) {
    case 'collegeAdmin':
      return {
        role,
        roleName: 'collegeAdmin',
        sections: [
          {
            title: nav.sections.main,
            items: [
              { label: 'Overview', href: adminDashboardHref(slug), icon: LayoutDashboard },
              { label: 'Clubs', href: `${adminDashboardHref(slug)}/clubs`, icon: Building2 },
              { label: 'People', href: `${adminDashboardHref(slug)}/users`, icon: UsersRound },
              { label: 'Departments', href: `${adminDashboardHref(slug)}/departments`, icon: Network },
              { label: 'Roster', href: `${adminDashboardHref(slug)}/roster`, icon: Upload },
            ],
          },
          {
            title: nav.sections.account,
            items: [
              { label: 'Profile', href: `${adminDashboardHref(slug)}/profile`, icon: Settings },
            ],
          },
        ],
        primaryAction: { label: actions.addClub, href: `${adminDashboardHref(slug)}/clubs/create`, icon: Building2 },
      };

    case 'eventManager':
      return {
        role,
        roleName: 'eventManager',
        sections: [
          {
            title: nav.sections.main,
            items: [
              { label: 'Overview', href: managerDashboardHref(slug), icon: LayoutDashboard },
              { label: 'My clubs', href: `${managerDashboardHref(slug)}/clubs`, icon: Building2 },
            ],
          },
          {
            title: nav.sections.account,
            items: [
              { label: 'Profile', href: `${managerDashboardHref(slug)}/profile`, icon: Settings },
            ],
          },
        ],
        // Event creation is scoped to a club (/manager/clubs/[clubId]/events/create);
        // the primary action opens the club list where the manager picks a club.
        primaryAction: { label: actions.createEvent, href: `${managerDashboardHref(slug)}/clubs`, icon: CalendarPlus },
      };

    case 'student':
      return {
        role,
        roleName: 'student',
        sections: [
          {
            title: nav.sections.main,
            items: [
              { label: 'My registrations', href: studentDashboardHref(slug), icon: CalendarPlus },
              { label: 'Discover events', href: `${studentDashboardHref(slug)}/events`, icon: Palette },
              { label: 'Certificates', href: `${studentDashboardHref(slug)}/certificates`, icon: GraduationCap },
            ],
          },
          {
            title: nav.sections.account,
            items: [
              { label: 'Profile', href: `${studentDashboardHref(slug)}/profile`, icon: Settings },
            ],
          },
        ],
        primaryAction: { label: actions.browseEvents, href: `${studentDashboardHref(slug)}/events`, icon: Palette },
      };

    case 'superAdmin':
      return {
        role,
        roleName: 'superAdmin',
        sections: [
          {
            title: nav.sections.main,
            items: [
              // Dedicated routes (Phase 2) so deep links and active states work.
              { label: 'Overview', href: platformDashboardHref(), icon: LayoutDashboard },
              { label: 'Colleges', href: `${platformDashboardHref()}/colleges`, icon: Building2 },
              { label: 'Platform admins', href: `${platformDashboardHref()}/admins`, icon: Shield },
            ],
          },
        ],
        primaryAction: {
          label: actions.addCollege,
          href: `${platformDashboardHref()}/colleges`,
          icon: Building2,
        },
      };
  }
}

/** Longest-prefix active check so nested routes highlight their section. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === pathname) return true;
  if (!item.href) return false;
  return pathname.startsWith(`${item.href}/`);
}

/** Picks the single best-matching item (deepest href wins). */
export function activeNavItems(items: NavItem[], pathname: string): NavItem[] {
  const matches = items.filter((item) => isNavActive(item, pathname));
  if (matches.length <= 1) return matches;
  const deepest = matches.reduce((a, b) =>
    (b.href?.length ?? 0) > (a.href?.length ?? 0) ? b : a,
  );
  return [deepest];
}
