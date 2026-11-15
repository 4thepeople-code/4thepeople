'use client';

import { useAuth } from '@/context/AuthContext';
import { useMyRegistrationsQuery } from '@/lib/api/events';
import { useMeQuery } from '@/lib/api/auth';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import Chip from '@/components/dashboard/ui/Chip';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { student } from '@/lib/copy';

export interface ProfileClientProps {
  slug: string;
}

/**
 * Student "Profile": read-only institutional account details (roll number,
 * email, tenant, verification status) plus a registration count. The student
 * profile has no editable fields today; if editing arrives later it lands in
 * this screen, not a new route.
 */
export default function ProfileClient({ slug }: ProfileClientProps) {
  const t = student.profile;
  const { user } = useAuth();

  const { data: profileData, isLoading } = useMeQuery(slug);
  const { data: myRegistrations = [] } = useMyRegistrationsQuery(slug, true);

  const collegeDisplay = slug.toUpperCase();
  const studentUser =
    (profileData as unknown as { user?: typeof user } | null)?.user || user;

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <SkeletonLines count={2} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader role="student" title={t.title} description={t.description} />

      <DashboardCard className="space-y-6">
        {/* Identity */}
        <div className="flex items-center gap-4 border-b border-[var(--line)] pb-6">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] font-display text-xl font-bold text-[var(--primary)]"
          >
            {studentUser?.name ? studentUser.name.slice(0, 2).toUpperCase() : 'ST'}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
              {studentUser?.name || t.noName}
            </h2>
            <p className="text-xs text-[var(--ink-soft)]">{t.activeStudent}</p>
          </div>
        </div>

        {/* Institutional details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.rollNumber}
            </p>
            <p className="truncate font-mono text-sm font-bold text-[var(--ink)]">
              {studentUser?.rollNumber || t.noRoll}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.email}
            </p>
            <p className="truncate text-xs font-bold text-[var(--ink)]">{studentUser?.email}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.institution}
            </p>
            <p className="truncate text-xs font-bold text-[var(--ink)]">
              {collegeDisplay} ({slug})
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.status}
            </p>
            <Chip variant="success" dot>
              {t.statusActive}
            </Chip>
          </div>
        </div>

        {/* Registrations stat */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{t.statRegistrations}</p>
            <p className="text-[11px] text-[var(--ink-soft)]">{t.statRegistrationsHint}</p>
          </div>
          <span className="font-display text-2xl font-bold text-[var(--primary)]">
            {myRegistrations.length}
          </span>
        </div>
      </DashboardCard>
    </div>
  );
}
