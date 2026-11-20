'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useClubs } from '@/lib/api/clubs';
import PublicLayout from '@/components/public/PublicLayout';
import CollegeClubCard from '@/components/college/CollegeClubCard';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getClubCategory, DIRECTORY_CATEGORIES, CategoryKey } from '@/lib/utils/categories';

export interface ClubsListPageClientProps {
  slug: string;
}

export function ClubsListPageClient({ slug }: ClubsListPageClientProps) {
  const { data: clubs = [], isLoading, isError, error, refetch } = useClubs(slug);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('ALL');

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const term = searchQuery.toLowerCase().trim();
      const clubCategory = getClubCategory(club);
      const matchesSearch =
        !term ||
        club.name?.toLowerCase().includes(term) ||
        club.description?.toLowerCase().includes(term) ||
        clubCategory.toLowerCase().includes(term);

      const matchesCategory =
        selectedCategory === 'ALL' || clubCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [clubs, searchQuery, selectedCategory]);

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-140px)]">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Campus directory
            </p>
            <div className="mt-3 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <h1 className="font-campus text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                  Find your community
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">
                  Join active student clubs at {collegeDisplay}, connect with passionate peers, and take part in
                  workshops, competitions and campus projects.
                </p>
              </div>

              {/* Search Bar */}
              <div className="w-full lg:w-80">
                <label
                  htmlFor="clubs-search"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Search clubs
                </label>
                <input
                  id="clubs-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clubs by name…"
                  className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] shadow-brutal-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Directory Content Area */}
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Campus directory">
            {DIRECTORY_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory((prev) => (prev === cat ? 'ALL' : cat))}
                  aria-pressed={isSelected}
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 text-xs font-bold uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-strong)] text-white shadow-brutal-xs'
                      : 'border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : cat}
                </button>
              );
            })}
          </div>

          {/* Active Filter Indicator */}
          {selectedCategory !== 'ALL' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--accent-strong)] bg-[var(--surface-tile)] p-3 text-xs font-medium text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)] animate-pulse" />
                Filtering by category: <strong className="font-bold text-[var(--text-primary)]">{selectedCategory}</strong> ({filteredClubs.length} {filteredClubs.length === 1 ? 'club' : 'clubs'} found)
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="font-bold underline hover:no-underline text-[var(--accent-strong)] cursor-pointer"
              >
                Show all clubs
              </button>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {error instanceof Error ? error.message : 'The club directory could not be loaded. Check your connection and try again.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try again</span>
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading clubs">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="h-80 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                />
              ))}
            </div>
          )}

          {/* Empty Directory State */}
          {!isLoading && !isError && clubs.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
              <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                No clubs are listed yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                Student organizations appear here once they are registered at {collegeDisplay}. Meanwhile, you can explore upcoming campus events.
              </p>
              <Link
                href={`/college/${slug}#upcoming-events`}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
              >
                Explore campus events
              </Link>
            </div>
          )}

          {/* No Search Matches */}
          {!isLoading && !isError && clubs.length > 0 && filteredClubs.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
              <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                No clubs match
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                Try a different keyword or clear the search to see every club.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
                className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Clubs Grid */}
          {!isLoading && !isError && filteredClubs.length > 0 && (
            <>
              <div className="flex justify-start lg:justify-end">
                <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                  {filteredClubs.length} {filteredClubs.length === 1 ? 'club' : 'clubs'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredClubs.map((club) => (
                  <CollegeClubCard
                    key={club.id}
                    club={club}
                    href={`/college/${slug}/clubs/${club.id}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

export default ClubsListPageClient;
