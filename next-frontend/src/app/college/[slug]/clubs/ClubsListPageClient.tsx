'use client';

import React, { useState, useMemo } from 'react';
import { useClubs } from '@/lib/api/clubs';
import PublicLayout from '@/components/public/PublicLayout';
import CampusClubCard from '@/components/college/CampusClubCard';
import CampusChip from '@/components/college/CampusChip';
import { campusPublic } from '@/lib/copy';

export interface ClubsListPageClientProps {
  slug: string;
}

const t = campusPublic.clubsDirectory;

export function ClubsListPageClient({ slug }: ClubsListPageClientProps) {
  const { data: clubs = [], isLoading, isError, error, refetch } = useClubs(slug);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !term ||
        club.name?.toLowerCase().includes(term) ||
        club.description?.toLowerCase().includes(term) ||
        club.category?.toLowerCase().includes(term);

      const matchesCategory =
        selectedCategory === 'ALL' ||
        (club.category && club.category.toUpperCase().includes(selectedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [clubs, searchQuery, selectedCategory]);

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* Header band (derived from the campus design language — no demo page exists) */}
      <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
        <div aria-hidden className="absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15" />
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
            <div className="w-full lg:w-80">
              <label htmlFor="clubs-search" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t.searchLabel}
              </label>
              <input
                id="clubs-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.eyebrow}>
          {t.categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={active}
                className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-wider transition-colors motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                  active
                    ? 'bg-[var(--accent-strong)] text-[var(--on-primary)]'
                    : 'border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                }`}
              >
                {cat === 'ALL' ? cat.charAt(0) + cat.slice(1).toLowerCase() : cat}
              </button>
            );
          })}
        </div>

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
              <div key={n} className="h-80 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {/* Empty state — no clubs registered at this college (feature not yet in use) */}
        {!isLoading && !isError && clubs.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              {t.emptyDescription(collegeDisplay)}
            </p>
            <a
              href={`/college/${slug}#events`}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {t.emptyAction}
            </a>
          </div>
        )}

        {/* Empty search/filter state */}
        {!isLoading && !isError && clubs.length > 0 && filteredClubs.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.noMatchesTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.noMatchesFix}</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
            >
              {t.clearSearch}
            </button>
          </div>
        )}

        {/* Clubs grid */}
        {!isLoading && !isError && filteredClubs.length > 0 && (
          <>
            <div className="flex justify-start lg:justify-end">
              <CampusChip>{t.countPill(filteredClubs.length)}</CampusChip>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <CampusClubCard key={club.id} club={club} href={`/college/${slug}/clubs/${club.id}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}

export default ClubsListPageClient;
