'use client';

import React from 'react';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '@/lib/utils/cloudinary';
import { Sparkles } from 'lucide-react';
import type { Event } from '@/types/models';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Saturday, March 18, 9:30PM';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const time = d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(' ', '');

  return `${weekday}, ${month} ${day}, ${time}`;
};

export interface EventCardProps {
  event: Event;
  onClick?: () => void;
  badgeText?: string;
}

export function EventCard({ event, onClick, badgeText }: EventCardProps) {
  if (!event) return null;

  const rawCoverUrl =
    event.coverImage?.url || event.coverImageUrl || event.coverUrl || event.bannerUrl;
  const coverUrl = getCloudinaryUrl(rawCoverUrl, CLOUDINARY_TRANSFORMS.COVER);
  const clubName = event.club?.name || 'Student Club';

  const dateFormatted = formatDate(event.startAt || event.startDate || event.date);

  let locationFormatted = 'ONLINE EVENT - Attend anywhere';
  if (event.venue || event.location) {
    const loc = event.venue || event.location || '';
    locationFormatted = loc.toUpperCase().includes('ONLINE') ? loc : `${loc} - In-Person Event`;
  }

  const badge = badgeText || (event.isPaid ? `$${event.ticketPrice || 'PAID'}` : 'FREE');

  return (
    <div
      onClick={onClick}
      className="group relative w-full h-[400px] bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 rounded-[10px] figma-card-shadow transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer overflow-hidden select-none"
    >
      {/* Event Image Container */}
      <div className="absolute top-[20px] left-[20px] right-[19.67px] h-[240px] rounded-[5px] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={event.title || 'Event Cover'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 flex flex-col items-center justify-center p-4 text-white">
            <Sparkles className="w-10 h-10 mb-2 opacity-80 group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-100">
              {clubName}
            </span>
          </div>
        )}

        {/* Badge */}
        <div className="absolute top-[10px] left-[10px] px-[10px] py-[5px] bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-[5px] flex items-center justify-center gap-[10px] shadow-sm z-10 border border-slate-200/50 dark:border-white/10">
          <span className="text-[10px] leading-[12px] font-bold text-cyan-600 dark:text-[#00F0FF] tracking-wide text-center uppercase min-w-[22px]">
            {badge}
          </span>
        </div>
      </div>

      {/* Event Title */}
      <h3
        className="absolute top-[275px] left-[20px] right-[19.67px] h-[38px] text-[16px] leading-[19px] font-bold text-[#0F172A] dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-[#00F0FF] transition-colors"
        title={event.title}
      >
        {event.title || 'Campus Event'}
      </h3>

      {/* Date & Time */}
      <div className="absolute bottom-[56px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-semibold text-cyan-600 dark:text-[#00F0FF] truncate flex items-center gap-1.5">
        <span>{dateFormatted}</span>
      </div>

      {/* Event Location / Type */}
      <div className="absolute bottom-[20px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-normal text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
        <span>{locationFormatted}</span>
      </div>
    </div>
  );
}

export default EventCard;

