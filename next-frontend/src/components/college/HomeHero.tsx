'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Search, Users, X } from 'lucide-react';
import { campusPublic } from '@/lib/copy';
import { resolveImageUrl } from '@/components/college/imageUrl';
import type { Club, Event } from '@/types/models';

export interface HomeHeroProps {
  slug: string;
  collegeDisplay: string;
  seasonLabel: string;
  events: Event[];
  heroEvent: Event | null;
  heroDateParts: { day: string; month: string; weekday: string; time: string };
  eventsLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categories: string[];
  clubs: Club[];
  clubsLoading: boolean;
}

const formatShortDateLabel = (dateString?: string) => {
  if (!dateString) return 'TBA';
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return 'TBA';
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const day = dateObj.getDate();
  return `${weekday} ${day} ${month}`;
};

const eventImageUrl = (event: Event) => resolveImageUrl(event.coverImageUrl, event.coverUrl, event.bannerUrl, event.coverImage?.url);

/**
 * Campus homepage hero — the next upcoming (or ongoing) event.
 *
 * Left: season badge, one eyebrow ("Next up · …"), Anton title, description,
 * time + venue chips, CTAs ("View details & RSVP" / "Browse the lineup"), search,
 * quick category pills and the real-count stats strip. Right: the event cover as
 * a framed poster tile that is the page's one deliberately tilted element; no
 * cover -> designed date block. With no upcoming events the hero falls back to
 * the college identity + "Browse clubs".
 *
 * Own implementation on the shared campus surface tokens — deliberately not the
 * EventCard "feature" variant (that overlay scrim doesn't fit the tilted poster).
 */
export default function HomeHero({
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
}: HomeHeroProps) {
  const scrollToEvents = () => {
    const el = document.getElementById('upcoming-events');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
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
                  Next up · {formatShortDateLabel(heroEvent.startAt || heroEvent.startDate || heroEvent.date)}
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
                    {campusPublic.events.viewDetails}
                    {typeof heroEvent.registeredCount === 'number' && heroEvent.registeredCount > 0 ? ` · ${heroEvent.registeredCount} going` : ''}
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
              <>
                <h1 className="font-campus mt-8 text-[40px] uppercase leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-[64px] lg:text-[88px]">
                  {collegeDisplay}
                </h1>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/college/${slug}/clubs`}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-8 py-3 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                  >
                    {campusPublic.home.browseClubs}
                  </Link>
                </div>
              </>
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
            {categories.length > 0 && (
              <div className="mt-4 flex max-w-xl items-center gap-2 overflow-x-auto pb-2">
                <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Quick filter:
                </span>
                {categories.slice(0, 6).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onSelectCategory(category)}
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
                      <div className="flex h-full w-full flex-col justify-end rounded-[13px] bg-[var(--surface-tile)] p-6">
                        <p className="font-campus text-6xl font-bold leading-[0.95] text-[var(--text-primary)]">{heroDateParts.day}</p>
                        <p className="font-campus mt-1 text-2xl font-bold uppercase leading-[0.95] text-[var(--text-primary)]">
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
                  {typeof heroEvent.registeredCount === 'number' && heroEvent.registeredCount > 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      {heroEvent.registeredCount} {heroEvent.registeredCount === 1 ? 'student' : 'students'} going
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
