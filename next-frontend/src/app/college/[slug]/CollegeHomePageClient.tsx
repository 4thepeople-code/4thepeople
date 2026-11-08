'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Users,
  Search,
  X,
  Layers,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useUpcomingEvents } from '@/lib/api/events';
import { useClubs } from '@/lib/api/clubs';
import { useTheme } from '@/context/ThemeContext';
import PublicLayout from '@/components/public/PublicLayout';
import EventModal from '@/components/public/EventModal';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import { getClubCoverImage } from '@/lib/utils/clubCovers';
import type { Event } from '@/types/models';

export interface CollegeHomePageClientProps {
  slug: string;
}

const formatDateParts = (dateString?: string, endDateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: 'Time TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA', weekday: 'TBA', time: 'Time TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const weekday = dateObj.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
  let time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (endDateString) {
    const endObj = new Date(endDateString);
    if (!isNaN(endObj.getTime())) {
      const endTime = endObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      time = `${time} - ${endTime}`;
    }
  }

  return { day, month, weekday, time };
};

const categories = ['ALL', 'TECHNOLOGY', 'CULTURAL', 'SPORTS', 'ARTS', 'LITERARY', 'SOCIAL'];

const categoryList = [
  { code: '01', name: 'TECHNOLOGY', count: '14 CLUBS', eventsCount: '28 EVENTS', description: 'Hackathons, AI, Software, Coding Challenges & Cloud Dev.', accent: '#00F0FF' },
  { code: '02', name: 'CULTURAL', count: '08 CLUBS', eventsCount: '16 EVENTS', description: 'Music, Dance, Stage Plays, Campus Celebrations & Concerts.', accent: '#EC4899' },
  { code: '03', name: 'SPORTS', count: '10 CLUBS', eventsCount: '22 EVENTS', description: 'Tournaments, Esports, Fitness Challenges & Athletics.', accent: '#F59E0B' },
  { code: '04', name: 'ARTS', count: '06 CLUBS', eventsCount: '12 EVENTS', description: 'Photography, Digital Illustration, UI/UX & Fine Arts.', accent: '#8B5CF6' },
  { code: '05', name: 'LITERARY', count: '05 CLUBS', eventsCount: '09 EVENTS', description: 'Debates, Poetry Slams, Creative Writing & Journalism.', accent: '#10B981' },
  { code: '06', name: 'SOCIAL', count: '07 CLUBS', eventsCount: '15 EVENTS', description: 'Volunteering, Sustainability, Social Outreach & Networking.', accent: '#3B82F6' },
];

const benefits = [
  { num: '01', title: 'WORD OF MOUTH VERIFIED', description: 'Heard friends talking about a hackathon or concert? Find official timings, venues, and registration links instantly here.', highlight: 'Instant access' },
  { num: '02', title: 'DIRECT REGISTRATIONS', description: 'No confusing forms. Click through to RSVP or join event queues organized directly by student club leaders.', highlight: 'Quick RSVP' },
  { num: '03', title: 'DISCOVER YOUR TRIBE', description: 'Connect with communities that match your passion, from coding to dance, theatre to robotics.', highlight: 'Real community' },
  { num: '04', title: 'BUILD EXPERIENCES', description: 'Turn ideas into memories. Participate, volunteer, or lead teams in campus-wide events.', highlight: 'Hands-on leadership' },
];

export function CollegeHomePageClient({ slug }: CollegeHomePageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  // TanStack Query Hooks scoped strictly to tenant slug
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useUpcomingEvents(slug);
  const { data: clubs = [], isLoading: clubsLoading, error: clubsError } = useClubs(slug);

  // Student Search & Category Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Modals & Lightbox
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  // Filter events based on search and category
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.club?.name?.toLowerCase().includes(q);

      const matchesCategory =
        activeCategory === 'ALL' ||
        ev.category?.toUpperCase() === activeCategory ||
        ev.club?.category?.toUpperCase().includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, activeCategory]);

  const spotlightEvent = events[0];
  const nextUpEvents = events.slice(1, 3);

  const handleNavigateToEvent = (ev: Event) => {
    if (!ev) return;
    router.push(`/college/${slug}/events/${ev.id}`);
  };

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* 🔴 HIGH-SPEED CAMPUS DISPATCH TICKER */}
      {events.length > 0 && (
        <div
          className={`relative w-full border-b overflow-hidden flex items-center transition-colors h-12 ${
            isDark ? 'bg-[#0B0C10] border-white/10' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex-1 h-full overflow-hidden relative flex items-center">
            <div className="flex w-max items-center animate-scroll-x hover:[animation-play-state:paused]">
              {[...events, ...events, ...events, ...events].map((ev, idx) => {
                const dateParts = formatDateParts(ev.startAt || ev.startDate || ev.date);
                return (
                  <button
                    key={`${ev.id}-${idx}`}
                    type="button"
                    onClick={() => handleNavigateToEvent(ev)}
                    className="inline-flex items-center gap-3 px-5 py-1.5 group cursor-pointer transition-all hover:bg-white/10 rounded-xl mx-1.5 shrink-0 text-left border border-transparent hover:border-white/10"
                  >
                    <span className="font-mono text-[11px] font-black uppercase tracking-widest text-cyan-400 group-hover:text-cyan-300 transition-colors">
                      {ev.club?.name || collegeDisplay}
                    </span>
                    <span className="text-white/20 text-xs font-light">/</span>
                    <span className="font-semibold text-slate-200 group-hover:text-white transition-colors text-sm whitespace-nowrap">
                      {ev.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 group-hover:text-white transition-colors bg-white/10 px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 ml-1">
                      <Calendar className="w-3 h-3 opacity-60" />
                      {dateParts.month} {dateParts.day}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-cyan-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 1. STUDENT-FOCUSED HERO SECTION */}
      <section
        className={`relative pt-10 pb-4 md:pt-8 md:pb-4 flex items-center overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-[#0B0C10]' : 'bg-[#FAF9F5]'
        }`}
      >
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none ${
            isDark
              ? 'bg-gradient-to-tr from-cyan-500/12 via-blue-600/8 to-pink-500/10'
              : 'bg-gradient-to-tr from-cyan-500/8 via-indigo-500/5 to-pink-500/8'
          }`}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Headline & Search */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <h1
                className={`font-['Poppins'] text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.96] uppercase mb-4 ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                HEARD ABOUT AN EVENT? <br />
                <span
                  className={`text-transparent italic font-light bg-clip-text ${
                    isDark
                      ? 'bg-gradient-to-r from-[#00F0FF] via-cyan-200 to-white'
                      : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-[#0F172A]'
                  }`}
                >
                  FIND IT RIGHT HERE.
                </span>
              </h1>

              <p
                className={`text-base sm:text-lg max-w-xl font-normal leading-relaxed mb-6 ${
                  isDark ? 'text-gray-300' : 'text-slate-600'
                }`}
              >
                Look up event timings, venues, organizing clubs, and direct registration links for all campus activities at {collegeDisplay}.
              </p>

              {/* Instant Search Bar */}
              <div className="relative max-w-xl mb-4">
                <div
                  className={`flex items-center rounded-2xl border transition-all p-1.5 shadow-sm ${
                    isDark
                      ? 'bg-[#12141C] border-white/15 focus-within:border-cyan-400 focus-within:shadow-cyan-500/20'
                      : 'bg-white border-slate-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
                  }`}
                >
                  <div className="pl-3.5 pr-2 text-cyan-500">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by event title, club name, or venue..."
                    className={`w-full bg-transparent text-sm font-medium focus:outline-hidden py-2 ${
                      isDark ? 'text-white placeholder-gray-500' : 'text-[#0F172A] placeholder-slate-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className={`p-1.5 rounded-lg mr-1 transition-colors ${
                        isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href="#upcoming-events"
                    className="px-4 py-2 bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-sm cursor-pointer"
                  >
                    Find
                  </a>
                </div>
              </div>

              {/* Quick Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none max-w-xl">
                <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Quick Filter:
                </span>
                {categories.slice(0, 5).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                      activeCategory === cat
                        ? 'bg-[#00F0FF] text-black border-[#00F0FF] shadow-xs'
                        : isDark
                        ? 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Quick Stats Strip */}
              <div
                className={`mt-6 pt-5 border-t flex items-center gap-6 text-xs font-medium ${
                  isDark ? 'border-white/10 text-gray-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />
                  <span>
                    <strong className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {events.length}+
                    </strong>{' '}
                    Events Scheduled
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />
                  <span>
                    <strong className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {clubs.length}+
                    </strong>{' '}
                    Campus Clubs
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Spotlight Event Card */}
            <div className="lg:col-span-5">
              {spotlightEvent ? (
                <div
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden shadow-xl ${
                    isDark ? 'bg-[#12141C] border-white/15 shadow-cyan-500/5' : 'bg-white border-slate-200 shadow-slate-200'
                  }`}
                >
                  <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={
                        spotlightEvent.coverImage?.url ||
                        spotlightEvent.coverUrl ||
                        spotlightEvent.bannerUrl ||
                        spotlightEvent.coverImageUrl ||
                        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop'
                      }
                      alt={spotlightEvent.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-wider text-[#00F0FF]">
                        ★ SPOTLIGHT EVENT
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        RSVP Open
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-3 z-10 text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{spotlightEvent.club?.name || `${collegeDisplay} Club`}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <h3
                        className={`font-['Syne',sans-serif] text-xl font-bold uppercase tracking-tight line-clamp-1 ${
                          isDark ? 'text-white' : 'text-[#0F172A]'
                        }`}
                      >
                        {spotlightEvent.title}
                      </h3>
                      <p
                        className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                          isDark ? 'text-gray-300' : 'text-slate-600'
                        }`}
                      >
                        {spotlightEvent.description || 'Join this exciting student-organized event on campus. Meet members, learn new skills, and connect.'}
                      </p>
                    </div>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div
                        className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                          isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
                        <span className="truncate font-medium">
                          {formatDateParts(spotlightEvent.startAt || spotlightEvent.startDate || spotlightEvent.date, spotlightEvent.endAt).day}{' '}
                          {formatDateParts(spotlightEvent.startAt || spotlightEvent.startDate || spotlightEvent.date, spotlightEvent.endAt).month} •{' '}
                          {formatDateParts(spotlightEvent.startAt || spotlightEvent.startDate || spotlightEvent.date, spotlightEvent.endAt).time}
                        </span>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                          isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-purple-500 shrink-0" />
                        <span className="truncate font-medium">{spotlightEvent.venue || spotlightEvent.location || 'Campus Auditorium'}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleNavigateToEvent(spotlightEvent)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-cyan-500/25 cursor-pointer group"
                      >
                        <span>View Event Details & RSVP</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    {/* Next Up Mini-List */}
                    {nextUpEvents.length > 0 && (
                      <div className={`pt-3 border-t text-xs ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-2 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Also Coming Up Next:
                        </p>
                        <div className="space-y-1.5">
                          {nextUpEvents.map((nextEv) => (
                            <div
                              key={nextEv.id}
                              onClick={() => handleNavigateToEvent(nextEv)}
                              className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                                isDark
                                  ? 'bg-white/5 border-white/5 hover:border-cyan-500/40'
                                  : 'bg-[#FAF9F5] border-slate-200 hover:border-cyan-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                <span className={`font-semibold truncate text-xs ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                                  {nextEv.title}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                                {formatDateParts(nextEv.startAt || nextEv.startDate || nextEv.date, nextEv.endAt).day}{' '}
                                {formatDateParts(nextEv.startAt || nextEv.startDate || nextEv.date, nextEv.endAt).month}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`p-8 rounded-3xl border text-center ${
                    isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <Calendar className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold">{eventsLoading ? 'Loading upcoming events...' : 'No upcoming events scheduled.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. UPCOMING & RECENT EVENTS SECTION */}
      <section
        id="upcoming-events"
        className={`py-16 md:py-20 relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-[#0F1117]' : 'bg-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={`flex flex-col lg:flex-row lg:items-end justify-between mb-10 pb-6 border-b gap-6 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Campus Event Schedule</span>
              </div>
              <h2
                className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-extrabold uppercase tracking-tight ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                RECENT & UPCOMING <span className="text-[#00F0FF]">EVENTS</span>
              </h2>
              <p
                className={`text-sm sm:text-base max-w-xl mt-1.5 font-normal ${
                  isDark ? 'text-gray-400' : 'text-slate-600'
                }`}
              >
                Find full schedules, locations, host clubs, and RSVP details for {collegeDisplay}.
              </p>
            </div>

            {/* Category Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                    activeCategory === cat
                      ? 'bg-[#00F0FF] text-black border-[#00F0FF] shadow-xs'
                      : isDark
                      ? 'bg-white/5 text-gray-300 border-white/10 hover:border-white/25 hover:text-white'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search Result Feedback Bar */}
          {searchQuery && (
            <div
              className={`mb-6 p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
                isDark ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
              }`}
            >
              <span>
                Showing results matching &quot;<strong>{searchQuery}</strong>&quot; ({filteredEvents.length} found)
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="underline hover:no-underline font-bold text-xs cursor-pointer ml-3"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Events Grid */}
          {eventsLoading ? (
            <div className={`text-center py-16 text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
              Loading upcoming campus events...
            </div>
          ) : eventsError ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              Failed to load upcoming events for this college.
            </div>
          ) : filteredEvents.length === 0 ? (
            <div
              className={`text-center py-16 px-4 rounded-3xl border ${
                isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-[#FAF9F5] border-slate-200 text-slate-500'
              }`}
            >
              <Calendar className="w-10 h-10 text-cyan-500 mx-auto mb-3 opacity-60" />
              <p className="text-base font-bold mb-1">No events match your criteria</p>
              <p className="text-xs max-w-sm mx-auto mb-4">Try clearing your search query or choosing another category.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('ALL');
                }}
                className="px-4 py-2 bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => {
                const dateParts = formatDateParts(event.startAt || event.startDate || event.date, event.endAt);

                return (
                  <div
                    key={event.id}
                    onClick={() => handleNavigateToEvent(event)}
                    className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                      isDark
                        ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10'
                        : 'bg-white border-slate-200 hover:border-cyan-400 shadow-xs hover:shadow-lg'
                    }`}
                  >
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-slate-900">
                      <img
                        src={
                          event.coverImage?.url ||
                          event.coverUrl ||
                          event.bannerUrl ||
                          event.coverImageUrl ||
                          'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=600&auto=format&fit=crop'
                        }
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-center shadow-md">
                        <span className="block font-['Syne',sans-serif] text-base font-black leading-none text-white">
                          {dateParts.day}
                        </span>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                          {dateParts.month}
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-wider text-[#00F0FF]">
                          {event.category || 'EVENT'}
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-xs text-white">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-200 truncate text-[11px]">
                          <Building2 className="w-3 h-3 shrink-0 text-cyan-400" />
                          <span className="truncate">{event.club?.name || `${collegeDisplay} Club`}</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-300 shrink-0">
                          {dateParts.weekday}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3
                          className={`font-['Syne',sans-serif] text-lg font-bold uppercase tracking-tight line-clamp-1 transition-colors ${
                            isDark ? 'text-white group-hover:text-cyan-400' : 'text-[#0F172A] group-hover:text-cyan-600'
                          }`}
                          title={event.title}
                        >
                          {event.title}
                        </h3>

                        <div className="mt-2 space-y-1.5 text-xs font-medium">
                          <div className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="truncate font-mono">
                              {dateParts.weekday}, {dateParts.month} {dateParts.day} • {dateParts.time}
                            </span>
                          </div>

                          <div className={`flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="truncate font-semibold">{event.venue || event.location || 'Campus Main Venue'}</span>
                          </div>
                        </div>

                        <p
                          className={`text-xs mt-2.5 line-clamp-2 leading-relaxed ${
                            isDark ? 'text-gray-400' : 'text-slate-600'
                          }`}
                        >
                          {event.description || 'Student event with workshops, guest speakers, activities, and peer networking.'}
                        </p>
                      </div>

                      <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToEvent(event);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs hover:shadow-cyan-500/20 cursor-pointer group/btn"
                        >
                          <span>View Event Details & RSVP</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. CAMPUS CLUBS SECTION */}
      <section
        id="featured-clubs"
        className={`py-16 md:py-20 relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-[#0B0C10]' : 'bg-[#FAF9F5]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={`flex flex-col md:flex-row md:items-end justify-between mb-10 pb-6 border-b gap-4 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Users className="w-3.5 h-3.5" />
                <span>Student Organizations</span>
              </div>
              <h2
                className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-extrabold uppercase tracking-tight ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                EXPLORE CAMPUS <span className="text-[#00F0FF]">CLUBS</span>
              </h2>
              <p
                className={`text-sm sm:text-base max-w-xl mt-1.5 font-normal ${
                  isDark ? 'text-gray-400' : 'text-slate-600'
                }`}
              >
                The student communities hosting these events across {collegeDisplay}. Join a club to participate, organize, or lead.
              </p>
            </div>

            <Link
              href={`/college/${slug}/clubs`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#38f2ff] transition-all shadow-sm cursor-pointer self-start md:self-end"
            >
              <span>View All Clubs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Clubs Grid */}
          {clubsLoading ? (
            <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Loading campus clubs...
            </div>
          ) : clubsError ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              Failed to load campus clubs.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubs.slice(0, 6).map((club) => (
                <div
                  key={club.id}
                  onClick={() => router.push(`/college/${slug}/clubs/${club.id}`)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                    isDark
                      ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5'
                      : 'bg-white border-slate-200 hover:border-cyan-500/40 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div className="relative h-20 w-full overflow-hidden bg-slate-900">
                    <img
                      src={getClubCoverImage(club)}
                      alt={club.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-extrabold uppercase tracking-widest text-[#00F0FF]">
                        {club.category || 'CLUB'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3
                        className={`font-['Syne',sans-serif] text-xl font-bold tracking-tight uppercase group-hover:text-cyan-600 dark:group-hover:text-[#00F0FF] transition-colors ${
                          isDark ? 'text-white' : 'text-[#0F172A]'
                        }`}
                      >
                        {club.name}
                      </h3>
                      <p
                        className={`text-xs mt-1.5 leading-relaxed line-clamp-2 ${
                          isDark ? 'text-gray-300' : 'text-slate-600'
                        }`}
                      >
                        {club.description || 'Student organization promoting innovation, collaboration, and learning on campus.'}
                      </p>
                    </div>

                    <div
                      className={`pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                        isDark ? 'border-white/10 text-gray-400' : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-500" />
                        <span>{club._count?.members || club.membersCount || club.memberCount || 100}+ Members</span>
                      </span>

                      <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-[#00F0FF] font-extrabold uppercase text-[11px] group-hover:translate-x-1 transition-transform">
                        <span>Explore</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. EVENT CATEGORIES SECTION */}
      <section
        className={`py-16 md:py-20 relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-[#0F1117]' : 'bg-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={`flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b gap-4 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Browse By Interest</span>
              </div>
              <h2
                className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-extrabold uppercase tracking-tight ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                EVENT <span className="text-[#00F0FF]">CATEGORIES</span>
              </h2>
            </div>
            <p className={`text-xs sm:text-sm max-w-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Click on any discipline to immediately filter campus events and clubs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryList.map((cat) => (
              <div
                key={cat.code}
                onClick={() => {
                  setActiveCategory(cat.name);
                  const el = document.getElementById('upcoming-events');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`group relative rounded-2xl p-5 border transition-all duration-300 cursor-pointer ${
                  isDark
                    ? 'border-white/10 bg-[#12141C] hover:bg-[#161924] hover:border-cyan-500/50'
                    : 'border-slate-200 bg-[#FAF9F5] hover:bg-white hover:border-cyan-400 shadow-2xs hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`font-['Syne',sans-serif] text-xs font-black px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-white/10 text-gray-300' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat.code}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    {cat.eventsCount}
                  </span>
                </div>

                <h3
                  className={`font-['Syne',sans-serif] text-xl font-bold uppercase tracking-tight group-hover:text-cyan-600 dark:group-hover:text-[#00F0FF] transition-colors mb-1 ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  {cat.name}
                </h3>

                <p className={`text-xs line-clamp-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  {cat.description}
                </p>

                <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-cyan-600 dark:text-[#00F0FF]">
                  <span>Filter Events</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHY JOIN SECTION */}
      <section
        className={`py-16 md:py-20 relative overflow-hidden transition-colors duration-300 ${
          isDark ? 'bg-[#0B0C10]' : 'bg-[#FAF9F5]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Community</span>
            </div>

            <h2
              className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-extrabold uppercase tracking-tight leading-[0.96] ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              CAMPUS IS <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-cyan-400 to-pink-500">
                BETTER TOGETHER.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((item) => (
              <div
                key={item.num}
                className={`p-6 sm:p-7 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isDark
                    ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40'
                    : 'bg-white border-slate-200 hover:border-cyan-400 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-['Syne',sans-serif] text-3xl font-black text-cyan-500 opacity-60">
                      {item.num}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                        isDark ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {item.highlight}
                    </span>
                  </div>

                  <h3
                    className={`font-['Syne',sans-serif] text-xl font-bold uppercase tracking-tight mb-2 ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {item.title}
                  </h3>

                  <p
                    className={`text-xs sm:text-sm leading-relaxed font-normal ${
                      isDark ? 'text-gray-300' : 'text-slate-600'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>

                <div
                  className={`mt-5 pt-3 border-t flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 ${
                    isDark ? 'border-white/5' : 'border-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Open to all enrolled students at {collegeDisplay}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA BANNER */}
      <section
        className={`py-16 md:py-20 border-t relative overflow-hidden text-center transition-colors duration-300 ${
          isDark ? 'bg-[#0F1117] border-white/10 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-widest border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Never Miss A Beat</span>
          </div>

          <h2
            className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-black uppercase tracking-tight ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            YOUR CAMPUS. YOUR EVENTS.
          </h2>

          <p
            className={`text-sm sm:text-base font-normal max-w-lg mx-auto ${
              isDark ? 'text-gray-300' : 'text-slate-600'
            }`}
          >
            Discover student clubs, reserve your spot at upcoming events, and make campus life truly memorable.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#upcoming-events"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:bg-[#38f2ff] hover:scale-105 transition-all cursor-pointer"
            >
              <span>FIND AN EVENT NOW</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href={`/college/${slug}/clubs`}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border text-xs font-extrabold uppercase tracking-wider transition-all ${
                isDark
                  ? 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
            >
              <span>EXPLORE ALL CLUBS</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. EVENT MODAL & GALLERY LIGHTBOX */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          collegeSlug={slug}
          onClose={() => setSelectedEvent(null)}
          onOpenGallery={(ev) => {
            setSelectedEvent(null);
            setActiveGalleryEvent(ev);
          }}
        />
      )}

      {activeGalleryEvent && (
        <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />
      )}
    </PublicLayout>
  );
}

export default CollegeHomePageClient;
