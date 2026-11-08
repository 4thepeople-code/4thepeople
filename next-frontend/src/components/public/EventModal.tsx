'use client';

import React from 'react';
import Link from 'next/link';
import { X, Calendar, MapPin, Clock, Building2, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import type { Event, Club } from '@/types/models';

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
  const { isDark } = useTheme();
  if (!event) return null;

  const coverUrl = event.coverImage?.url || event.coverUrl || event.bannerUrl || event.coverImageUrl;
  const clubInfo = event.club || club;
  const hasGallery = Array.isArray(event.gallery) && event.gallery.length > 0;

  const clubHref = collegeSlug ? `/college/${collegeSlug}/clubs/${clubInfo?.id}` : `/clubs/${clubInfo?.id}`;
  const eventHref = collegeSlug
    ? `/college/${collegeSlug}/events/${event.id}`
    : `/events/${event.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl my-8 border transition-colors animate-in fade-in zoom-in-95 duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2.5 rounded-full border backdrop-blur-md transition-all shadow-lg cursor-pointer ${
            isDark
              ? 'bg-slate-950/60 hover:bg-slate-950 text-slate-400 hover:text-white border-slate-700/50'
              : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border-slate-200'
          }`}
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cover Image or Fallback Banner */}
        <div className="relative h-64 w-full bg-slate-800 overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/60 via-purple-900/50 to-slate-900 flex items-center justify-center p-6 text-center">
              <div className="space-y-2">
                <div className="inline-flex p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30">
                  <Calendar className="w-8 h-8" />
                </div>
                <p className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
                  {clubInfo?.name || 'Club Event'}
                </p>
              </div>
            </div>
          )}

          {/* Status Badge Overlay */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border backdrop-blur-md shadow-md ${
                event.status === 'ONGOING'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : event.status === 'COMPLETED'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : event.status === 'CANCELLED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
            >
              {event.status || 'UPCOMING'}
            </span>
            {clubInfo?.id && (
              <Link
                href={clubHref}
                onClick={onClose}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all backdrop-blur-md ${
                  isDark
                    ? 'bg-slate-950/70 text-slate-200 border-slate-700/60 hover:border-indigo-500'
                    : 'bg-white/90 text-slate-700 border-slate-300 hover:border-indigo-500'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{clubInfo.name}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <h2
              className={`text-2xl md:text-3xl font-extrabold tracking-tight uppercase font-['Syne',sans-serif] ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              {event.title}
            </h2>

            {/* Quick Meta Strip */}
            <div
              className={`flex flex-wrap items-center gap-y-2 gap-x-4 mt-3 text-xs ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-500" />
                <span>{formatDate(event.startAt || event.startDate || event.date)}</span>
              </div>

              {(event.startAt || event.startDate) && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>
                    {formatTime(event.startAt || event.startDate)}
                    {event.endAt ? ` - ${formatTime(event.endAt)}` : ''}
                  </span>
                </div>
              )}

              {(event.venue || event.location) && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>{event.venue || event.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              About This Event
            </h3>
            <p
              className={`text-sm leading-relaxed whitespace-pre-line ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {event.description || 'No detailed description provided for this campus event.'}
            </p>
          </div>

          {/* Action Row */}
          <div
            className={`pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {hasGallery && onOpenGallery && (
                <button
                  type="button"
                  onClick={() => onOpenGallery(event)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  <span>View Photos ({event.gallery?.length})</span>
                </button>
              )}
            </div>

            <Link
              href={eventHref}
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black text-xs font-extrabold uppercase tracking-wider transition shadow-md shadow-cyan-500/20"
            >
              <span>View Full Details & RSVP</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventModal;

