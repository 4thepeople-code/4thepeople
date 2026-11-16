'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Users,
  Search,
  X,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useUpcomingEvents } from '@/lib/api/events';
import { useClubs } from '@/lib/api/clubs';
import { useDepartments } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import EventModal from '@/components/public/EventModal';
import GalleryLightbox from '@/components/public/GalleryLightbox';
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

/**
 * First real image URL from the backend (Cloudinary uploads). Returns null when
 * the record has no upload — callers render a neutral token tile instead of a
 * stock photo, so nothing pretends to be real content.
 */
const resolveImageUrl = (...urls: Array<string | null | undefined>): string | null => {
  for (const url of urls) {
    if (typeof url === 'string' && url.trim() !== '') return url;
  }
  return null;
};

const eventImageUrl = (event: Event) =>
  resolveImageUrl(event.coverImageUrl, event.coverUrl, event.bannerUrl, event.coverImage?.url);

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
  { num: '01', title: 'WORD OF MOUTH VERIFIED', description: 'Heard friends talking about a hackathon or concert? Find official timings, venues, and registration links instantly here.', highlight: 'Instant access' },
  { num: '02', title: 'DIRECT REGISTRATIONS', description: 'No confusing forms. Click through to RSVP or join event queues organized directly by student club leaders.', highlight: 'Quick RSVP' },
  { num: '03', title: 'DISCOVER YOUR TRIBE', description: 'Connect with communities that match your passion, from coding to dance, theatre to robotics.', highlight: 'Real community' },
  { num: '04', title: 'BUILD EXPERIENCES', description: 'Turn ideas into memories. Participate, volunteer, or lead teams in campus-wide events.', highlight: 'Hands-on leadership' },
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

  // Modals & Lightbox
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  // Filter events based on search and category
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
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
  }, [events, searchQuery, activeCategory]);

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
              <div className="animate-scroll-x flex w-max items-center hover:[animation-play-state:paused]">
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
        <section className="relative overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)]">
          <div aria-hidden className="absolute -left-20 bottom-0 h-96 w-96 rounded-full border-[16px] border-[var(--border-soft)]" />

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
            <div className="flex flex-col gap-12 min-[900px]:grid min-[900px]:grid-cols-[1.4fr_1fr] min-[900px]:items-end min-[900px]:gap-16">
              <div className="max-w-4xl">
                {/* Season badge — "Now booking" only with at least one upcoming event. */}
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-brutal-sm">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]" />
                  {events.length > 0 ? `Now booking · ${seasonLabel}` : seasonLabel}
                </span>

                {heroEvent ? (
                  <>
                    <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
                      ★ Next up · {heroDateParts.weekday} {heroDateParts.month} {heroDateParts.day}
                    </p>
                    <h1 className="font-campus mt-4 text-[40px] uppercase leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-[64px] lg:text-[88px]">
                      {heroEvent.title.toUpperCase()}
                    </h1>
                    {heroEvent.description && (
                      <p className="mt-6 max-w-xl text-lg leading-snug text-[var(--text-secondary)]">{heroEvent.description}</p>
                    )}

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-[var(--surface-inverse)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)]">
                        {heroDateParts.time}
                      </span>
                      <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        {heroEvent.venue || heroEvent.location || 'Venue to be announced'}
                      </span>
                    </div>

                    <div className="mt-9 flex flex-wrap items-center gap-4">
                      <Link
                        href={`/college/${slug}/events/${heroEvent.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-8 py-3 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                      >
                        View event details
                        {typeof heroEvent.registeredCount === 'number' ? ` · ${heroEvent.registeredCount} going` : ''}
                      </Link>
                      <button
                        type="button"
                        onClick={scrollToEvents}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-8 py-3 text-base font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5"
                      >
                        Browse the lineup
                      </button>
                    </div>
                  </>
                ) : (
                  <h1 className="font-campus mt-8 text-[40px] uppercase leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-[64px] lg:text-[88px]">
                    Every event.
                    <br />
                    One place.
                  </h1>
                )}

                {/* Instant Search Bar */}
                <div className="relative mt-10 max-w-xl">
                  <div className="flex items-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-1.5 shadow-brutal-sm">
                    <div className="pl-3.5 pr-2 text-[var(--text-secondary)]">
                      <Search className="h-5 w-5" aria-hidden />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by event title, club name, or venue…"
                      aria-label="Search events"
                      className="w-full bg-transparent py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mr-1 grid min-h-11 min-w-11 place-items-center rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={scrollToEvents}
                      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl bg-[var(--surface-inverse)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)] transition-colors hover:bg-[var(--surface-inverse-hover)]"
                    >
                      Find
                    </button>
                  </div>
                </div>

                {/* Quick Category Filter Pills — derived from real data */}
                {derivedCategories.length > 0 && (
                  <div className="mt-4 flex max-w-xl items-center gap-2 overflow-x-auto pb-2">
                    <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Quick filter:
                    </span>
                    {['ALL', ...derivedCategories].slice(0, 6).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        aria-pressed={activeCategory === category}
                        className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                          activeCategory === category
                            ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                            : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Stats Strip — real counts */}
                <div className="mt-6 flex items-center gap-6 border-t-2 border-[var(--border-soft)] pt-5 text-xs font-medium text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden />
                    <span>
                      <strong className="text-sm font-bold text-[var(--text-primary)]">
                        {eventsLoading ? '…' : events.length}
                      </strong>{' '}
                      events scheduled
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden />
                    <span>
                      <strong className="text-sm font-bold text-[var(--text-primary)]">
                        {clubsLoading ? '…' : clubs.length}
                      </strong>{' '}
                      campus clubs
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: featured-event poster (real upload, else neutral tile) */}
              {heroEvent && (
                <div className="w-full max-w-sm min-[900px]:justify-self-end">
                  {eventsLoading ? (
                    <div aria-hidden className="aspect-[4/5] rotate-2 rounded-2xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg">
                      <div className="h-full w-full rounded-[13px] bg-[var(--border-soft)] animate-college-skeleton" />
                    </div>
                  ) : (
                    <Link
                      href={`/college/${slug}/events/${heroEvent.id}`}
                      className="group block rounded-2xl"
                      aria-label={`View details for ${heroEvent.title}`}
                    >
                      <div className="relative aspect-[4/5] rotate-2 rounded-2xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg transition-transform duration-200 will-change-transform group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:rotate-0 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
                        {eventImageUrl(heroEvent) ? (
                          <img
                            src={eventImageUrl(heroEvent) as string}
                            alt={`Poster for ${heroEvent.title}`}
                            className="h-full w-full rounded-[13px] object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col justify-end rounded-[13px] bg-[var(--accent-primary)] p-6">
                            <span className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-primary)]">
                              ★ Featured event
                            </span>
                            <p className="font-campus mt-3 text-4xl uppercase leading-[0.95] text-[var(--text-primary)]">
                              {heroEvent.title}
                            </p>
                          </div>
                        )}
                        <span className="absolute -left-2 -top-3 rounded-xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                          {heroDateParts.month} {heroDateParts.day}
                        </span>
                      </div>
                    </Link>
                  )}

                  {!eventsLoading && (
                    <div className="mt-5 flex flex-col items-start gap-1.5">
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">
                        {heroEvent.venue || heroEvent.location || 'Venue to be announced'}
                      </p>
                      {typeof heroEvent.registeredCount === 'number' && (
                        <p className="text-sm text-[var(--text-muted)]">{heroEvent.registeredCount} students going</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

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
                  Recent &amp; upcoming <span className="text-[var(--accent-primary)]">events</span>
                </h2>
                <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
                  Full schedules, locations, host clubs, and RSVP details at {collegeDisplay}.
                </p>
              </div>

              {/* Category Filter Bar — derived from real data */}
              {derivedCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {['ALL', ...derivedCategories].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      aria-pressed={activeCategory === category}
                      className={`inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                        activeCategory === category
                          ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                          : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
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
                {events.length === 0 ? (
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
                      }}
                      className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => {
                  const dateParts = formatDateParts(event.startAt || event.startDate || event.date, event.endAt);
                  const status = (event.status || 'Upcoming').toUpperCase();

                  return (
                    <Link key={event.id} href={`/college/${slug}/events/${event.id}`} className="group block" aria-label={`View details for ${event.title}`}>
                      <article className="flex h-full flex-col rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-inverse)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-inverse)]">
                            {status === 'ONGOING' && (
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                            )}
                            {status.toLowerCase()}
                          </span>
                          <span className="font-display text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            {dateParts.weekday}
                          </span>
                        </div>

                        <div className="mt-5 flex items-end gap-3">
                          <span className="font-display text-6xl font-bold leading-none text-[var(--text-primary)]">{dateParts.day}</span>
                          <span className="font-display pb-1 text-xl font-bold uppercase text-[var(--text-primary)]">{dateParts.month}</span>
                        </div>

                        <h3 className="font-display mt-5 text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]" title={event.title}>
                          {event.title}
                        </h3>
                        <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
                          {event.club?.name || collegeDisplay}
                          {event.category ? ` · ${event.category}` : ''}
                        </p>
                        {event.description && (
                          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{event.description}</p>
                        )}

                        <div className="mt-6 grid gap-2 rounded-2xl bg-[var(--surface-tile)] p-4 text-sm font-medium text-[var(--text-secondary)]">
                          <p className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {dateParts.time}
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{event.venue || event.location || 'Venue to be announced'}</span>
                          </p>
                          {typeof event.registeredCount === 'number' && (
                            <p className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {event.registeredCount} students going
                            </p>
                          )}
                        </div>

                        <span className="mt-5 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-bold text-white">
                          View details &amp; RSVP
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                        </span>
                      </article>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 4. SPOTLIGHT BAND — highest registeredCount excluding the hero event */}
        {spotlightEvent && (
          <section id="spotlight" className="bg-[var(--surface-inverse)] text-[var(--text-inverse)]">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-inverse-muted)]">
                ★ Crowd favourite
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
                  <div aria-hidden className="absolute -inset-6 -rotate-3 rounded-[2rem] bg-[var(--accent-primary)]" />
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
                      className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)] px-8 py-3 text-xl font-bold text-[var(--text-primary)] transition-transform hover:-rotate-1"
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
                  Explore campus <span className="text-[var(--accent-primary)]">clubs</span>
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
                {clubs.slice(0, 6).map((club) => {
                  const clubImage = resolveImageUrl(
                    club.coverImageUrl,
                    club.coverImage?.url,
                    club.coverUrl,
                    club.bannerUrl,
                    club.logoUrl,
                    club.logo?.url
                  );
                  const memberCount = club._count?.members ?? club.membersCount ?? club.memberCount;

                  return (
                    <Link key={club.id} href={`/college/${slug}/clubs/${club.id}`} className="group block" aria-label={`View the ${club.name} club`}>
                      <article className="flex h-full flex-col rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
                        {clubImage ? (
                          <img
                            src={clubImage}
                            alt={`Cover for ${club.name}`}
                            className="aspect-[4/3] w-full rounded-2xl border border-[var(--border-soft)] object-cover"
                          />
                        ) : (
                          <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-tile)]">
                            <span aria-hidden className="font-display text-6xl font-bold text-[var(--text-muted)]">
                              {club.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="mt-5 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                              {club.name}
                            </h3>
                            {club.category && (
                              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">{club.category}</p>
                            )}
                          </div>
                          {typeof memberCount === 'number' && (
                            <span className="shrink-0 rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-xs font-bold text-[var(--text-primary)]">
                              {memberCount} members
                            </span>
                          )}
                        </div>

                        {club.description && (
                          <p className="mt-3 line-clamp-2 text-sm font-medium text-[var(--text-secondary)]">{club.description}</p>
                        )}
                      </article>
                    </Link>
                  );
                })}
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
                        {typeof dept.clubCount === 'number' && (
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
                    Event <span className="text-[var(--accent-primary)]">categories</span>
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
                Campus is <span className="text-[var(--accent-primary)]">better together.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {benefits.map((item) => (
                <div
                  key={item.num}
                  className="flex flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm sm:p-7"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <span aria-hidden className="font-display text-3xl font-black text-[var(--accent-primary)]">
                        {item.num}
                      </span>
                      <span className="rounded-full border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {item.highlight}
                      </span>
                    </div>

                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{item.title}</h3>

                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
                  </div>

                  <div className="mt-5 flex items-center gap-2 border-t border-[var(--border-soft)] pt-3 text-xs font-semibold text-[var(--text-secondary)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden />
                    <span>Open to all enrolled students at {collegeDisplay}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FINAL CTA */}
        <section className="border-t-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-page)] py-16 text-center md:py-24">
          <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden />
              <span>Never miss a beat</span>
            </div>

            <h2 className="font-campus text-4xl uppercase tracking-tight text-[var(--text-primary)] sm:text-6xl">
              Your campus. Your events.
            </h2>

            <p className="mx-auto max-w-lg text-sm text-[var(--text-secondary)] sm:text-base">
              Discover student clubs, reserve your spot at upcoming events, and make campus life truly memorable.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={scrollToEvents}
                className="inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-2xl bg-[var(--accent-strong)] px-8 py-3 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                <span>Find an event now</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <Link
                href={`/college/${slug}/clubs`}
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-7 py-3 text-base font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5"
              >
                <span>Explore all clubs</span>
              </Link>
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
