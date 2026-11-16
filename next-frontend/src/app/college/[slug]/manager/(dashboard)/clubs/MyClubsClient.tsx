'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calendar,
  CalendarPlus,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useMyClubsQuery } from '@/lib/api/manager';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { actions, emptyStates, eventManager, roleNames } from '@/lib/copy';
import { useOpenCreateEvent } from '../ManagerDashboardFrame';

export interface MyClubsClientProps {
  slug: string;
}

/**
 * Event Manager "My Managed Clubs": search and filter over assigned clubs,
 * high-contrast club cards matching the homepage visual language, and direct
 * management shortcuts.
 */
export default function MyClubsClient({ slug }: MyClubsClientProps) {
  const t = eventManager.myClubs;
  const em = eventManager.dashboard;
  const openCreateEvent = useOpenCreateEvent();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: clubs = [],
    isLoading,
    isError,
    refetch,
  } = useMyClubsQuery(slug);

  const filteredClubs = clubs.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
              {roleNames.eventManager}
            </span>
            {slug && (
              <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
                {slug.toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-4xl">
            My Managed <span className="italic font-bold text-[var(--primary)]">Clubs</span>
          </h1>
          <p className="mt-2 max-w-2xl text-xs text-[var(--ink-soft)] sm:text-sm">
            {t.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {actions.retry}
          </DashboardButton>
          <DashboardButton
            variant="primary"
            size="sm"
            onClick={openCreateEvent}
            leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}
          >
            {actions.createEvent}
          </DashboardButton>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
        />
        <input
          type="search"
          aria-label={t.searchPlaceholder}
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] pl-10 pr-10 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:outline-hidden focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--line)]/50 hover:text-[var(--ink)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div>
        {isError ? (
          <EmptyState
            icon={Building2}
            title={emptyStates.loadingFailed.title}
            description={emptyStates.loadingFailed.description}
            actionLabel={actions.retry}
            onAction={() => void refetch()}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t.loadingLabel}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredClubs.length === 0 ? (
          clubs.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={t.emptyTitle}
              description={t.emptyDescription}
              actionLabel={actions.createEvent}
              onAction={openCreateEvent}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={t.emptySearchTitle}
              description={t.emptySearchFix}
              actionLabel="Clear search"
              onAction={() => setSearchQuery('')}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClubs.map((club) => {
              const membersCount = club.members?.length || club.memberCount || 0;
              return (
                <article
                  key={club.id}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {club.logo?.url ? (
                          <img
                            src={club.logo.url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-2xl border border-[var(--line)] object-cover shadow-xs"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--primary-soft)] font-display text-base font-bold text-[var(--primary)] shadow-xs"
                          >
                            {club.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-base font-bold text-[var(--ink)]">
                            {club.name}
                          </h3>
                          <p className="truncate text-xs font-semibold text-[var(--primary)]">
                            {roleNames.eventManager}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)] min-h-[2.5rem]">
                      {club.description || em.noDescription}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-soft)]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Users aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                        <span>
                          {membersCount} {membersCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      {club.category && (
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
                          <span>{club.category}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
                    <Link
                      href={`/college/${slug}/manager/clubs/${club.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      <span>{em.manageClub}</span>
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/college/${slug}/manager/clubs/${club.id}/events/create`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{em.createEventForClub}</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
