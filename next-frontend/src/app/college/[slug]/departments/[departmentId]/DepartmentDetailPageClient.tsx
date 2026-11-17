'use client';

import React from 'react';
import Link from 'next/link';
import { useDepartment } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import CampusPageHero from '@/components/college/CampusPageHero';
import CampusSectionHeader from '@/components/college/CampusSectionHeader';
import CampusChip from '@/components/college/CampusChip';
import CampusClubCard from '@/components/college/CampusClubCard';
import { campusPublic } from '@/lib/copy';

export interface DepartmentDetailPageClientProps {
  slug: string;
  departmentId: string;
}

const t = campusPublic.departmentDetail;

export function DepartmentDetailPageClient({ slug, departmentId }: DepartmentDetailPageClientProps) {
  const { data: department, isLoading, isError, error, refetch } = useDepartment(slug, departmentId);

  const collegeDisplay = slug.toUpperCase();

  const isNotFound =
    !isLoading &&
    (isError && (error instanceof Error && error.message.includes('404')) || !department);

  const clubs = Array.isArray(department?.clubs) ? department.clubs : [];

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* Loading state */}
      {isLoading && (
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8" role="status" aria-label={t.loadingLabel}>
          <div className="h-48 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            ))}
          </div>
        </div>
      )}

      {/* Not found state */}
      {!isLoading && (isNotFound || !department) && !isError && (
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
          <div className="space-y-4 rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t.notFoundTitle}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.notFoundDescription}</p>
            <Link
              href={`/college/${slug}/departments`}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              <span aria-hidden className="mr-1.5">
                ←
              </span>
              {t.notFoundAction}
            </Link>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && !isNotFound && (
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {error instanceof Error ? error.message : t.errLoad}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
            >
              {campusPublic.common.retry}
            </button>
          </div>
        </div>
      )}

      {/* Department content */}
      {!isLoading && !isError && department && (
        <>
          <CampusPageHero
            backHref={`/college/${slug}/departments`}
            backLabel={t.backLabel}
            eyebrow={department.shortCode || department.code || t.noCode}
            title={department.name}
            description={department.description || t.noDescription}
          >
            <CampusChip>{t.affiliatedPill(clubs.length)}</CampusChip>
          </CampusPageHero>

          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <section>
              <CampusSectionHeader
                eyebrow={t.clubsEyebrow}
                title={t.clubsTitle}
                description={t.clubsDescription(department.name, collegeDisplay)}
              />

              {clubs.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
                  <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    {t.noClubsTitle}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t.noClubsDescription}
                  </p>
                  <Link
                    href={`/college/${slug}/departments`}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                  >
                    <span aria-hidden className="mr-1.5">
                      ←
                    </span>
                    {t.noClubsAction}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {clubs.map((club) => (
                    <CampusClubCard key={club.id} club={club} href={`/college/${slug}/clubs/${club.id}`} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </PublicLayout>
  );
}

export default DepartmentDetailPageClient;
