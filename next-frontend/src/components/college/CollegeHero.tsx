'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Users, Search, X } from 'lucide-react';
import type { Event, Club } from '@/types/models';
import { getEventCoverImage } from '@/lib/utils/eventCovers';

export interface CollegeHeroProps {
  slug: string;
  collegeDisplay: string;
  seasonLabel: string;
  events: Event[];
  heroEvent: Event | null;
  heroDateParts: { day: string; month: string; weekday: string; time: string };
  eventsLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: string[];
  clubs: Club[];
  clubsLoading: boolean;
  onOpenModal?: (event: Event) => void;
}

const formatHeroDate = (dateStr?: string) => {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBA';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${weekday} ${day} ${month}`;
};

export function CollegeHero({
  slug,
  collegeDisplay,
  seasonLabel,
  events,
  heroEvent,
  heroDateParts,
  eventsLoading,
  searchQuery,
  onSearchQueryChange,
  activeCategory,
  onSelectCategory,
  categories,
  clubs,
  clubsLoading,
  onOpenModal,
}: CollegeHeroProps) {
  const scrollToLineup = () => {
    const el = document.getElementById('upcoming-events');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const heroCoverUrl = heroEvent ? getEventCoverImage(heroEvent) : null;

  return (
    <section className="relative overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)]">
      {/* Decorative brutalist background ring */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 bottom-0 h-96 w-96 rounded-full border-[16px] border-[var(--border-soft)] opacity-60"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="flex flex-col gap-12 min-[900px]:grid min-[900px]:grid-cols-[1.4fr_1fr] min-[900px]:items-end min-[900px]:gap-16">
          {/* Left Column: Heading, Hero Info, Search & Filters */}
          <div className="max-w-4xl">
            {/* Season Pill */}
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-brutal-sm">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              {events.length > 0 ? `Now booking · ${seasonLabel}` : seasonLabel}
            </span>

            {heroEvent ? (
              <>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
                  Next up · {formatHeroDate(heroEvent.startAt || heroEvent.startDate || heroEvent.date)}
                </p>

                <h1
                  onClick={() => onOpenModal?.(heroEvent)}
                  className="font-campus mt-4 text-[40px] uppercase leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-[64px] lg:text-[88px] cursor-pointer hover:text-[var(--accent-strong)] transition-colors"
                >
                  {heroEvent.title.toUpperCase()}
                </h1>

                {heroEvent.description && (
                  <p className="mt-6 max-w-xl text-lg leading-snug text-[var(--text-secondary)]">
                    {heroEvent.description}
                  </p>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--surface-inverse)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)]">
                    {heroDateParts.time}
                  </span>
                  <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {heroEvent.venue || heroEvent.location || 'Campus Arena'}
                  </span>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/college/${slug}/events/${heroEvent.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-8 py-3 text-base font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-sm"
                  >
                    View Details & RSVP
                    {typeof heroEvent.registeredCount === 'number' && heroEvent.registeredCount > 0
                      ? ` · ${heroEvent.registeredCount} going`
                      : ''}
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToLineup}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-8 py-3 text-base font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                  >
                    Browse the lineup
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-campus mt-8 text-[40px] uppercase leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-[64px] lg:text-[88px]">
                  {collegeDisplay}
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
                  Welcome to the official student club & event hub of {collegeDisplay}. Discover upcoming hackathons,
                  cultural showcases, sports tournaments, and join student clubs.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/college/${slug}/clubs`}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-8 py-3 text-base font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-sm"
                  >
                    Browse Clubs
                  </Link>
                </div>
              </>
            )}

            {/* Brutalist Search Bar */}
            <div className="relative mt-10 max-w-xl">
              <div className="flex items-center rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-1.5 shadow-brutal-sm">
                <div className="pl-3.5 pr-2 text-[var(--text-secondary)]">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Search by event title, club name, or venue…"
                  aria-label="Search events"
                  className="w-full bg-transparent py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchQueryChange('')}
                    className="mr-1 grid min-h-11 min-w-11 place-items-center rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-tile)] hover:text-[var(--text-primary)]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={scrollToLineup}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl bg-[var(--surface-inverse)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-inverse)] transition-colors hover:bg-[var(--surface-inverse-hover)]"
                >
                  Find
                </button>
              </div>
            </div>

            {/* Quick Category Filter Pills */}
            {categories.length > 0 && (
              <div className="mt-4 flex max-w-xl items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Quick filter:
                </span>
                {categories.slice(0, 6).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onSelectCategory(cat)}
                    aria-pressed={activeCategory === cat}
                    className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                      activeCategory === cat
                        ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)] border-[var(--border-strong)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Real-time Stats Row */}
            <div className="mt-6 flex items-center gap-6 border-t-2 border-[var(--border-soft)] pt-5 text-xs font-medium text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
                <span>
                  <strong className="text-sm font-bold text-[var(--text-primary)]">
                    {eventsLoading ? '…' : events.length}
                  </strong>{' '}
                  events scheduled
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
                <span>
                  <strong className="text-sm font-bold text-[var(--text-primary)]">
                    {clubsLoading ? '…' : clubs.length}
                  </strong>{' '}
                  campus clubs
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Event Poster Card */}
          {heroEvent && (
            <div className="w-full max-w-sm min-[900px]:justify-self-end">
              {eventsLoading ? (
                <div
                  aria-hidden="true"
                  className="aspect-[4/5] rotate-2 rounded-2xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg"
                >
                  <div className="h-full w-full rounded-[13px] bg-[var(--border-soft)] animate-college-skeleton" />
                </div>
              ) : (
                <Link
                  href={`/college/${slug}/events/${heroEvent.id}`}
                  onClick={(e) => {
                    if (onOpenModal) {
                      e.preventDefault();
                      onOpenModal(heroEvent);
                    }
                  }}
                  className="group block rounded-2xl"
                  aria-label={`View details for ${heroEvent.title}`}
                >
                  <div className="relative aspect-[4/5] rotate-2 rounded-2xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg transition-transform duration-200 will-change-transform group-hover:rotate-0 group-hover:-translate-y-1 overflow-hidden">
                    {heroCoverUrl ? (
                      <img
                        src={heroCoverUrl}
                        alt={`Poster for ${heroEvent.title}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col justify-end bg-[var(--surface-tile)] p-6">
                        <p className="font-campus text-6xl font-bold leading-[0.95] text-[var(--text-primary)]">
                          {heroDateParts.day}
                        </p>
                        <p className="font-campus mt-1 text-2xl font-bold uppercase leading-[0.95] text-[var(--text-primary)]">
                          {heroEvent.title}
                        </p>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Corner Date Badge */}
                    <span className="absolute left-3 top-3 rounded-xl border-[3px] border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                      {heroDateParts.month} {heroDateParts.day}
                    </span>

                    {/* Bottom Info on Poster */}
                    <div className="absolute bottom-4 left-4 right-4 z-10 text-white">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-primary)]">
                        {heroEvent.club?.name || collegeDisplay}
                      </span>
                      <h4 className="font-campus text-xl font-bold uppercase leading-tight line-clamp-2">
                        {heroEvent.title}
                      </h4>
                      <p className="mt-1 text-xs text-white/80">
                        {heroEvent.venue || heroEvent.location || 'Campus Arena'}
                      </p>
                    </div>
                  </div>
                </Link>
              )}

              {!eventsLoading && (
                <div className="mt-5 flex flex-col items-start gap-1 px-1">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">
                    {heroEvent.venue || heroEvent.location || 'Campus Arena'}
                  </p>
                  {typeof heroEvent.registeredCount === 'number' && heroEvent.registeredCount > 0 && (
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                      {heroEvent.registeredCount} {heroEvent.registeredCount === 1 ? 'student' : 'students'} attending
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CollegeHero;
