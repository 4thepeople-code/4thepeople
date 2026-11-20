'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMyClubsQuery } from '@/lib/api/manager';
import ManagerLayout from '@/components/manager/ManagerLayout';
import {
  Building2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Plus,
} from 'lucide-react';

export interface MyClubsPageClientProps {
  slug: string;
}

export function MyClubsPageClient({ slug }: MyClubsPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  const {
    data: clubs = [],
    isLoading: loading,
    isError,
    error: errObj,
    refetch,
  } = useMyClubsQuery(slug);

  const filteredClubs = clubs.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-6">
        {/* Header Banner */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  Club Portfolio
                </span>
                <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">
                  {slug ? slug.toUpperCase() : 'CAMPUS'}
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
                My Managed Clubs
              </h1>
              <p className="mt-1 text-xs text-[var(--ink-soft)] max-w-xl">
                Select a club to edit details, upload logos & cover photos, manage campus events, and organize photo galleries.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
              <input
                type="text"
                placeholder="Filter clubs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] pl-10 pr-4 py-2 text-xs font-medium text-[var(--ink)] placeholder-[var(--ink-soft)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-all"
              />
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {isError && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 p-4 flex items-center justify-between text-xs font-medium text-rose-800 dark:text-rose-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                {(errObj as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                  'Failed to load your assigned clubs.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-xs font-bold uppercase rounded-lg transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[var(--line)]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-28 rounded bg-[var(--line)]" />
                    <div className="h-3 w-16 rounded bg-[var(--line)]" />
                  </div>
                </div>
                <div className="h-3 w-3/4 rounded bg-[var(--line)]" />
                <div className="h-8 rounded-xl bg-[var(--line)]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !isError && clubs.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-[var(--line)] bg-[var(--surface)] space-y-3">
            <Building2 className="h-12 w-12 text-[var(--ink-soft)] mx-auto opacity-60" />
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">No Managed Clubs Assigned</h3>
            <p className="text-xs text-[var(--ink-soft)] max-w-sm mx-auto">
              You haven&apos;t been assigned to manage any clubs yet — please contact your college administrator.
            </p>
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && !isError && clubs.length > 0 && filteredClubs.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
            <Search className="h-8 w-8 text-[var(--ink-soft)] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[var(--ink-soft)]">
              No managed clubs match your search filter &quot;{searchQuery}&quot;.
            </p>
          </div>
        )}

        {/* Clubs Grid */}
        {!loading && !isError && filteredClubs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClubs.map((club) => {
              const logoUrl = club.logoUrl || club.logo?.url;
              const initials = club.name ? club.name.slice(0, 2).toUpperCase() : 'CL';
              const clubHref = getPath(`/manager/clubs/${club.id}`);
              const createEventHref = getPath(`/manager/clubs/${club.id}/events/create`);

              return (
                <div
                  key={club.id}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={club.name}
                          className="h-12 w-12 rounded-xl object-cover border border-[var(--line)] shrink-0"
                        />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] font-display text-base font-bold text-[var(--primary)]">
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <Link
                          href={clubHref}
                          className="font-display font-bold text-base text-[var(--ink)] hover:text-[var(--primary)] transition-colors truncate block"
                        >
                          {club.name}
                        </Link>
                        <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full inline-block mt-0.5">
                          Manager Access
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--ink-soft)] line-clamp-2 leading-relaxed">
                      {club.description || 'No description provided for this campus club.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--line)] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[var(--ink-soft)]">
                      {club.members ? `${club.members.length} members` : 'Active'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={createEventHref}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/50 transition-colors"
                        title="Create event for this club"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Event</span>
                      </Link>
                      <Link
                        href={clubHref}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-strong)] transition-colors"
                      >
                        <span>Manage</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

export default MyClubsPageClient;
