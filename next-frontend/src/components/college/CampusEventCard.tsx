import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Users } from 'lucide-react';
import type { Event } from '@/types/models';
import { resolveImageUrl } from './imageUrl';

export interface CampusEventCardProps {
  event: Event;
  href: string;
  /** Fallback host label when the event has no club, e.g. the college name. */
  hostFallback?: string;
  /**
   * "card" = the homepage grid card; "row" = the demo club-page horizontal
   * pass card (day tile, weekday eyebrow, meta line, status pill).
   */
  variant?: 'card' | 'row';
}

export interface CampusDateParts {
  day: string;
  month: string;
  weekday: string;
  time: string | null;
}

/** Formats the brutal-card date tile parts; shared by every event surface. */
export function formatCampusDateParts(dateString?: string, endDateString?: string): CampusDateParts {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: null };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: null };
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  let time: string | null = null;
  if (!endDateString) {
    time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else {
    const end = new Date(endDateString);
    time = isNaN(end.getTime())
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : `${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return { day, month, weekday, time };
}

/**
 * Campus event card in two shapes: the homepage grid card and the demo
 * club-page horizontal row. Both share the brutal border + offset shadow.
 */
export default function CampusEventCard({ event, href, hostFallback, variant = 'card' }: CampusEventCardProps) {
  const dateParts = formatCampusDateParts(event.startAt || event.startDate || event.date, event.endAt || event.endDate);
  const status = (event.status || 'Upcoming').toUpperCase();
  const poster = resolveImageUrl(event.coverImageUrl, event.coverUrl, event.bannerUrl, event.coverImage?.url);

  if (variant === 'row') {
    return (
      <Link href={href} className="group block" aria-label={`View details for ${event.title}`}>
        <article className="flex flex-col gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm transition-all duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1 sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] font-display text-2xl font-bold text-[var(--text-primary)]">
            {dateParts.day}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {dateParts.weekday} · {dateParts.month}
            </p>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
              {event.title}
            </h3>
            <p className="mt-1 truncate text-sm font-medium text-[var(--text-secondary)]">
              {[dateParts.time, event.venue || event.location, typeof event.registeredCount === 'number' ? `${event.registeredCount} attending` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span className="shrink-0 self-start rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] sm:self-center">
            {status}
          </span>
        </article>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block" aria-label={`View details for ${event.title}`}>
      <article className="flex h-full flex-col rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-inverse)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-inverse)]">
            {status === 'ONGOING' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />}
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

        <h3
          className="font-display mt-5 text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]"
          title={event.title}
        >
          {event.title}
        </h3>
        <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
          {event.club?.name || hostFallback}
          {event.category ? ` · ${event.category}` : ''}
        </p>
        {event.description && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{event.description}</p>}

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

        <span className="mt-5 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-bold text-[var(--on-primary)]">
          View details &amp; RSVP
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </article>
    </Link>
  );
}
