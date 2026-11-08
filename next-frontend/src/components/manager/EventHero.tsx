'use client';

import React, { useState } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
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
      className={`relative w-full rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl ${className}`}
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
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950 via-slate-950 to-indigo-950" />
        )}

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00F0FF] text-black font-extrabold text-[10px] uppercase tracking-wider shadow-md">
              {category}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                status === 'CANCELLED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : status === 'COMPLETED'
                    ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {status}
            </span>
          </div>

          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>

        {/* Bottom Event Details */}
        <div className="relative z-10 space-y-3 mt-12">
          <h1 className="font-['Syne',sans-serif] text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#00F0FF]" />
              <span>{formatEventDate(event.startAt)}</span>
            </div>

            {event.startAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
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
