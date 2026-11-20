'use client';

import React from 'react';
import Link from 'next/link';
import { X, Calendar, MapPin, Clock, Building2, Globe, Image as ImageIcon, ArrowUpRight } from 'lucide-react';
import type { Event, Club } from '@/types/models';
import { getEventCoverImage } from '@/lib/utils/eventCovers';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export interface EventModalProps {
  event: Event | null;
  club?: Club | null;
  collegeSlug?: string;
  onClose: () => void;
  onOpenGallery?: (event: Event) => void;
}

export function EventModal({ event, club, collegeSlug, onClose, onOpenGallery }: EventModalProps) {
  if (!event) return null;

  const coverUrl = getEventCoverImage(event);
  const clubInfo = event.club || club;
  const hasGallery = Array.isArray(event.gallery) && event.gallery.length > 0;

  const clubHref = collegeSlug ? `/college/${collegeSlug}/clubs/${clubInfo?.id}` : `/clubs/${clubInfo?.id}`;
  const eventHref = collegeSlug
    ? `/college/${collegeSlug}/events/${event.id}`
    : `/events/${event.id}`;

  const isOngoing = event.status === 'ONGOING';
  const isCompleted = event.status === 'COMPLETED';
  const isCancelled = event.status === 'CANCELLED';

  const timeString = formatTime(event.startAt || event.startDate);
  const endTimeString = event.endAt ? formatTime(event.endAt) : '';
  const fullTimeString = timeString ? (endTimeString ? `${timeString} - ${endTimeString}` : timeString) : 'Time TBA';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-event-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="college-scope relative w-full max-w-2xl rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-brutal-lg my-8 overflow-hidden transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 grid h-11 w-11 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)] shadow-brutal-xs transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cover Image or Fallback Banner */}
        <div className="relative h-64 sm:h-72 w-full bg-[var(--surface-tile)] overflow-hidden border-b-2 border-[var(--border-strong)]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--surface-tile)] text-[var(--text-primary)]">
              <span className="font-campus text-7xl font-bold opacity-30">
                {(clubInfo?.name || 'CAMPUS').charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Dark gradient for text readability */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          {/* Badges on Poster */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2 z-10">
            <span
              className={`inline-flex items-center rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-brutal-xs ${
                isOngoing
                  ? 'bg-emerald-500 text-white'
                  : isCompleted
                  ? 'bg-blue-600 text-white'
                  : isCancelled
                  ? 'bg-rose-600 text-white'
                  : 'bg-[var(--accent-strong)] text-white'
              }`}
            >
              {event.status || 'UPCOMING'}
            </span>

            {event.visibility === 'PUBLIC' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                <Globe className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                <span>Public Event</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                <Building2 className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                <span>Campus Only</span>
              </span>
            )}

            {clubInfo?.id && (
              <Link
                href={clubHref}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs transition-colors hover:bg-[var(--surface-tile)]"
              >
                <Building2 className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                <span>{clubInfo.name}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <h2
              id="modal-event-title"
              className="font-campus text-3xl sm:text-4xl font-bold uppercase leading-tight tracking-tight text-[var(--text-primary)]"
            >
              {event.title}
            </h2>

            {/* Quick Meta Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3.5 py-1.5 text-[var(--text-primary)]">
                <Calendar className="w-4 h-4 text-[var(--accent-strong)]" />
                <span>{formatDate(event.startAt || event.startDate || event.date)}</span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3.5 py-1.5 text-[var(--text-primary)]">
                <Clock className="w-4 h-4 text-[var(--accent-strong)]" />
                <span>{fullTimeString}</span>
              </div>

              {(event.venue || event.location) && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3.5 py-1.5 text-[var(--text-primary)]">
                  <MapPin className="w-4 h-4 text-[var(--accent-strong)]" />
                  <span>{event.venue || event.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)] mb-2">
              About This Event
            </p>
            <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
              {event.description || 'No detailed description provided for this campus event.'}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t-2 border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {hasGallery && onOpenGallery && (
                <button
                  type="button"
                  onClick={() => onOpenGallery(event)}
                  className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs transition-colors hover:bg-[var(--surface-tile)] cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[var(--accent-strong)]" />
                  <span>View Photos ({event.gallery?.length})</span>
                </button>
              )}
            </div>

            <Link
              href={eventHref}
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-[var(--accent-strong)] hover:bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-transform hover:-translate-y-0.5"
            >
              <span>View Full Details &amp; RSVP</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventModal;
