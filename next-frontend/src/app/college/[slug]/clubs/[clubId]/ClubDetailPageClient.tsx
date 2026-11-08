'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub } from '@/lib/api/clubs';
import { useClubUpcomingEvents, useClubPastEvents } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import { useTheme } from '@/context/ThemeContext';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '@/lib/utils/cloudinary';
import { getClubCoverImage } from '@/lib/utils/clubCovers';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import type { Event } from '@/types/models';

export interface ClubDetailPageClientProps {
  slug: string;
  clubId: string;
}

const DEFAULT_CLUB_IMAGE =
  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=200&auto=format&fit=crop';

const formatDateParts = (dateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return { day, month };
};

export function ClubDetailPageClient({ slug, clubId }: ClubDetailPageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  // Scoped queries
  const { data: club, isLoading: clubLoading, isError: clubError, error: clubErr, refetch: refetchClub } = useClub(slug, clubId);
  const { data: upcomingEvents = [], isLoading: upcomingLoading, isError: upcomingError } = useClubUpcomingEvents(slug, clubId);
  const { data: pastEvents = [], isLoading: pastLoading, isError: pastError } = useClubPastEvents(slug, clubId);

  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  const collegeDisplay = slug.toUpperCase();

  const logoUrl = club
    ? getCloudinaryUrl(club.logo?.url || club.logoUrl, CLOUDINARY_TRANSFORMS.LOGO)
    : null;

  const coverUrl = club ? getClubCoverImage(club) : null;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Back Link */}
        <Link
          href={`/college/${slug}/clubs`}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold uppercase transition cursor-pointer ${
            isDark
              ? 'bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20'
              : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Clubs</span>
        </Link>

        {/* Club Profile Hero Section */}
        {clubLoading ? (
          <div
            className={`h-64 rounded-3xl animate-pulse border ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}
          />
        ) : clubError || !club ? (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-3xl text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="text-xl font-extrabold text-white font-['Syne',sans-serif]">Club Not Found</h2>
            <p className="text-sm text-red-300">
              {clubErr instanceof Error ? clubErr.message : 'The requested club could not be loaded.'}
            </p>
            <button
              type="button"
              onClick={() => refetchClub()}
              className="px-5 py-2.5 bg-red-500/20 text-red-200 rounded-full text-xs font-bold uppercase cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            className={`rounded-3xl border overflow-hidden transition-colors ${
              isDark ? 'bg-[#12141C] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-md'
            }`}
          >
            {/* Cover Image */}
            <div className="relative h-36 sm:h-44 bg-gray-900 overflow-hidden">
              <img
                src={coverUrl || DEFAULT_CLUB_IMAGE}
                alt={`${club.name} cover`}
                className="w-full h-full object-cover"
              />
              <div
                className={`absolute inset-0 ${
                  isDark
                    ? 'bg-gradient-to-t from-[#12141C] via-black/30 to-transparent'
                    : 'bg-gradient-to-t from-white/90 via-black/20 to-transparent'
                }`}
              />

              <div className="absolute top-4 right-4">
                <span className="px-3.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-extrabold uppercase tracking-widest text-[#00F0FF]">
                  {club.category || 'CAMPUS ORGANIZATION'}
                </span>
              </div>
            </div>

            {/* Club Information */}
            <div className="p-6 sm:p-10 pt-0 relative">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-12 sm:-mt-16 mb-6">
                <div className="flex items-end gap-4">
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-4 shadow-xl bg-gray-900 shrink-0 ${
                      isDark ? 'border-[#12141C]' : 'border-white'
                    }`}
                  >
                    <img
                      src={logoUrl || DEFAULT_CLUB_IMAGE}
                      alt={`${club.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-[#00F0FF] tracking-widest">
                      {club.category || 'CAMPUS ORGANIZATION'}
                    </span>
                    <h1
                      className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      {club.name}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-4 py-2 rounded-full border text-xs font-bold ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-gray-300'
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {club._count?.members || club.membersCount || club.memberCount || 100}+ Members
                  </span>
                </div>
              </div>

              <p
                className={`text-sm leading-relaxed max-w-4xl font-normal ${
                  isDark ? 'text-gray-300' : 'text-slate-600'
                }`}
              >
                {club.description ||
                  'Active student organization committed to fostering skills, projects, and collaboration across campus.'}
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Events Section */}
        <section className="space-y-6">
          <div
            className={`flex items-center justify-between border-b pb-4 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <span className="text-xs font-extrabold uppercase text-[#00F0FF]">Live Schedule</span>
              <h2
                className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Upcoming <span className="text-[#00F0FF]">Events</span>
              </h2>
            </div>
          </div>

          {upcomingLoading ? (
            <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Loading upcoming events...
            </div>
          ) : upcomingError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              Failed to load upcoming events for this club.
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div
              className={`text-center py-12 rounded-3xl border text-sm ${
                isDark
                  ? 'bg-[#12141C] border-white/10 text-gray-400'
                  : 'bg-white border-slate-200 text-slate-500 shadow-xs'
              }`}
            >
              No upcoming events currently scheduled for {club?.name || 'this club'}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((evt) => {
                const dateParts = formatDateParts(evt.startAt || evt.startDate || evt.date);

                return (
                  <div
                    key={evt.id}
                    onClick={() => router.push(`/college/${slug}/events/${evt.id}`)}
                    className={`group rounded-2xl overflow-hidden border transition-all p-5 cursor-pointer flex flex-col justify-between ${
                      isDark
                        ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40'
                        : 'bg-white border-slate-200 hover:border-cyan-500/50 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center font-['Syne',sans-serif] leading-none shrink-0 ${
                            isDark
                              ? 'bg-black border-white/20 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        >
                          <span className="text-[9px] text-[#00F0FF] font-bold uppercase">{dateParts.month}</span>
                          <span className="text-lg font-black">{dateParts.day}</span>
                        </div>

                        <div>
                          <h3
                            className={`font-['Syne',sans-serif] text-lg font-bold group-hover:text-[#00F0FF] transition-colors line-clamp-1 ${
                              isDark ? 'text-white' : 'text-[#0F172A]'
                            }`}
                          >
                            {evt.title}
                          </h3>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {evt.venue || evt.location || 'Campus Main Auditorium'}
                          </span>
                        </div>
                      </div>

                      <p
                        className={`text-xs line-clamp-2 leading-relaxed mb-4 ${
                          isDark ? 'text-gray-300' : 'text-slate-600'
                        }`}
                      >
                        {evt.description}
                      </p>
                    </div>

                    <div
                      className={`pt-3 border-t flex items-center justify-between text-xs font-bold text-[#00F0FF] ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                      }`}
                    >
                      <span>RSVP Open</span>
                      <span className="group-hover:translate-x-1 transition-transform">View Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Past Events & Gallery Section */}
        <section className="space-y-6 pt-6">
          <div
            className={`flex items-center justify-between border-b pb-4 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <span className="text-xs font-extrabold uppercase text-purple-400">Archives</span>
              <h2
                className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Past Events & <span className="text-purple-500">Gallery</span>
              </h2>
            </div>
          </div>

          {pastLoading ? (
            <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Loading past events...
            </div>
          ) : pastError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              Failed to load past events.
            </div>
          ) : pastEvents.length === 0 ? (
            <div
              className={`text-center py-12 rounded-3xl border text-sm ${
                isDark
                  ? 'bg-[#12141C] border-white/10 text-gray-400'
                  : 'bg-white border-slate-200 text-slate-500 shadow-xs'
              }`}
            >
              No completed past events recorded yet for {club?.name || 'this club'}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((evt) => {
                const eventImage =
                  evt.coverImage?.url ||
                  evt.coverUrl ||
                  evt.bannerUrl ||
                  evt.coverImageUrl ||
                  DEFAULT_CLUB_IMAGE;

                return (
                  <div
                    key={evt.id}
                    onClick={() => setActiveGalleryEvent(evt)}
                    className={`group rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                      isDark
                        ? 'bg-[#12141C] border-white/10 hover:border-purple-400/50'
                        : 'bg-white border-slate-200 hover:border-purple-400/60 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div className="relative h-44 w-full bg-gray-900 overflow-hidden">
                      <img src={eventImage} alt={`${evt.title} cover`} className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold uppercase backdrop-blur-md">
                        COMPLETED
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h3
                          className={`font-['Syne',sans-serif] text-lg font-bold group-hover:text-purple-400 transition line-clamp-1 ${
                            isDark ? 'text-white' : 'text-[#0F172A]'
                          }`}
                        >
                          {evt.title}
                        </h3>
                        <p
                          className={`text-xs line-clamp-2 mt-1 ${
                            isDark ? 'text-gray-400' : 'text-slate-500'
                          }`}
                        >
                          {evt.description}
                        </p>
                      </div>

                      <div
                        className={`pt-3 border-t flex items-center justify-between text-xs font-bold text-purple-500 ${
                          isDark ? 'border-white/5' : 'border-slate-100'
                        }`}
                      >
                        <span>Completed Event</span>
                        <span className="group-hover:underline">View Gallery →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Lightbox Photo Gallery */}
      {activeGalleryEvent && (
        <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />
      )}
    </PublicLayout>
  );
}

export default ClubDetailPageClient;

