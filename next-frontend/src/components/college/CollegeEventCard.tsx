'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, MapPin, ArrowUpRight } from 'lucide-react';
import type { Event } from '@/types/models';
import { getEventCoverImage } from '@/lib/utils/eventCovers';

export interface CollegeEventCardProps {
  event: Event;
  href: string;
  variant?: 'card' | 'feature';
  onOpenModal?: (event: Event) => void;
}

const formatDateBadge = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${weekday}, ${month} ${day} · ${time.replace(' ', '')}`;
};

const formatTimeRange = (startDateStr?: string, endDateStr?: string) => {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (endDateStr) {
    const end = new Date(endDateStr);
    if (!isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${startTime} - ${endTime}`;
    }
  }
  return startTime;
};

export function CollegeEventCard({ event, href, variant = 'card', onOpenModal }: CollegeEventCardProps) {
  const router = useRouter();
  if (!event) return null;

  const coverUrl = getEventCoverImage(event);
  const clubName = event.club?.name || 'Student Club';
  const timeRange = formatTimeRange(event.startAt || event.startDate || event.date, event.endAt || event.endDate);
  const dateBadge = formatDateBadge(event.startAt || event.startDate || event.date);

  const isOngoing = event.status === 'ONGOING';
  const isUpcoming = event.status === 'UPCOMING';
  const fewSeats =
    isUpcoming &&
    typeof event.capacity === 'number' &&
    typeof event.registeredCount === 'number' &&
    event.capacity - event.registeredCount <= 2 &&
    event.capacity - event.registeredCount > 0;

  const statusBadge = isOngoing ? (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      LIVE
    </span>
  ) : fewSeats ? (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      FEW SEATS LEFT
    </span>
  ) : isUpcoming ? (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      UPCOMING
    </span>
  ) : null;

  const attendees = typeof event.registeredCount === 'number' ? event.registeredCount : 0;
  const attendeesText = attendees <= 0 ? 'Be the first to RSVP' : `${attendees} ${attendees === 1 ? 'student' : 'students'} going`;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onOpenModal) {
      onOpenModal(event);
    } else if (href) {
      router.push(href);
    }
  };

  if (variant === 'feature') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${event.title}`}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleCardClick(e as unknown as React.MouseEvent);
          }
        }}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-lg transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:shadow-brutal-lg hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] cursor-pointer"
      >
        <div className="absolute inset-0">
          {coverUrl ? (
            <img src={coverUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-tile)]">
              <span className="font-campus text-5xl font-bold text-[var(--text-primary)]" aria-hidden="true">
                {(clubName || 'C').trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-[var(--surface-inverse)]/75" />
        </div>

        {statusBadge && <div className="absolute left-2 top-2 z-10">{statusBadge}</div>}
        {dateBadge && (
          <div className="absolute right-2 top-2 z-10">
            <span className="inline-flex items-center rounded-full bg-[var(--surface-inverse)] px-3 py-1 text-[11px] font-bold text-[var(--text-inverse)]">
              {dateBadge}
            </span>
          </div>
        )}

        <div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 p-5">
          <h3
            className="font-campus text-3xl font-bold uppercase leading-[1.05] tracking-tight text-[var(--text-inverse)] line-clamp-2"
            title={event.title}
          >
            {event.title}
          </h3>
          <p className="truncate text-sm font-medium text-[var(--text-inverse)]/85">
            {clubName}
            {timeRange ? ` · ${timeRange}` : ''}
          </p>
          <div className="mt-auto pt-3">
            <Link
              href={href}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--accent-strong)] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-brutal-xs transition-all hover:opacity-95 hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            >
              <span>View Details & RSVP</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open details preview for ${event.title}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleCardClick(e as unknown as React.MouseEvent);
        }
      }}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:shadow-brutal-md hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] cursor-pointer"
    >
      {/* Cover Image Area */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[var(--surface-tile)] block border-b-2 border-[var(--border-soft)]">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-tile)]">
            <span className="font-campus text-5xl font-bold text-[var(--text-primary)]" aria-hidden="true">
              {(clubName || 'C').trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div aria-hidden="true" className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />

        {statusBadge && <div className="absolute left-2.5 top-2.5 z-10">{statusBadge}</div>}
        {dateBadge && (
          <div className="absolute right-2.5 top-2.5 z-10">
            <span className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-inverse)]/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-[var(--text-inverse)] shadow-sm">
              {dateBadge}
            </span>
          </div>
        )}
      </div>

      {/* Card Content Area */}
      <div className="flex min-h-0 flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <h3
            className="font-campus text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)] line-clamp-2"
            title={event.title}
          >
            {event.title}
          </h3>
          <p className="mt-2 truncate text-sm font-semibold text-[var(--text-secondary)]">{clubName}</p>

          {timeRange && (
            <p className="mt-2.5 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-secondary)]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
              <span>{timeRange}</span>
            </p>
          )}

          {(event.venue || event.location) && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-secondary)]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
              <span>{event.venue || event.location}</span>
            </p>
          )}

          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{attendeesText}</p>
        </div>

        {/* Action Button Container */}
        <div className="mt-5 border-t-2 border-[var(--border-soft)] pt-3.5">
          <Link
            href={href}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--accent-strong)] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-brutal-xs transition-all hover:opacity-95 hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
          >
            <span>View Details & RSVP</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default CollegeEventCard;
