'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '@/lib/utils/cloudinary';
import { formatCampusDateParts } from '@/components/college/CampusEventCard';
import { campusPublic } from '@/lib/copy';
import type { Event } from '@/types/models';

export type EventCardVariant = 'card' | 'feature' | 'row';

export interface EventCardProps {
  event: Event;
  href: string;
  /** "card" = poster card (grid), "feature" = hero poster, "row" = compact horizontal row. */
  variant?: EventCardVariant;
}

const statusLabelFor = (status?: Event['status']) =>
  status === 'ONGOING' ? campusPublic.events.statusLive : status === 'UPCOMING' ? campusPublic.events.statusUpcoming : undefined;

const dateChipTextFor = (event: Event) => {
  const raw = event.startAt || event.startDate || event.date;
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${weekday}, ${month} ${day} · ${time.replace(' ', '')}`;
};

const coverFallback = (clubName: string) => (
  <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-tile)]">
    <span className="font-campus text-5xl font-bold text-[var(--text-primary)]" aria-hidden>
      {(clubName || 'C').trim().charAt(0).toUpperCase()}
    </span>
  </div>
);

/**
 * Shared public campus EventCard.
 *
 * Variants:
 * - "card": poster card — cover (16:10) with solid date + status chips on a scrim,
 *   clamped Anton title, club name, time + venue one-liners (ellipsis), honest going
 *   line, CTA pinned bottom (visual text, not a nested button).
 * - "feature": hero poster — 2px ink border + hard offset shadow, scrim, solid status
 *   chip, big Anton title, CTA.
 * - "row": compact horizontal row (small image left) for narrow screens.
 *
 * Whole card is a single stretched link; the CTA is visual text inside it.
 */
export function EventCard({ event, href, variant = 'card' }: EventCardProps) {
  if (!event) return null;

  const rawCoverUrl = event.coverImage?.url || event.coverImageUrl || event.coverUrl || event.bannerUrl;
  const coverUrl = getCloudinaryUrl(rawCoverUrl, CLOUDINARY_TRANSFORMS.COVER);
  const clubName = event.club?.name || 'Student Club';
  const dateParts = formatCampusDateParts(event.startAt || event.startDate || event.date, event.endAt || event.endDate);
  const statusLabel = statusLabelFor(event.status);
  const fewSeats =
    event.status === 'UPCOMING' &&
    typeof event.capacity === 'number' &&
    typeof event.registeredCount === 'number' &&
    event.capacity - event.registeredCount <= 2;
  const statusChip = statusLabel ? (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-bold text-[var(--on-primary)]">
      {statusLabel}
    </span>
  ) : fewSeats ? (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-bold text-[var(--on-primary)]">
      {campusPublic.events.fewSeatsLeft}
    </span>
  ) : null;
  const dateChip = dateChipTextFor(event) ? (
    <span className="inline-flex items-center rounded-full bg-[var(--surface-inverse)] px-3 py-1 text-[11px] font-bold text-[var(--text-inverse)]">
      {dateChipTextFor(event)}
    </span>
  ) : null;
  const going = typeof event.registeredCount === 'number' ? event.registeredCount : 0;
  const goingLabel = going <= 0 ? campusPublic.events.beFirstRsvp : `${going} ${going === 1 ? 'student' : 'students'} going`;
  const ctaLabel = campusPublic.events.viewDetails;
  const timeLine = dateParts.time ? (
    <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-secondary)]">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {dateParts.time}
    </p>
  ) : null;
  const venueLine = event.venue || event.location ? (
    <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-secondary)]">
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {event.venue || event.location}
    </p>
  ) : null;

  const cardCta = (
    <span className="mt-auto pt-3 text-center font-bold text-[var(--text-primary)] underline decoration-2 decoration-[var(--accent-strong)] underline-offset-4">
      {ctaLabel}
      <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden />
    </span>
  );

  /* ---------------------------------------------------------------- card */
  if (variant === 'card') {
    return (
      <Link
        href={href}
        aria-label={`View details for ${event.title}`}
        className="group relative block h-full w-full flex overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:shadow-brutal-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] sm:flex-col"
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-[var(--surface-tile)] sm:aspect-[16/10] sm:h-auto sm:w-full">
          {coverUrl ? <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : coverFallback(clubName)}
          <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/75" />
          {statusChip ? <div className="absolute left-2 top-2 z-10">{statusChip}</div> : null}
          {dateChip ? <div className="absolute right-2 top-2 z-10">{dateChip}</div> : null}
        </div>
        <div className="min-h-0 flex-1 flex-col p-3 sm:p-4">
          <h3 className="font-campus text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)] line-clamp-2" title={event.title}>
            {event.title}
          </h3>
          <p className="mt-2 truncate text-sm font-semibold text-[var(--text-secondary)]">{clubName}</p>
          {timeLine}
          {venueLine}
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{goingLabel}</p>
          {cardCta}
        </div>
      </Link>
    );
  }

  /* -------------------------------------------------------------- feature */
  const featureCta = (
    <span className="mt-auto pt-3 text-center font-bold text-[var(--text-inverse)] underline decoration-2 decoration-[var(--accent-strong)] underline-offset-4">
      {ctaLabel}
      <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden />
    </span>
  );

  if (variant === 'feature') {
    return (
      <Link
        href={href}
        aria-label={`View details for ${event.title}`}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:shadow-brutal-lg hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)]"
      >
        <div className="absolute inset-0">
          {coverUrl ? <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : coverFallback(clubName)}
          <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/75" />
        </div>
        {statusChip ? <div className="absolute left-2 top-2 z-10">{statusChip}</div> : null}
        {dateChip ? <div className="absolute right-2 top-2 z-10">{dateChip}</div> : null}
        <div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 p-5">
          <h3 className="font-campus text-3xl font-bold uppercase leading-[1.05] tracking-tight text-[var(--text-inverse)] line-clamp-2" title={event.title}>
            {event.title}
          </h3>
          <p className="truncate text-sm font-medium text-[var(--text-inverse)]/85">
            {clubName}
            {dateParts.time ? ` · ${dateParts.time}` : ''}
          </p>
          {featureCta}
        </div>
      </Link>
    );
  }

  /* ----------------------------------------------------------------- row */
  return (
    <Link
      href={href}
      aria-label={`View details for ${event.title}`}
      className="group relative flex w-full items-stretch overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:shadow-brutal-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)]"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-[var(--surface-tile)]">
        {coverUrl ? <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : coverFallback(clubName)}
        <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/75" />
        {statusChip ? <div className="absolute left-1.5 top-1.5 z-10">{statusChip}</div> : null}
        {dateChip ? <div className="absolute bottom-1.5 right-1.5 z-10">{dateChip}</div> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 p-3">
        <h3 className="font-campus text-xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)] line-clamp-2" title={event.title}>
          {event.title}
        </h3>
        <p className="truncate text-xs font-semibold text-[var(--text-secondary)]">{clubName}</p>
        {timeLine}
        {venueLine}
        <p className="text-xs font-medium text-[var(--text-secondary)]">{goingLabel}</p>
        <span className="mt-auto pt-1 text-left text-xs font-bold text-[var(--accent-strong)] underline decoration-2 decoration-[var(--accent-strong)] underline-offset-2">
          {ctaLabel}
          <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export default EventCard;
