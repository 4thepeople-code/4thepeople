'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUpcomingEvents } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import CollegeEventCard from '@/components/college/CollegeEventCard';
import EventModal from '@/components/public/EventModal';
import type { Event } from '@/types/models';

export interface EventsListPageClientProps {
  slug: string;
  collegeName?: string;
}

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday-based week
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function EventsListPageClient({ slug, collegeName }: EventsListPageClientProps) {
  const collegeDisplay = (collegeName || slug).toUpperCase();
  const { data: events = [], isLoading, isError, refetch } = useUpcomingEvents(slug);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    const now = new Date();
    const startOfWeek = getStartOfWeek(now).getTime();
    const endOfWeek = new Date(getStartOfWeek(now));
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endOfWeekTime = endOfWeek.getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    return events.filter((e) => {
      const dateStr = e.startAt || e.startDate || e.date;
      const t = dateStr ? new Date(dateStr).getTime() : NaN;
      if (Number.isNaN(t)) return false;
      if (filter === 'week') return t >= startOfWeek && t < endOfWeekTime;
      return t >= startOfMonth && t < endOfMonth;
    });
  }, [events, filter]);

  const isEmpty = !isLoading && !isError && filteredEvents.length === 0;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-200px)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          {/* Header */}
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Campus schedule
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                Campus events
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                Upcoming workshops, competitions and community activities at {collegeDisplay}.
              </p>
            </div>

            {/* Time Filter Tabs */}
            <div className="shrink-0">
              <div
                role="tablist"
                aria-label="Filter events by date"
                className="inline-flex rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-1 shadow-brutal-xs"
              >
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'week' as const, label: 'This week' },
                  { id: 'month' as const, label: 'This month' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-colors cursor-pointer ${
                      filter === item.id
                        ? 'bg-[var(--accent-strong)] text-white shadow-brutal-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading campus events">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : isError ? (
            /* Error State */
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                The campus events could not be loaded. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : isEmpty ? (
            /* Empty State */
            <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center shadow-brutal-xs">
              <p className="font-campus text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                No upcoming events
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                No upcoming events at {collegeDisplay} right now. Check back soon or browse the club directory.
              </p>
              <Link
                href={`/college/${slug}/clubs`}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
              >
                Browse clubs
              </Link>
            </div>
          ) : (
            /* Event Cards Grid */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => (
                <CollegeEventCard
                  key={ev.id}
                  event={ev}
                  href={`/college/${slug}/events/${ev.id}`}
                  onOpenModal={(e) => setSelectedEvent(e)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Event Detail Modal (Popup) */}
        <EventModal
          event={selectedEvent}
          collegeSlug={slug}
          onClose={() => setSelectedEvent(null)}
        />
      </div>
    </PublicLayout>
  );
}

export default EventsListPageClient;
