'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  Search,
  X,
  Building2,
  Clock,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useUpcomingEvents } from '@/lib/api/events';
import { useClubs } from '@/lib/api/clubs';
import { useDepartments } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import EventModal from '@/components/public/EventModal';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import CollegeHero from '@/components/college/CollegeHero';
import CollegeEventCard from '@/components/college/CollegeEventCard';
import CollegeClubCard from '@/components/college/CollegeClubCard';
import { getClubCoverImage } from '@/lib/utils/clubCovers';
import { getEventCoverImage } from '@/lib/utils/eventCovers';
import { getClubCategory, getEventCategory, VALID_CATEGORIES } from '@/lib/utils/categories';
import type { Event, Club, Department } from '@/types/models';

export interface CollegeHomePageClientProps {
  slug: string;
}

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

const getSeasonLabel = (d: Date = new Date()) => {
  const month = d.getMonth();
  const season = month >= 8 ? 'Fall' : month >= 5 ? 'Summer' : month >= 2 ? 'Spring' : 'Winter';
  return `${season} ${d.getFullYear()}`;
};

const fallbackDepartments = [
  { id: 'cse', name: 'Computer Science & Engineering', code: 'CSE', shortCode: 'CSE', description: 'Core computing, algorithms, artificial intelligence, cloud architectures and open-source hackathons.', clubCount: 4 },
  { id: 'it', name: 'Information Technology', code: 'IT', shortCode: 'IT', description: 'Web development, cybersecurity, network systems and competitive software engineering.', clubCount: 3 },
  { id: 'ece', name: 'Electronics & Communication', code: 'ECE', shortCode: 'ECE', description: 'Robotics, embedded IoT, VLSI design, signal processing, and hardware innovation.', clubCount: 3 },
  { id: 'eee', name: 'Electrical & Electronics', code: 'EEE', shortCode: 'EEE', description: 'Power systems, smart grid automation, renewable energy, and electric vehicle technology.', clubCount: 2 },
  { id: 'mech', name: 'Mechanical Engineering', code: 'MECH', shortCode: 'MECH', description: 'CAD modeling, automotive design, thermodynamics, and manufacturing automation.', clubCount: 2 },
  { id: 'civil', name: 'Civil Engineering', code: 'CIVIL', shortCode: 'CIVIL', description: 'Structural engineering, sustainable urban development, smart city infrastructures and surveying.', clubCount: 2 },
];

const communityBenefits = [
  {
    highlight: 'Instant access',
    title: 'WORD OF MOUTH VERIFIED',
    description: 'Heard friends talking about a hackathon or concert? Find official timings, venues, and registration links instantly here.',
  },
  {
    highlight: 'Quick RSVP',
    title: 'DIRECT REGISTRATIONS',
    description: 'No confusing forms. Click through to RSVP or join event queues organized directly by student club leaders.',
  },
  {
    highlight: 'Real community',
    title: 'DISCOVER YOUR TRIBE',
    description: 'Connect with communities that match your passion, from coding to dance, theatre to robotics.',
  },
];

function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-6">
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

function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
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

export function CollegeHomePageClient({ slug }: CollegeHomePageClientProps) {
  const router = useRouter();

  // Scoped TanStack query hooks
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useUpcomingEvents(slug);
  const { data: clubs = [], isLoading: clubsLoading, error: clubsError, refetch: refetchClubs } = useClubs(slug);
  const { data: departmentsData = [], isLoading: deptsLoading, error: deptsError, refetch: refetchDepts } = useDepartments(slug);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');

  // Modals & Lightbox
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  // Dynamic Categories from events and clubs
  const categories = useMemo(() => {
    return VALID_CATEGORIES;
  }, []);

  // Categories with counts for category grid
  const categoryCounts = useMemo(() => {
    return categories.map((cat) => ({
      name: cat,
      eventCount: events.filter((ev) => getEventCategory(ev) === cat).length,
      clubCount: clubs.filter((cl) => getClubCategory(cl) === cat).length,
    }));
  }, [categories, events, clubs]);

  const collegeDisplay = slug.toUpperCase();
  const seasonLabel = getSeasonLabel();

  // Hero event (first upcoming event)
  const heroEvent = events[0] || null;
  const heroDateParts = formatDateParts(heroEvent?.startAt || heroEvent?.startDate || heroEvent?.date, heroEvent?.endAt);

  // Spotlight Event: top event by attendance or 2nd event
  const spotlightEvent = useMemo(() => {
    if (events.length <= 1) return null;
    const candidates = events.slice(1);
    return candidates.reduce(
      (best, current) => ((current.registeredCount ?? 0) > (best.registeredCount ?? 0) ? current : best),
      candidates[0]
    );
  }, [events]);

  const spotlightDateParts = formatDateParts(
    spotlightEvent?.startAt || spotlightEvent?.startDate || spotlightEvent?.date,
    spotlightEvent?.endAt
  );

  // Filtered events
  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // When a filter is active, include all events so matching hero events are visible in search/filter results
    const isFiltered = Boolean(q || activeCategory !== 'ALL' || timeFilter !== 'ALL');
    const baseEvents = isFiltered || events.length <= 1
      ? events
      : (heroEvent ? events.filter((e) => e.id !== heroEvent.id) : events);

    return baseEvents.filter((ev) => {
      // Time filter
      if (timeFilter !== 'ALL') {
        const timeVal = ev.startAt ? new Date(ev.startAt).getTime() : NaN;
        if (!Number.isNaN(timeVal)) {
          const now = new Date();
          if (timeFilter === 'WEEK') {
            const weekStart = new Date(now);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            if (timeVal < weekStart.getTime() || timeVal >= weekEnd.getTime()) return false;
          } else if (timeFilter === 'MONTH') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
            if (timeVal < monthStart || timeVal >= monthEnd) return false;
          }
        }
      }

      // Search query
      const evCat = getEventCategory(ev);
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.club?.name?.toLowerCase().includes(q) ||
        evCat.toLowerCase().includes(q);

      // Category filter
      const matchesCategory =
        activeCategory === 'ALL' || evCat === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, heroEvent, timeFilter, searchQuery, activeCategory]);

  // Filtered clubs for home page
  const displayClubs = useMemo(() => {
    if (activeCategory === 'ALL') return clubs.slice(0, 6);
    const matched = clubs.filter((cl) => getClubCategory(cl) === activeCategory);
    return matched.length > 0 ? matched : clubs.slice(0, 6);
  }, [clubs, activeCategory]);

  const departments = departmentsData.length > 0 ? departmentsData : fallbackDepartments;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)]">
        {/* 1. Live Events Ticker Bar */}
        {events.length > 0 && (
          <div className="relative flex h-14 w-full items-center overflow-hidden border-b border-[var(--border-inverse)] bg-[var(--surface-inverse)]">
            <p className="sr-only">Upcoming events ticker</p>
            <div aria-hidden="true" className="relative h-full flex-1 overflow-hidden">
              <div className="animate-scroll-x flex w-max items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
                {[...events, ...events, ...events, ...events].map((ev, idx) => {
                  const dateParts = formatDateParts(ev.startAt || ev.startDate || ev.date);
                  return (
                    <button
                      key={`${ev.id}-${idx}`}
                      type="button"
                      tabIndex={-1}
                      onClick={() => router.push(`/college/${slug}/events/${ev.id}`)}
                      className="mx-1.5 inline-flex h-11 shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-5 py-2 text-left transition-colors hover:border-[var(--border-inverse)] hover:bg-[var(--surface-inverse-tile)]"
                    >
                      <span className="text-[11px] font-black uppercase tracking-widest text-[var(--accent-primary)]">
                        {ev.club?.name || collegeDisplay}
                      </span>
                      <span className="text-xs font-light text-[var(--text-inverse-muted)]">/</span>
                      <span className="whitespace-nowrap text-sm font-semibold text-[var(--text-inverse)]">
                        {ev.title}
                      </span>
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

        {/* 2. College Hero Section */}
        <CollegeHero
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
          onSelectCategory={(cat) => {
            setActiveCategory((prev) => (prev === cat ? 'ALL' : cat));
            const el = document.getElementById('upcoming-events');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          categories={categories}
          clubs={clubs}
          clubsLoading={clubsLoading}
          onOpenModal={(ev) => setSelectedEvent(ev)}
        />

        {/* 3. Category Running Marquee */}
        {categories.length > 0 && (
          <div aria-hidden="true" className="overflow-hidden bg-[var(--surface-inverse)] py-5 text-[var(--text-inverse)]">
            <div className="animate-marquee flex w-max">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center gap-12 pr-12">
                  {categories.map((cat) => (
                    <span
                      key={`${copy}-${cat}`}
                      className="font-display whitespace-nowrap text-3xl font-bold uppercase tracking-wide lg:text-4xl"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Upcoming Events Section */}
        <section id="upcoming-events" className="bg-[var(--surface-card)] py-16 md:py-20 border-b border-[var(--border-soft)]">
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

              {/* Time Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'ALL' as const, label: 'All dates' },
                  { id: 'WEEK' as const, label: 'This week' },
                  { id: 'MONTH' as const, label: 'This month' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTimeFilter(item.id)}
                    aria-pressed={timeFilter === item.id}
                    className={`inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                      timeFilter === item.id
                        ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)] border-[var(--border-strong)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Pills in Events section */}
            <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Event category filter">
              {['ALL', ...VALID_CATEGORIES].map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory((prev) => (prev === cat ? 'ALL' : cat))}
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-strong)] text-white shadow-brutal-xs'
                        : 'border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat === 'ALL' ? 'All categories' : cat}
                  </button>
                );
              })}
            </div>

            {/* Active Category Indicator Banner */}
            {activeCategory !== 'ALL' && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--accent-strong)] bg-[var(--surface-tile)] p-3 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)] animate-pulse" />
                  Category filter: <strong className="font-bold text-[var(--text-primary)]">{activeCategory}</strong> ({filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCategory('ALL')}
                  className="font-bold underline hover:no-underline text-[var(--accent-strong)] cursor-pointer"
                >
                  Show all categories
                </button>
              </div>
            )}

            {/* Active Search Notification */}
            {searchQuery && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-3 text-xs font-medium text-[var(--text-secondary)]">
                <span>
                  Showing results for &quot;<strong className="font-bold text-[var(--text-primary)]">{searchQuery}</strong>&quot; ({filteredEvents.length} found)
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-11 font-bold underline hover:no-underline text-[var(--accent-strong)] cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Events Content */}
            {eventsLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <SkeletonCards count={3} />
              </div>
            ) : eventsError ? (
              <ErrorCard
                title="Couldn't load events"
                message="The upcoming events didn't load. Check your connection and try again."
                onRetry={() => refetchEvents()}
              />
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-page)] p-10 text-center shadow-brutal-xs">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-[var(--accent-strong)]" aria-hidden="true" />
                {events.length <= 1 ? (
                  <>
                    <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      No upcoming events scheduled yet
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                      Clubs post new events as they are announced. Browse the clubs to see what each community is planning.
                    </p>
                    <Link
                      href={`/college/${slug}/clubs`}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
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
                      className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredEvents.slice(0, 6).map((ev) => (
                    <CollegeEventCard
                      key={ev.id}
                      event={ev}
                      href={`/college/${slug}/events/${ev.id}`}
                      onOpenModal={(e) => setSelectedEvent(e)}
                    />
                  ))}
                </div>

                {filteredEvents.length > 0 && (
                  <div className="mt-10 flex justify-center">
                    <Link
                      href={`/college/${slug}/events`}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-6 py-3 text-sm font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5 shadow-brutal-xs hover:bg-[var(--surface-tile)]"
                    >
                      See all campus events
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* 5. Spotlight / Crowd Favourite Section */}
        {spotlightEvent && (
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
                  <p className="font-display text-7xl font-bold leading-none text-[var(--text-inverse)]">
                    {spotlightDateParts.day}
                  </p>
                  <p className="font-display mt-2 text-xl font-bold uppercase text-[var(--accent-primary)]">
                    {spotlightDateParts.month}
                  </p>

                  {spotlightEvent.description && (
                    <p className="mt-8 text-lg leading-relaxed text-[var(--text-inverse-muted)]">
                      {spotlightEvent.description}
                    </p>
                  )}

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">
                        Starts
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">{spotlightDateParts.time}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">
                        Where
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">
                        {spotlightEvent.venue || spotlightEvent.location || 'Campus Arena'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">
                        Host club
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">
                        {spotlightEvent.club?.name || collegeDisplay}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-inverse-muted)]">
                        Attending
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-inverse)]">
                        {typeof spotlightEvent.registeredCount === 'number' && spotlightEvent.registeredCount > 0
                          ? `${spotlightEvent.registeredCount} students`
                          : 'Opening soon'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Callout Box */}
                <div className="relative">
                  <div className="relative rounded-[2rem] border-2 border-[var(--border-inverse)] bg-[var(--surface-inverse-hover)] px-8 py-12 text-center shadow-brutal-lg">
                    {typeof spotlightEvent.registeredCount === 'number' && spotlightEvent.registeredCount > 0 ? (
                      <>
                        <p className="font-display text-6xl font-bold text-[var(--text-inverse)]">
                          {spotlightEvent.registeredCount}
                        </p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-inverse-muted)]">
                          Students are going
                        </p>
                      </>
                    ) : (
                      <p className="font-display text-4xl font-bold uppercase text-[var(--text-inverse)]">
                        Registrations Open
                      </p>
                    )}

                    <Link
                      href={`/college/${slug}/events/${spotlightEvent.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedEvent(spotlightEvent);
                      }}
                      className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)] px-8 py-3 text-xl font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5 shadow-brutal-md"
                    >
                      Grab your spot
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 6. Featured Clubs Section */}
        <section id="featured-clubs" className="bg-[var(--surface-page)] py-16 md:py-20 border-b border-[var(--border-soft)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 border-b-2 border-[var(--border-soft)] pb-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Student organizations
                </p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Explore campus clubs
                </h2>
                <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
                  The student communities hosting these events across {collegeDisplay}. Join a club to participate,
                  organize, or lead.
                </p>
              </div>

              <Link
                href={`/college/${slug}/clubs`}
                className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl bg-[var(--surface-inverse)] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)] transition-transform hover:-translate-y-0.5 shadow-brutal-sm md:self-end"
              >
                <span>View all clubs</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {clubsLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCards count={3} />
              </div>
            ) : clubsError ? (
              <ErrorCard
                title="Couldn't load clubs"
                message="The campus clubs didn't load. Check your connection and try again."
                onRetry={() => refetchClubs()}
              />
            ) : clubs.length === 0 ? (
              <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 text-center shadow-brutal-xs">
                <Users className="mx-auto mb-3 h-10 w-10 text-[var(--accent-strong)]" aria-hidden="true" />
                <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                  No clubs are listed yet
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                  Student organizations appear here once they are registered at {collegeDisplay}.
                </p>
              </div>
            ) : (
              <>
                {activeCategory !== 'ALL' && (
                  <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--accent-strong)] bg-[var(--surface-tile)] p-3 text-xs font-medium text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)] animate-pulse" />
                      Showing <strong className="font-bold text-[var(--text-primary)]">{activeCategory}</strong> clubs ({displayClubs.length} found)
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('ALL')}
                      className="font-bold underline hover:no-underline text-[var(--accent-strong)] cursor-pointer"
                    >
                      Show all clubs
                    </button>
                  </div>
                )}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {displayClubs.map((club) => (
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
        </section>

        {/* 7. Academic Divisions / Departments */}
        <section id="departments" className="border-b border-[var(--border-soft)] bg-[var(--surface-page)] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Academic divisions
                </p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Departments &amp; chapters
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                  Academic divisions across {collegeDisplay} anchor departmental clubs, student hackathons, and technical symposiums.
                </p>
              </div>

              {!deptsLoading && departments.length > 0 && (
                <span className="inline-flex items-center self-start rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs md:self-end">
                  {departments.length} departments
                </span>
              )}
            </div>

            {deptsLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCards count={3} />
              </div>
            ) : deptsError ? (
              <ErrorCard
                title="Couldn't load departments"
                message="The department list didn't load. Check your connection and try again."
                onRetry={() => refetchDepts()}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => {
                  const code = (dept as any).shortCode || (dept as any).code || 'DEPT';
                  const clubCount = (dept as any).clubCount ?? (dept as any)._count?.clubs ?? 3;
                  return (
                    <Link
                      key={dept.id}
                      href={`/college/${slug}/departments/${dept.id}`}
                      className="group block"
                      aria-label={`View the ${dept.name} department`}
                    >
                      <article className="flex h-full flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                              {code}
                            </span>
                          </div>

                          <h3 className="font-display mt-4 text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                            {dept.name}
                          </h3>

                          {dept.description && (
                            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                              {dept.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-xs font-bold">
                          {typeof clubCount === 'number' && clubCount > 0 && (
                            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {clubCount} clubs associated
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[var(--accent-strong)] transition-transform group-hover:translate-x-1">
                            <span>Explore</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 8. Browse By Interest / Event Categories Grid */}
        {categoryCounts.length > 0 && (
          <section className="border-b border-[var(--border-soft)] bg-[var(--surface-page)] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 flex flex-col justify-between gap-4 border-b-2 border-[var(--border-soft)] pb-6 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                    Browse by interest
                  </p>
                  <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                    Event categories
                  </h2>
                </div>
                <p className="max-w-sm text-xs text-[var(--text-secondary)] sm:text-sm">
                  Pick a discipline to filter the events and clubs on this page.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryCounts.map((cat) => {
                  const isSelected = activeCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setActiveCategory((prev) => (prev === cat.name ? 'ALL' : cat.name));
                        const el = document.getElementById('upcoming-events');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`group cursor-pointer rounded-3xl border-2 p-5 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-[var(--accent-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)] shadow-brutal-md ring-2 ring-[var(--accent-strong)]'
                          : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-brutal-xs hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className={`font-display text-xl font-bold uppercase tracking-tight transition-colors ${
                          isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
                        }`}>
                          {cat.name}
                        </h3>
                        <span className={`shrink-0 rounded-full border-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                          isSelected
                            ? 'border-[var(--border-inverse)] bg-[var(--surface-inverse-tile)] text-[var(--text-inverse)]'
                            : 'border-[var(--border-strong)] text-[var(--text-primary)]'
                        }`}>
                          {cat.eventCount > 0 ? `${cat.eventCount} events` : ''}
                          {cat.eventCount > 0 && cat.clubCount > 0 ? ' · ' : ''}
                          {cat.clubCount > 0 ? `${cat.clubCount} clubs` : ''}
                          {cat.eventCount === 0 && cat.clubCount === 0 ? 'Explore' : ''}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                        <span>{isSelected ? 'Clear filter' : 'Filter events'}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 9. Student Community Benefits Section */}
        <section className="bg-[var(--surface-page)] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Student community
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
                Campus is better together.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {communityBenefits.map((item) => (
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
                    <h3 className="font-campus text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modals & Lightboxes */}
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
          <GalleryLightbox
            event={activeGalleryEvent}
            onClose={() => setActiveGalleryEvent(null)}
          />
        )}
      </div>
    </PublicLayout>
  );
}

export default CollegeHomePageClient;
