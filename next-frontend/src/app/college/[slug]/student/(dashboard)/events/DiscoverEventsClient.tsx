'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, MapPin, Palette, RefreshCw } from 'lucide-react';
import { useMyRegistrationsQuery, useUpcomingEvents } from '@/lib/api/events';
import CampusPageHeader from '../CampusPageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import Field, { Input, Select } from '@/components/dashboard/ui/Field';
import { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { actions, emptyStates, student } from '@/lib/copy';

export interface DiscoverEventsClientProps {
  slug: string;
}

const CATEGORIES = ['ALL', 'TECH', 'CULTURAL', 'SPORTS', 'WORKSHOP'] as const;

function formatFullDate(dateStr?: string, fallback = 'Date to be announced') {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Student "Discover events": upcoming campus events with search + category
 * filter, registered badges, and links into the public event page for
 * details/RSVP. Same events API hooks as before.
 */
export default function DiscoverEventsClient({ slug }: DiscoverEventsClientProps) {
  const t = student.discover;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const {
    data: upcomingEvents = [],
    isLoading,
    isError,
    refetch,
  } = useUpcomingEvents(slug);

  const { data: myRegistrations = [] } = useMyRegistrationsQuery(slug, true);

  const registeredEventIds = useMemo(
    () => new Set(myRegistrations.map((r) => r.eventId)),
    [myRegistrations],
  );

  const filtersActive = Boolean(searchQuery.trim()) || selectedCategory !== 'ALL';

  const filteredEvents = useMemo(
    () =>
      upcomingEvents.filter((ev) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          ev.title?.toLowerCase().includes(q) ||
          ev.description?.toLowerCase().includes(q) ||
          ev.location?.toLowerCase().includes(q) ||
          ev.club?.name?.toLowerCase().includes(q);

        const matchesCategory =
          selectedCategory === 'ALL' ||
          (ev.category && ev.category.toUpperCase().includes(selectedCategory));

        return matchesSearch && matchesCategory;
      }),
    [upcomingEvents, searchQuery, selectedCategory],
  );

  return (
    <div className="space-y-6">
      <CampusPageHeader
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.refresh}
          </DashboardButton>
        }
      />

      {/* Search + category filter */}
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
        <div className="sm:max-w-sm">
          <Field label={t.searchLabel} htmlFor="discover-search">
            <Input
              id="discover-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </Field>
        </div>
        <Field label={t.categoryLabel} htmlFor="discover-category">
          <Select
            id="discover-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="sm:w-52"
          >
            <option value="ALL">{t.categoryAll}</option>
            {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t.loadingLabel}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <EmptyState
          icon={Calendar}
          title={emptyStates.loadingFailed.title}
          description={t.errLoad}
          actionLabel={actions.retry}
          onAction={() => void refetch()}
        />
      ) : filteredEvents.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={Calendar}
            title={t.noMatchesTitle}
            description={t.noMatchesFix}
          />
        ) : (
          <EmptyState
            icon={Palette}
            title={t.noEventsTitle}
            description={t.noEventsDescription}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((ev) => {
            const isRegistered = registeredEventIds.has(ev.id);
            return (
              <Link
                key={ev.id}
                href={`/college/${slug}/events/${ev.id}`}
                className="group flex flex-col justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-brutal-sm transition-shadow duration-200 hover:shadow-brutal-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Events have no category field yet — neutral chip, not a colored pill. */}
                    <Chip variant="neutral">{ev.category || 'EVENT'}</Chip>
                    {isRegistered && (
                      <Chip variant="success" dot>
                        {t.registeredBadge}
                      </Chip>
                    )}
                  </div>

                  <div>
                    <h3 className="line-clamp-1 font-display text-base font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent-strong)]">
                      {ev.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      {ev.club?.name || 'Campus event'}
                    </p>
                  </div>

                  <div className="space-y-1 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-3 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                      <span className="truncate">{formatFullDate(ev.startAt, t.noDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                      <span className="truncate">{ev.location || t.noVenue}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-[var(--border-soft)] pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)]">
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                    {isRegistered ? t.viewRsvp : t.viewDetails}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-[var(--text-secondary)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
