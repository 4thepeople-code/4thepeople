'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUpcomingEvents } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import EventCard from '@/components/common/EventCard';
import CampusSectionHeader from '@/components/college/CampusSectionHeader';
import { campusPublic } from '@/lib/copy';

type EventsFilter = 'all' | 'week' | 'month';

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function startOfNextWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 7);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export default function CollegeEventsPageClient({ slug, collegeName }: { slug: string; collegeName: string }) {
  const { data: events = [], isLoading, isError, refetch } = useUpcomingEvents(slug);
  const [filter, setFilter] = useState<EventsFilter>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    const now = new Date();
    const weekStart = startOfWeek(now).getTime();
    const weekEnd = startOfNextWeek(now).getTime();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = startOfNextMonth(now).getTime();
    return events.filter((event) => {
      const startAt = event.startAt ? new Date(event.startAt).getTime() : NaN;
      if (Number.isNaN(startAt)) return false;
      if (filter === 'week') return startAt >= weekStart && startAt < weekEnd;
      return startAt >= monthStart && startAt < monthEnd;
    });
  }, [events, filter]);

  const showEmpty = filteredEvents.length === 0;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeName}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <CampusSectionHeader
          title={campusPublic.events.pageTitle}
          description={campusPublic.events.pageDescription(collegeName)}
          aside={
            <div role="tablist" aria-label={campusPublic.events.filterAll} className="inline-flex rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-1">
              {(
                [
                  { id: 'all', label: campusPublic.events.filterAll },
                  { id: 'week', label: campusPublic.events.filterThisWeek },
                  { id: 'month', label: campusPublic.events.filterThisMonth },
                ] as Array<{ id: EventsFilter; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-colors ${
                    filter === option.id ? 'bg-[var(--accent-strong)] text-[var(--on-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={campusPublic.events.pageTitle}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">The campus events could not be loaded. Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
            >
              {campusPublic.common.retry}
            </button>
          </div>
        ) : showEmpty ? (
          <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <p className="font-campus text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{campusPublic.events.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{campusPublic.events.emptyDescription(collegeName)}</p>
            <Link
              href={`/college/${slug}/clubs`}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {campusPublic.events.emptyAction}
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} href={`/college/${slug}/events/${event.id}`} variant="card" />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
