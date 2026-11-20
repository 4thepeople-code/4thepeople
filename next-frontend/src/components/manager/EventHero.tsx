'use client';

import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Globe, Building2 } from 'lucide-react';
import type { Event } from '@/types/models';

export interface EventHeroProps {
  event: Event;
  children?: React.ReactNode;
  className?: string;
}

export function EventHero({ event, children, className = '' }: EventHeroProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  if (!event) return null;

  const rawCoverUrl = event.coverImageUrl || event.coverUrl || event.coverImage?.url;
  const category = event.category || 'CAMPUS EVENT';
  const status = event.status || 'UPCOMING';

  const formatEventDate = (dateStr?: string) => {
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

  const formatEventTime = (startStr?: string, endStr?: string | null) => {
    if (!startStr) return null;
    const s = new Date(startStr);
    if (isNaN(s.getTime())) return null;
    const startFormatted = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (endStr) {
      const e = new Date(endStr);
      if (!isNaN(e.getTime())) {
        return `${startFormatted} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
    }
    return startFormatted;
  };

  const showCover = Boolean(rawCoverUrl && !coverFailed);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden bg-slate-950 border border-[var(--line)] shadow-xl ${className}`}
    >
      <div className="relative w-full min-h-[300px] sm:min-h-[360px] flex flex-col justify-between p-6 sm:p-8">
        {/* Cover or Gradient Background */}
        {showCover ? (
          <img
            src={rawCoverUrl!}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950" />
        )}

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[var(--primary)] text-white font-bold text-[10px] uppercase tracking-wider shadow-sm">
              {category}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                status === 'CANCELLED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : status === 'COMPLETED'
                    ? 'bg-white/10 text-slate-300 border-white/20'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {status}
            </span>
            {event.visibility === 'PUBLIC' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                <Globe className="w-3 h-3" />
                <span>Public Event</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-white/10 text-slate-300 border-white/20">
                <Building2 className="w-3 h-3" />
                <span>College Only</span>
              </span>
            )}
          </div>

          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>

        {/* Bottom Event Details */}
        <div className="relative z-10 space-y-3 mt-12">
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold text-slate-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>{formatEventDate(event.startAt)}</span>
            </div>

            {event.startAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{formatEventTime(event.startAt, event.endAt)}</span>
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventHero;
