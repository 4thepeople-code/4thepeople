'use client';

import { useAuth } from '@/context/AuthContext';
import { useMyRegistrationsQuery } from '@/lib/api/events';
import { useMeQuery } from '@/lib/api/auth';
import CampusPageHeader from '../CampusPageHeader';
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
      <CampusPageHeader title={t.title} description={t.description} />

      <div className="space-y-6 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md">
        {/* Identity */}
        <div className="flex items-center gap-4 border-b-2 border-dashed border-[var(--border-soft)] pb-6">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--accent-soft)] font-display text-xl font-bold text-[var(--accent-strong)]"
          >
            {studentUser?.name ? studentUser.name.slice(0, 2).toUpperCase() : 'ST'}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
              {studentUser?.name || t.noName}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">{t.activeStudent}</p>
          </div>
        </div>

        {/* Institutional details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t.rollNumber}
            </p>
            <p className="truncate font-mono text-sm font-bold text-[var(--text-primary)]">
              {studentUser?.rollNumber || t.noRoll}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t.email}
            </p>
            <p className="truncate text-xs font-bold text-[var(--text-primary)]">{studentUser?.email}</p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t.institution}
            </p>
            <p className="truncate text-xs font-bold text-[var(--text-primary)]">
              {collegeDisplay} ({slug})
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t.status}
            </p>
            <Chip variant="success" dot>
              {t.statusActive}
            </Chip>
          </div>
        </div>

        {/* Registrations stat */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{t.statRegistrations}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{t.statRegistrationsHint}</p>
          </div>
          <span className="font-display text-2xl font-bold text-[var(--accent-strong)]">
            {myRegistrations.length}
          </span>
        </div>
      </div>
    </div>
  );
}
