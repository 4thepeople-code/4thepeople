'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FEATURED_EVENTS, EventInfo } from './data';

const CATEGORY_STYLES = {
  Tech: {
    bg: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dot: 'bg-indigo-500',
    bannerGradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
  },
  Cultural: {
    bg: 'border-coral-200 bg-coral-50 text-coral-700',
    dot: 'bg-coral-500',
    bannerGradient: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 60%, #ff4a3d 100%)',
  },
  Sports: {
    bg: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    bannerGradient: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #22c55e 100%)',
  },
};

function EventCard({ event }: { event: EventInfo }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'registered' | 'error'>('idle');
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.Tech;
  const isLbrce = event.college.slug === 'lbrce';
  const seatsLeft = event.seatsLeft;
  const titleDisplay =
    event.title.length > 45 ? `${event.title.slice(0, 45)}…` : event.title;

  const handleRegister = async () => {
    setStatus('loading');
    try {
      await new Promise((res) => setTimeout(res, 600));
      setStatus('registered');
    } catch {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setJoinedWaitlist(false);
  };

  return (
    <article className="group rounded-3xl border border-ink-900/10 bg-white p-6 shadow-sm transition-all hover:border-brand-600 focus-within:border-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2">
      {/* College & Demo status */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            isLbrce
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
              isLbrce ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          />
          {event.college.shortName}
        </span>
        {!isLbrce && (
          <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-100/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            DEMO
          </span>
        )}
      </div>

      {/* Category Tag */}
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${style.bg}`}
        aria-hidden="true"
      >
        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${style.dot}`} />
        {event.category}
      </span>

      {/* Poster banner */}
      <div
        className="mt-3 relative overflow-hidden rounded-2xl border border-ink-900/10 p-5 shadow-sm mb-4"
        style={{ background: style.bannerGradient }}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-black/25 pointer-events-none" />
        <div className="relative z-10">
          <h3
            className="mt-1 font-campus text-xl font-bold leading-tight tracking-wide text-white line-clamp-2"
            style={{
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              display: '-webkit-box',
              overflow: 'hidden',
            }}
            aria-label={event.title}
          >
            {titleDisplay}
          </h3>
          <p className="mt-1 text-xs font-semibold text-white/95">
            {event.weekday} · {event.month} {event.day} · {event.time}
          </p>
        </div>
      </div>

      {/* Location & Seats */}
      <div className="flex items-center justify-between mb-3 text-[13px]">
        <p className="font-medium text-slate-700">{event.location}</p>
        <span className={`font-semibold ${seatsLeft === 0 ? 'text-brand-600' : 'text-slate-700'}`}>
          {seatsLeft === 0 ? '0 seats left' : `${seatsLeft} seats left`}
        </span>
      </div>

      {/* Capacity meter */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-3">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${Math.min((event.attendees / event.capacity) * 100, 100)}%` }}
        />
      </div>

      {/* CTA Button */}
      <div className="flex flex-col gap-2">
        {joinedWaitlist ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
              Joined waitlist
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-600 hover:text-brand-600 underline underline-offset-4 cursor-pointer"
            >
              Undo
            </button>
          </div>
        ) : status === 'idle' ? (
          seatsLeft === 0 ? (
            <button
              type="button"
              onClick={() => setJoinedWaitlist(true)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-transparent px-4 text-xs sm:text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 cursor-pointer"
            >
              Join waitlist
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
            >
              Register
            </button>
          )
        ) : status === 'loading' ? (
          <button
            type="button"
            disabled
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold bg-slate-100 text-slate-500 cursor-not-allowed"
          >
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.071-6.071 9 9 0 0 1 6.071 6.071" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Registering…
          </button>
        ) : status === 'registered' ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              Registered
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-600 hover:text-brand-600 underline underline-offset-4 cursor-pointer"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700">
              Error
            </span>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="text-xs font-semibold text-brand-600 underline underline-offset-4 hover:text-brand-700 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const CATEGORIES = ['All', 'Tech', 'Cultural', 'Sports'] as const;

export default function LiveFeedSection() {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredEvents =
    activeCategory === 'All'
      ? FEATURED_EVENTS.slice(0, 6)
      : FEATURED_EVENTS.filter((e) => e.category === activeCategory).slice(0, 6);

  return (
    <section
      id="live-feed"
      aria-labelledby="live-feed-heading"
      className="scroll-mt-24 bg-mist px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Demo data
          </p>
          <h2
            id="live-feed-heading"
            className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl"
          >
            Events happening{' '}
            <em className="italic font-bold text-brand-600">on campus</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Upcoming club events from demo colleges. All data shown is sample.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="mt-10 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'border border-ink-900/10 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Event Cards Grid */}
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Link
            href="#live-feed"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            See all events <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
