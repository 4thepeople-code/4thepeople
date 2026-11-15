'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { useMyClubsQuery } from '@/lib/api/manager';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { Input } from '@/components/dashboard/ui/Field';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { actions, eventManager, emptyStates } from '@/lib/copy';

export interface MyClubsClientProps {
  slug: string;
}

/**
 * Event Manager "My Managed Clubs": search over managed clubs, loading
 * skeleton, error + retry, empty state, filtered empty state, and a club grid.
 * Presentation moved to the new UI system; same useMyClubsQuery hook.
 */
export default function MyClubsClient({ slug }: MyClubsClientProps) {
  const t = eventManager.myClubs;
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
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        role="eventManager"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {actions.retry}
          </DashboardButton>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
        />
        <Input
          type="search"
          aria-label={t.searchPlaceholder}
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <EmptyState
            title={emptyStates.loadingFailed.title}
            description={emptyStates.loadingFailed.description}
            actionLabel={actions.retry}
            onAction={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label={t.loadingLabel}>
            <SkeletonLines count={4} />
          </div>
        ) : filteredClubs.length === 0 ? (
          clubs.length === 0 ? (
            <EmptyState icon={Building2} title={t.emptyTitle} description={t.emptyDescription} />
          ) : (
            <EmptyState icon={Search} title={t.emptySearchTitle} description={t.emptySearchFix} />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClubs.map((club) => (
              <Link
                key={club.id}
                href={`/college/${slug}/manager/clubs/${club.id}`}
                className="group rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="flex items-center gap-3">
                  {club.logo?.url ? (
                    <img src={club.logo.url} alt="" className="h-11 w-11 rounded-xl border border-[var(--line)] object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] font-display text-sm font-bold text-[var(--primary)]">
                      {club.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold text-[var(--ink)]">{club.name}</h3>
                    <p className="text-xs text-[var(--ink-soft)]">{club.description || eventManager.dashboard.noDescription}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
                    {club.members?.length || club.memberCount || 0} {club.members?.length === 1 ? 'member' : 'members'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-extrabold text-[var(--primary)] uppercase tracking-wider">
                    {t.viewClub}
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
