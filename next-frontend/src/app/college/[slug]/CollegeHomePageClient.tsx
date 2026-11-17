'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Building2,
} from 'lucide-react';
import { useUpcomingEvents } from '@/lib/api/events';
import { useClubs } from '@/lib/api/clubs';
import { useDepartments } from '@/lib/api/departments';
import { campusPublic } from '@/lib/copy';
import PublicLayout from '@/components/public/PublicLayout';
import HomeHero from '@/components/college/HomeHero';
import EventModal from '@/components/public/EventModal';
import EventCard from '@/components/common/EventCard';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import CampusClubCard from '@/components/college/CampusClubCard';
import type { Event } from '@/types/models';

export interface CollegeHomePageClientProps {
  slug: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatDateParts = (dateString?: string, endDateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: 'Time TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: 'Time TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const weekday = dateObj.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
  let time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (endDateString) {
    const endObj = new Date(endDateString);
    if (!isNaN(endObj.getTime())) {
      const endTime = endObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      time = `${time} - ${endTime}`;
    }
  }

  return { day, month, weekday, time };
};

/** Season label from the current date (e.g. "Fall 2026"). */
const getSeasonLabel = (now = new Date()) => {
  const month = now.getMonth();
  const season = month >= 8 ? 'Fall' : month >= 5 ? 'Summer' : month >= 2 ? 'Spring' : 'Winter';
  return `${season} ${now.getFullYear()}`;
};

/* ------------------------------------------------------------------ */
/* Shared state blocks (loading / empty / error)                       */
/* ------------------------------------------------------------------ */

function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          className="rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-6"
        >
          <div className="h-6 w-28 rounded-full bg-[var(--border-soft)] animate-college-skeleton" />
          <div className="mt-5 h-12 w-36 rounded-xl bg-[var(--border-soft)] animate-college-skeleton" />
          <div className="mt-5 h-4 w-full rounded bg-[var(--border-soft)] animate-college-skeleton" />
          <div className="mt-2 h-4 w-2/3 rounded bg-[var(--border-soft)] animate-college-skeleton" />
          <div className="mt-6 h-24 w-full rounded-2xl bg-[var(--border-soft)] animate-college-skeleton" />
        </div>
      ))}
    </>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

function ErrorBlock({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-8 text-center shadow-brutal-xs md:col-span-2 lg:col-span-3"
    >
      <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        Try again
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Static page copy (platform messaging, not data)                     */
/* ------------------------------------------------------------------ */

const benefits = [
  { title: 'WORD OF MOUTH VERIFIED', description: 'Heard friends talking about a hackathon or concert? Find official timings, venues, and registration links instantly here.', highlight: 'Instant access' },
  { title: 'DIRECT REGISTRATIONS', description: 'No confusing forms. Click through to RSVP or join event queues organized directly by student club leaders.', highlight: 'Quick RSVP' },
  { title: 'DISCOVER YOUR TRIBE', description: 'Connect with communities that match your passion, from coding to dance, theatre to robotics.', highlight: 'Real community' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CollegeHomePageClient({ slug }: CollegeHomePageClientProps) {
  const router = useRouter();

  // TanStack Query Hooks scoped strictly to tenant slug
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useUpcomingEvents(slug);
  const { data: clubs = [], isLoading: clubsLoading, error: clubsError, refetch: refetchClubs } = useClubs(slug);
  const { data: departments = [], isLoading: departmentsLoading, error: departmentsError, refetch: refetchDepartments } = useDepartments(slug);

  // Student Search & Category Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');

  // Modals & Lightbox
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  // Categories derived from real fetched data (events + clubs), nothing hardcoded.
  const derivedCategories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((ev) => {
      const category = ev.category?.trim().toUpperCase();
      if (category) set.add(category);
    });
    clubs.forEach((club) => {
      const category = club.category?.trim().toUpperCase();
      if (category) set.add(category);
    });
    return Array.from(set).sort();
  }, [events, clubs]);

  // Per-category counts derived from the same fetched data (mirror the filter logic).
  const categoryStats = useMemo(
    () =>
      derivedCategories.map((category) => ({
        name: category,
        eventCount: events.filter(
          (ev) => ev.category?.toUpperCase() === category || ev.club?.category?.toUpperCase().includes(category)
        ).length,
        clubCount: clubs.filter((club) => club.category?.toUpperCase() === category).length,
      })),
    [derivedCategories, events, clubs]
  );

  // Hero features the first upcoming event.
  const heroEvent = events[0];
  const heroDateParts = formatDateParts(heroEvent?.startAt || heroEvent?.startDate || heroEvent?.date, heroEvent?.endAt);

  // Spotlight never repeats the hero event: the highest registeredCount among the
  // rest, falling back to the second event. Hidden with fewer than 2 events.
  const spotlightEvent = useMemo(() => {
    const rest = events.slice(1);
    if (rest.length === 0) return null;
    return rest.reduce((best, ev) => ((ev.registeredCount ?? 0) > (best.registeredCount ?? 0) ? ev : best), rest[0]);
  }, [events]);
  const spotlightDateParts = formatDateParts(
    spotlightEvent?.startAt || spotlightEvent?.startDate || spotlightEvent?.date,
    spotlightEvent?.endAt
  );

  // Events for the homepage grid: hero event excluded (it owns the hero slot),
  // optional client-side time window (All | This week | This month), then
  // search + category narrowing.
  const filteredEvents = useMemo(() => {
    const list = events.filter((ev) => ev.id !== heroEvent?.id);
    const timeFiltered =
      timeFilter === 'ALL'
        ? list
        : list.filter((ev) => {
            const startAt = ev.startAt ? new Date(ev.startAt).getTime() : NaN;
            if (Number.isNaN(startAt)) return false;
            const now = new Date();
            if (timeFilter === 'WEEK') {
              const weekStart = new Date(now);
              weekStart.setHours(0, 0, 0, 0);
              weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 7);
              return startAt >= weekStart.getTime() && startAt < weekEnd.getTime();
            }
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return startAt >= monthStart.getTime() && startAt < monthEnd.getTime();
          });
    const q = searchQuery.toLowerCase().trim();
    return timeFiltered.filter((ev) => {
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.club?.name?.toLowerCase().includes(q);

      const matchesCategory =
        activeCategory === 'ALL' ||
        ev.category?.toUpperCase() === activeCategory ||
        ev.club?.category?.toUpperCase().includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [events, timeFilter, searchQuery, activeCategory, heroEvent]);

  const handleNavigateToEvent = (ev: Event) => {
    if (!ev) return;
    router.push(`/college/${slug}/events/${ev.id}`);
  };

  const scrollToEvents = () => {
    const el = document.getElementById('upcoming-events');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const seasonLabel = getSeasonLabel();
  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* Single light campus theme — this scope ignores the global color scheme. */}
      <div className="college-scope">
        {/* 🔴 HIGH-SPEED CAMPUS DISPATCH TICKER */}
        {events.length > 0 && (
          <div className="relative flex h-14 w-full items-center overflow-hidden border-b border-[var(--border-inverse)] bg-[var(--surface-inverse)]">
            <p className="sr-only">Upcoming events ticker</p>
            <ul className="sr-only">
              {events.slice(0, 8).map((ev) => (
                <li key={`ticker-sr-${ev.id}`}>
                  <Link
                    href={`/college/${slug}/events/${ev.id}`}
                    className="focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:border-2 focus:border-[var(--border-strong)] focus:bg-[var(--surface-card)] focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--text-primary)]"
                  >
                    {ev.club?.name || collegeDisplay}: {ev.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div aria-hidden className="relative h-full flex-1 overflow-hidden">
              <div className="animate-scroll-x flex w-max items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
                {[...events, ...events, ...events, ...events].map((ev, idx) => {
                  const dateParts = formatDateParts(ev.startAt || ev.startDate || ev.date);
                  return (
                    <button
                      key={`${ev.id}-${idx}`}
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleNavigateToEvent(ev)}
                      className="mx-1.5 inline-flex h-11 shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-5 py-2 text-left transition-colors hover:border-[var(--border-inverse)] hover:bg-[var(--surface-inverse-tile)]"
                    >
                      <span className="text-[11px] font-black uppercase tracking-widest text-[var(--accent-primary)]">
                        {ev.club?.name || collegeDisplay}
                      </span>
                      <span className="text-xs font-light text-[var(--text-inverse-muted)]">/</span>
                      <span className="whitespace-nowrap text-sm font-semibold text-[var(--text-inverse)]">{ev.title}</span>
                      <span className="ml-1 flex items-center gap-1.5 rounded-md border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">
                        <Calendar className="h-3 w-3 opacity-70" />
                        {dateParts.month} {dateParts.day}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 1. CAMPUS HERO */}
        <HomeHero
          slug={slug}
          collegeDisplay={collegeDisplay}
          seasonLabel={seasonLabel}
          events={events}
          heroEvent={heroEvent}
          heroDateParts={heroDateParts}
          eventsLoading={eventsLoading}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          categories={derivedCategories}
          clubs={clubs}
          clubsLoading={clubsLoading}
        />

        {/* 2. CATEGORY MARQUEE — only when real categories exist */}
        {derivedCategories.length > 0 && (
          <div aria-hidden className="overflow-hidden bg-[var(--surface-inverse)] py-5 text-[var(--text-inverse)]">
            <div className="animate-marquee flex w-max">
              {[0, 1].map((row) => (
                <div key={row} className="flex shrink-0 items-center gap-12 pr-12">
                  {derivedCategories.map((category) => (
                    <span
                      key={`${row}-${category}`}
                      className="font-display whitespace-nowrap text-3xl font-bold uppercase tracking-wide lg:text-4xl"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. UPCOMING EVENTS */}
        <section id="upcoming-events" className="bg-[var(--surface-card)] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 border-b-2 border-[var(--border-soft)] pb-6 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Campus event schedule
                </p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Recent &amp; upcoming events
                </h2>
                <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
                  Full schedules, locations, host clubs, and RSVP details at {collegeDisplay}.
                </p>
              </div>

              {/* Time Filter — All | This week | This month (client-side from startAt) */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'ALL', label: campusPublic.events.filterAll },
                    { id: 'WEEK', label: campusPublic.events.filterThisWeek },
                    { id: 'MONTH', label: campusPublic.events.filterThisMonth },
                  ] as Array<{ id: 'ALL' | 'WEEK' | 'MONTH'; label: string }>
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTimeFilter(option.id)}
                    aria-pressed={timeFilter === option.id}
                    className={`inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                      timeFilter === option.id
                        ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Result Feedback Bar */}
            {searchQuery && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-3 text-xs font-medium text-[var(--text-secondary)]">
                <span>
                  Showing results for &quot;<strong className="font-bold">{searchQuery}</strong>&quot; ({filteredEvents.length} found)
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-11 font-bold underline hover:no-underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Events Grid */}
            {eventsLoading ? (
              <>
                <LoadingRow label="Loading upcoming campus events" />
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <CardSkeletons />
                </div>
              </>
            ) : eventsError ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <ErrorBlock
                  title="Couldn't load events"
                  message="The upcoming events didn't load. Check your connection and try again."
                  onRetry={() => refetchEvents()}
                />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-page)] p-10 text-center shadow-brutal-xs">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-[var(--accent-strong)]" aria-hidden />
                {events.length <= 1 ? (
                  <>
                    <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      No upcoming events are scheduled yet
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                      Clubs post new events as they are announced. Browse the clubs to see what each community is planning.
                    </p>
                    <Link
                      href={`/college/${slug}/clubs`}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                    >
                      Browse clubs
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      No events match your filters
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                      Try a different category, or clear the search and filters to see every upcoming event.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory('ALL');
                        setTimeFilter('ALL');
                      }}
                      className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredEvents.slice(0, 6).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      href={`/college/${slug}/events/${event.id}`}
                      variant="card"
                    />
                  ))}
                </div>
                {filteredEvents.length > 6 && (
                  <div className="mt-10 flex justify-center">
                    <Link
                      href={`/college/${slug}/events`}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-6 py-3 text-sm font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5"
                    >
                      {campusPublic.events.seeAll}
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* 4. SPOTLIGHT BAND — most popular event (top RSVPs), hero excluded */}
        {spotlightEvent && (typeof spotlightEvent.registeredCount === 'number' && spotlightEvent.registeredCount >= campusPublic.events.popularityThreshold) && (
          <section id="spotlight" className="bg-[var(--surface-inverse)] text-[var(--text-inverse)]">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-inverse-muted)]">
                Crowd favourite
              </span>

              <h2 className="font-campus mt-7 text-[44px] uppercase leading-[0.92] tracking-tight text-[var(--text-inverse)] sm:text-[68px]">
                {spotlightEvent.title.toUpperCase()}
              </h2>

              <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center">
                <div>
                  <p className="font-display text-7xl font-bold leading-none text-[var(--text-inverse)]">{spotlightDateParts.day}</p>
                  <p className="font-display mt-2 text-xl font-bold uppercase text-[var(--accent-primary)]">{spotlightDateParts.month}</p>
                  {spotlightEvent.description && (
                    <p className="mt-8 text-lg leading-relaxed text-[var(--text-inverse-muted)]">{spotlightEvent.description}</p>
                  )}
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">Starts</p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">{spotlightDateParts.time}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">Where</p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">
                        {spotlightEvent.venue || spotlightEvent.location || 'Venue to be announced'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">Host club</p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">{spotlightEvent.club?.name || collegeDisplay}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">Attending</p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">
                        {typeof spotlightEvent.registeredCount === 'number' ? `${spotlightEvent.registeredCount} students` : 'Opening soon'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="relative rounded-[2rem] border-2 border-[var(--border-inverse)] bg-[var(--surface-inverse-hover)] px-8 py-12 text-center">
                    {typeof spotlightEvent.registeredCount === 'number' ? (
                      <>
                        <p className="font-display text-6xl font-bold text-[var(--text-inverse)]">{spotlightEvent.registeredCount}</p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-inverse-muted)]">Students are going</p>
                      </>
                    ) : (
                      <p className="font-display text-4xl font-bold uppercase text-[var(--text-inverse)]">Registrations open</p>
                    )}
                    <Link
                      href={`/college/${slug}/events/${spotlightEvent.id}`}
                      className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)] px-8 py-3 text-xl font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5"
                    >
                      Grab your spot
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. CAMPUS CLUBS */}
        <section id="featured-clubs" className="bg-[var(--surface-page)] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 border-b-2 border-[var(--border-soft)] pb-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Student organizations</p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Explore campus clubs
                </h2>
                <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
                  The student communities hosting these events across {collegeDisplay}. Join a club to participate, organize, or lead.
                </p>
              </div>

              <Link
                href={`/college/${slug}/clubs`}
                className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl bg-[var(--surface-inverse)] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)] transition-transform hover:-translate-y-0.5 md:self-end"
              >
                <span>View all clubs</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {/* Clubs Grid */}
            {clubsLoading ? (
              <>
                <LoadingRow label="Loading campus clubs" />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <CardSkeletons />
                </div>
              </>
            ) : clubsError ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ErrorBlock
                  title="Couldn't load clubs"
                  message="The campus clubs didn't load. Check your connection and try again."
                  onRetry={() => refetchClubs()}
                />
              </div>
            ) : clubs.length === 0 ? (
              <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 text-center shadow-brutal-xs">
                <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">No clubs are listed yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                  Student organizations appear here once they are registered at {collegeDisplay}.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {clubs.slice(0, 6).map((club) => (
                  <CampusClubCard key={club.id} club={club} href={`/college/${slug}/clubs/${club.id}`} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 6. ACADEMIC DEPARTMENTS */}
        <section
          id="departments"
          className="border-t-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-page)] py-16 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Academic divisions</p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Departments &amp; chapters
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                  Academic divisions across {collegeDisplay} anchor departmental clubs, student hackathons, and technical symposiums.
                </p>
              </div>

              {!departmentsLoading && departments.length > 0 && (
                <span className="inline-flex items-center self-start rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs md:self-end">
                  {departments.length} departments
                </span>
              )}
            </div>

            {departmentsLoading ? (
              <>
                <LoadingRow label="Loading departments" />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <CardSkeletons />
                </div>
              </>
            ) : departmentsError ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ErrorBlock
                  title="Couldn't load departments"
                  message="The department list didn't load. Check your connection and try again."
                  onRetry={() => refetchDepartments()}
                />
              </div>
            ) : departments.length === 0 ? (
              <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 text-center shadow-brutal-xs">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-[var(--accent-strong)]" aria-hidden />
                <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">No departments are listed yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                  Departments appear here once they are added to {collegeDisplay}.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => (
                  <Link
                    key={dept.id}
                    href={`/college/${slug}/departments/${dept.id}`}
                    className="group block"
                    aria-label={`View the ${dept.name} department`}
                  >
                    <article className="flex h-full flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          {(dept.shortCode || dept.code) && (
                            <span className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                              {dept.shortCode || dept.code}
                            </span>
                          )}
                        </div>

                        <h3 className="font-display mt-4 text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                          {dept.name}
                        </h3>

                        {dept.description && (
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">{dept.description}</p>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-xs font-bold">
                        {typeof dept.clubCount === 'number' && dept.clubCount > 0 && (
                          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                            <Building2 className="h-3.5 w-3.5" aria-hidden />
                            {dept.clubCount} clubs associated
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[var(--accent-strong)] transition-transform group-hover:translate-x-1">
                          <span>Explore</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 7. EVENT CATEGORIES — counts derived from real data */}
        {categoryStats.length > 0 && (
          <section className="border-t-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-page)] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 flex flex-col justify-between gap-4 border-b-2 border-[var(--border-soft)] pb-6 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Browse by interest</p>
                  <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                    Event categories
                  </h2>
                </div>
                <p className="max-w-sm text-xs text-[var(--text-secondary)] sm:text-sm">
                  Pick a discipline to filter the events and clubs on this page.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryStats.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.name);
                      scrollToEvents();
                    }}
                    className="group cursor-pointer rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-5 text-left shadow-brutal-xs transition-transform duration-200 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                        {category.name}
                      </h3>
                      <span className="shrink-0 rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        {category.eventCount > 0 ? `${category.eventCount} events` : ''}
                        {category.eventCount > 0 && category.clubCount > 0 ? ' · ' : ''}
                        {category.clubCount > 0 ? `${category.clubCount} clubs` : ''}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                      <span>Filter events</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 8. WHY JOIN */}
        <section className="bg-[var(--surface-page)] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Student community</p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                Campus is better together.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {benefits.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm sm:p-7"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {item.highlight}
                      </span>
                    </div>

                    <h3 className="font-campus text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)]">{item.title}</h3>

                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 10. EVENT MODAL & GALLERY LIGHTBOX */}
        {selectedEvent && (
          <EventModal
            event={selectedEvent}
            collegeSlug={slug}
            onClose={() => setSelectedEvent(null)}
            onOpenGallery={(ev) => {
              setSelectedEvent(null);
              setActiveGalleryEvent(ev);
            }}
          />
        )}

        {activeGalleryEvent && (
          <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />
        )}
      </div>
    </PublicLayout>
  );
}

export default CollegeHomePageClient;
