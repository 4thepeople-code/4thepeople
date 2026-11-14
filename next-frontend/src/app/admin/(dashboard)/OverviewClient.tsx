'use client';

import { useState } from 'react';
import {
  Building2,
  Clock,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlatformCollegesQuery } from '@/lib/api/platform';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, emptyStates, superAdmin } from '@/lib/copy';

/**
 * Super Admin overview. Every number is a client-side tally of the colleges
 * list — labelled exactly as what it counts (no invented platform metrics).
 */
export default function OverviewClient() {
  const { refreshSession } = useAuth();
  const { toast } = useToast();
  const t = superAdmin.overview;

  const { data: colleges = [], isLoading, isError, refetch } = usePlatformCollegesQuery();
  const [verifying, setVerifying] = useState(false);

  const total = colleges.length;
  const active = colleges.filter((c) => c.isActive).length;
  const awaitingAdmin = colleges.filter((c) => !c.admin).length;
  const pendingInvites = colleges.filter(
    (c) => c.admin && (c.admin.status === 'PENDING_ACTIVATION' || c.admin.status === 'INVITATION_EXPIRED'),
  ).length;

  const handleVerifySession = async () => {
    setVerifying(true);
    try {
      await refreshSession();
      toast(t.sessionVerified, { variant: 'success' });
    } catch {
      toast(t.sessionFailed, { variant: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <PageHeader
        role="superAdmin"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={handleVerifySession}
            loading={verifying}
            loadingLabel={t.verifyingSession}
            leftIcon={verifying ? undefined : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.verifySession}
          </DashboardButton>
        }
      />

      {/* Honest aggregates from the colleges list */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.statColleges} value={total} icon={Building2} loading={isLoading} tone="brand" />
        <StatCard
          label={t.statActiveColleges}
          value={active}
          icon={Globe}
          loading={isLoading}
          tone="success"
        />
        <StatCard
          label={t.statAwaitingAdmin}
          value={awaitingAdmin}
          icon={UserPlus}
          loading={isLoading}
          tone="neutral"
        />
        <StatCard
          label={t.statPendingInvites}
          value={pendingInvites}
          icon={Clock}
          loading={isLoading}
          tone="warning"
        />
      </div>
      <p className="mt-3 text-xs text-[var(--ink-soft)]">{t.honestNote}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Onboarded colleges (live data) */}
        <DashboardCard className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.onboardedTitle}</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.onboardedDescription}</p>
            </div>
            <DashboardButton variant="ghost" size="sm" href="/admin/colleges">
              {t.openColleges}
            </DashboardButton>
          </div>

          {isLoading ? (
            <div role="status">
              <SkeletonLines count={4} />
            </div>
          ) : isError ? (
            <EmptyState
              title={emptyStates.loadingFailed.title}
              description={emptyStates.loadingFailed.description}
            >
              <div className="mt-4">
                <DashboardButton variant="secondary" size="sm" onClick={() => refetch()}>
                  {actions.retry}
                </DashboardButton>
              </div>
            </EmptyState>
          ) : colleges.length === 0 ? (
            <EmptyState
              title={t.noCollegesTitle}
              description={t.noCollegesDescription}
              actionLabel={superAdmin.colleges.addCollege}
              actionHref="/admin/colleges"
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {colleges.map((college) => (
                <li key={college.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-[var(--ink)]">{college.name}</h3>
                      <Chip variant="neutral">{college.code}</Chip>
                      {college.isActive ? (
                        <Chip variant="success" dot>
                          {superAdmin.colleges.statusActive}
                        </Chip>
                      ) : (
                        <Chip variant="neutral" dot>
                          {superAdmin.colleges.statusDeactivated}
                        </Chip>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--ink-soft)]">
                      {college.admin
                        ? `${college.admin.name} · ${college.admin.email}`
                        : superAdmin.colleges.noAdminAssigned}
                    </p>
                  </div>
                  <DashboardButton variant="secondary" size="sm" href="/admin/colleges" className="shrink-0 self-start sm:self-auto">
                    {superAdmin.colleges.viewCollege}
                  </DashboardButton>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Security posture (static facts, kept from the old overview) */}
        <DashboardCard>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.securityTitle}</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.securityDescription}</p>
          <ul className="mt-4 space-y-3">
            <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
              <div className="flex items-center gap-2">
                <Lock aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--ink)]">{t.securityHost}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{t.securityHostDetail}</p>
            </li>
            <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
              <div className="flex items-center gap-2">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-[var(--secondary)]" />
                <span className="text-xs font-bold text-[var(--ink)]">{t.securityToken}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{t.securityTokenDetail}</p>
            </li>
            <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-[var(--ink)]">{t.securityReplay}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{t.securityReplayDetail}</p>
            </li>
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}
