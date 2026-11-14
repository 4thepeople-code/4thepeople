'use client';

import {
  ArrowRight,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useAllUsersQuery, useAdminClubsQuery } from '@/lib/api/admin';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { useOpenInviteManager } from './CollegeAdminFrame';
import { actions, collegeAdmin, emptyStates } from '@/lib/copy';

export interface DashboardClientProps {
  slug: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * College Admin overview. Same data as before (useAllUsersQuery +
 * useAdminClubsQuery) and the same honest counting logic — only presentation
 * changed. The global "Invite Event Manager" entry lives in the shell's
 * secondary action, so this page doesn't need its own modal.
 */
export default function DashboardClient({ slug }: DashboardClientProps) {
  const t = collegeAdmin.dashboard;
  const openInviteManager = useOpenInviteManager();

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useAllUsersQuery(slug);

  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsError,
    refetch: refetchClubs,
  } = useAdminClubsQuery(slug);

  const loading = usersLoading || clubsLoading;
  const hasError = usersError || clubsError;

  // Same tally as the old dashboard: pending (inactive, non-admin) accounts
  // plus anyone holding a MANAGER membership.
  const uniqueManagerIds = new Set<string>();
  users.forEach((u) => {
    if (!u.isActive && u.role !== 'COLLEGE_ADMIN') {
      uniqueManagerIds.add(u.id);
    }
    if (u.memberships) {
      u.memberships.forEach((m) => {
        if (m.role === 'MANAGER') uniqueManagerIds.add(u.id);
      });
    }
  });

  const sortedClubs = [...clubs]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const handleRefresh = () => {
    void refetchUsers();
    void refetchClubs();
  };

  const quickActions: Array<{
    label: string;
    hint: string;
    href?: string;
    onClick?: () => void;
    icon: typeof Building2;
  }> = [
    {
      label: t.createClub,
      hint: t.createClubHint,
      href: adminPath(slug, '/clubs/create'),
      icon: Building2,
    },
    {
      label: t.inviteManager,
      hint: t.inviteManagerHint,
      onClick: openInviteManager,
      icon: UserPlus,
    },
    {
      label: t.uploadRoster,
      hint: t.uploadRosterHint,
      href: adminPath(slug, '/roster'),
      icon: FileSpreadsheet,
    },
    {
      label: t.reviewAccounts,
      hint: t.reviewAccountsHint,
      href: adminPath(slug, '/users'),
      icon: UsersRound,
    },
  ];

  return (
    <div>
      <PageHeader
        role="collegeAdmin"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {actions.retry}
          </DashboardButton>
        }
      />

      {/* Live tallies from the users + clubs lists */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t.statAccounts}
          value={users.length}
          hint={t.statAccountsHint}
          icon={UsersRound}
          loading={usersLoading}
          tone="brand"
        />
        <StatCard
          label={t.statClubs}
          value={clubs.length}
          hint={t.statClubsHint}
          icon={Building2}
          loading={clubsLoading}
          tone="accent"
        />
        <StatCard
          label={t.statManagers}
          value={uniqueManagerIds.size}
          hint={t.statManagersHint}
          icon={ShieldCheck}
          loading={usersLoading}
          tone="success"
        />
      </div>

      {hasError && (
        <div
          role="alert"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-[var(--ink-soft)]">{emptyStates.loadingFailed.description}</p>
          <DashboardButton variant="secondary" size="sm" onClick={handleRefresh}>
            {actions.retry}
          </DashboardButton>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent clubs */}
        <DashboardCard className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.recentClubs}</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.recentClubsHint}</p>
            </div>
            <DashboardButton variant="ghost" size="sm" href={adminPath(slug, '/clubs')}>
              {t.viewAllClubs}
            </DashboardButton>
          </div>

          {loading ? (
            <div role="status" aria-label={t.viewAllClubs}>
              <SkeletonLines count={4} />
            </div>
          ) : sortedClubs.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={t.noClubsTitle}
              description={t.noClubsDescription}
              actionLabel={actions.addClub}
              actionHref={adminPath(slug, '/clubs/create')}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {sortedClubs.map((club) => (
                <li key={club.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {club.logo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={club.logo.url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-xl border border-[var(--line)] object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] font-display text-sm font-bold text-[var(--primary)]"
                      >
                        {club.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-[var(--ink)]">{club.name}</h3>
                        <Chip variant={club.isCentral ? 'warning' : 'neutral'}>
                          {club.isCentral ? t.chipCentral : t.chipDepartmental}
                        </Chip>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
                        {club.description || t.noDescription}
                      </p>
                    </div>
                  </div>
                  <DashboardButton
                    variant="secondary"
                    size="sm"
                    href={adminPath(slug, `/clubs/${club.id}`)}
                    className="shrink-0 self-start sm:self-auto"
                  >
                    {t.viewClub}
                  </DashboardButton>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Quick actions */}
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.quickActions}</h2>
          <DashboardCard className="mt-4 space-y-2.5">
            {quickActions.map((action) => {
              const inner = (
                <>
                  <span className="flex min-w-0 items-center gap-3">
                    <action.icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0 text-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[var(--ink)]">{action.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--ink-soft)]">{action.hint}</span>
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[var(--ink-soft)] transition-transform duration-150 motion-reduce:transition-none group-hover:translate-x-0.5"
                  />
                </>
              );
              const classes =
                'group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]';
              return action.href ? (
                <Link key={action.label} href={action.href} className={classes}>
                  {inner}
                </Link>
              ) : (
                <button key={action.label} type="button" onClick={action.onClick} className={classes}>
                  {inner}
                </button>
              );
            })}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
