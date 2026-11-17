'use client';

import React, { useState, useMemo } from 'react';
import { useDepartments } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import CampusChip from '@/components/college/CampusChip';
import { campusPublic } from '@/lib/copy';

export interface DepartmentsListPageClientProps {
  slug: string;
}

const t = campusPublic.departmentsList;

export function DepartmentsListPageClient({ slug }: DepartmentsListPageClientProps) {
  const { data: rawDepartments = [], isLoading, isError, error, refetch } = useDepartments(slug);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDepartments = useMemo(() => {
    return rawDepartments.filter((dept) => {
      const term = searchQuery.toLowerCase().trim();
      if (!term) return true;
      return (
        dept.name?.toLowerCase().includes(term) ||
        dept.shortCode?.toLowerCase().includes(term) ||
        dept.code?.toLowerCase().includes(term) ||
        dept.description?.toLowerCase().includes(term)
      );
    });
  }, [rawDepartments, searchQuery]);

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* Header band */}
      <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
        <div aria-hidden className="absolute -right-16 top-0 h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{t.eyebrow}</p>
          <div className="mt-3 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-campus text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                {t.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">{t.description(collegeDisplay)}</p>
            </div>

            {/* Search */}
            {!isLoading && !isError && rawDepartments.length > 0 && (
              <div className="w-full lg:w-80">
                <label htmlFor="departments-search" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {t.searchLabel}
                </label>
                <input
                  id="departments-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Error state */}
        {isError && (
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
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t.loadingLabel}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {/* Empty state — no departments at this college (feature not yet in use) */}
        {!isLoading && !isError && rawDepartments.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              {t.emptyDescription(collegeDisplay)}
            </p>
            <a
              href={`/college/${slug}#clubs`}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {campusPublic.clubsDirectory.emptyAction}
            </a>
          </div>
        )}

        {/* Empty search state */}
        {!isLoading && !isError && rawDepartments.length > 0 && filteredDepartments.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.noMatchesTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.noMatchesFix}</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
            >
              {t.clearSearch}
            </button>
          </div>
        )}

        {/* Departments grid */}
        {!isLoading && !isError && filteredDepartments.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDepartments.map((dept) => {
              const clubCount = dept.clubCount ?? (dept.clubs ? dept.clubs.length : 0);
              return (
                <a
                  key={dept.id}
                  href={`/college/${slug}/departments/${dept.id}`}
                  className="group flex h-full cursor-pointer flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                  aria-label={`${t.viewDepartment}: ${dept.name}`}
                >
                  <div>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <CampusChip variant="accent">{dept.shortCode || dept.code || t.noCode}</CampusChip>
                      <CampusChip>{t.clubsPill(clubCount)}</CampusChip>
                    </div>

                    <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                      {dept.name}
                    </h3>

                    <p className="mt-3 line-clamp-3 text-sm font-medium text-[var(--text-secondary)]">
                      {dept.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-[var(--border-soft)] pt-4">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">{t.viewDepartment}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default DepartmentsListPageClient;
