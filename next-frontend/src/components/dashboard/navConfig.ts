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
  href: string;
  icon: LucideIcon;
  /**
   * Interim targets: some screens are single pages with internal tabs today.
   * Later phases either move those tabs to routes or make them read ?tab=.
   */
  interim?: boolean;
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
   * Targets are existing routes until the matching screen is redesigned.
   */
  primaryAction: NavItem;
}

export function getRoleNav(role: DashboardRole, slug: string): RoleNav {
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
        // Event creation lives inside a club page today; Phase 3 gives it a
        // direct home. Until then this opens the club list.
        primaryAction: { label: actions.createEvent, href: `${managerDashboardHref(slug)}/clubs`, icon: CalendarPlus, interim: true },
      };

    case 'student':
      return {
        role,
        roleName: 'student',
        sections: [
          {
            title: nav.sections.main,
            items: [
              // The student dashboard is one page with internal tabs today;
              // Phase 4 makes these read ?tab=.
              { label: 'Discover events', href: studentDashboardHref(slug), icon: Palette, interim: true },
              { label: 'My registrations', href: studentDashboardHref(slug), icon: CalendarPlus, interim: true },
              { label: 'Certificates', href: studentDashboardHref(slug), icon: GraduationCap, interim: true },
            ],
          },
          {
            title: nav.sections.account,
            items: [
              { label: 'Profile', href: studentDashboardHref(slug), icon: Settings, interim: true },
            ],
          },
        ],
        primaryAction: { label: actions.browseEvents, href: studentDashboardHref(slug), icon: Palette, interim: true },
      };

    case 'superAdmin':
      return {
        role,
        roleName: 'superAdmin',
        sections: [
          {
            title: nav.sections.main,
            items: [
              // /admin is a single page with internal tabs today; Phase 2 makes
              // these read ?tab=.
              { label: 'Colleges', href: platformDashboardHref(), icon: Building2, interim: true },
              { label: 'Platform admins', href: platformDashboardHref(), icon: Shield, interim: true },
            ],
          },
        ],
        primaryAction: { label: actions.addCollege, href: platformDashboardHref(), icon: Building2, interim: true },
      };
  }
}

/** Longest-prefix active check so nested routes highlight their section. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === pathname) return true;
  return pathname.startsWith(`${item.href}/`);
}

/** Picks the single best-matching item (deepest href wins). */
export function activeNavItems(items: NavItem[], pathname: string): NavItem[] {
  const matches = items.filter((item) => isNavActive(item, pathname));
  if (matches.length <= 1) return matches;
  const deepest = matches.reduce((a, b) => (b.href.length > a.href.length ? b : a));
  return [deepest];
}
