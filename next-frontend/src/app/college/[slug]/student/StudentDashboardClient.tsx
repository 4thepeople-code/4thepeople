'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  useMyRegistrationsQuery,
  useUpcomingEvents,
  useCancelRegistrationMutation,
  useMyCertificatesQuery,
} from '@/lib/api/events';
import { useMeQuery } from '@/lib/api/auth';
import { useMyClubsQuery } from '@/lib/api/manager';
import PublicLayout from '@/components/public/PublicLayout';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  User,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Search,
  Trash2,
  RefreshCw,
  ArrowRight,
  Shield,
  Building2,
  Award,
  Download,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { EventRegistration } from '@/types/models';

export interface StudentDashboardClientProps {
  slug: string;
  initialTab?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: 'TBA', full: 'Date TBA' };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { day: 'TBA', month: 'TBA', weekday: 'TBA', full: 'Date TBA' };
  return {
    day: d.getDate().toString().padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
    full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
};

export function StudentDashboardClient({ slug, initialTab = 'registrations' }: StudentDashboardClientProps) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { isDark } = useTheme();
  const collegeDisplay = slug.toUpperCase();

  const [activeTab, setActiveTab] = useState<'registrations' | 'events' | 'certificates' | 'profile'>(
    initialTab === 'events'
      ? 'events'
      : initialTab === 'certificates'
      ? 'certificates'
      : initialTab === 'profile'
      ? 'profile'
      : 'registrations'
  );

  const [copiedCertId, setCopiedCertId] = useState<string | null>(null);

  // Cancellation modal state
  const [cancellingReg, setCancellingReg] = useState<EventRegistration | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  // Event discovery filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Queries
  const {
    data: myRegistrations = [],
    isLoading: regsLoading,
    refetch: refetchRegs,
  } = useMyRegistrationsQuery(slug, Boolean(user));

  const {
    data: myCertificates = [],
    isLoading: certsLoading,
    refetch: refetchCerts,
  } = useMyCertificatesQuery(slug, Boolean(user));

  const {
    data: upcomingEvents = [],
    isLoading: eventsLoading,
  } = useUpcomingEvents(slug);

  const {
    data: profileData,
    isLoading: profileLoading,
  } = useMeQuery(slug);

  const { data: myClubs = [] } = useMyClubsQuery(slug, Boolean(user && user.role !== 'COLLEGE_ADMIN'));
  const isManager = myClubs.length > 0;

  const cancelMutation = useCancelRegistrationMutation(slug);

  // Auth Protection: Redirect unauthenticated students to login, and College Admins to Admin Workspace
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/college/${slug}/login?returnUrl=/college/${slug}/student`);
    } else if (!authLoading && user?.role === 'COLLEGE_ADMIN') {
      router.replace(`/college/${slug}/admin`);
    }
  }, [authLoading, user, slug, router]);

  // Registered event IDs set for quick lookup in Discover tab
  const registeredEventIds = useMemo(() => {
    return new Set(myRegistrations.map((r) => r.eventId));
  }, [myRegistrations]);

  // Filtered upcoming events for Discover tab
  const filteredEvents = useMemo(() => {
    return upcomingEvents.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.club?.name?.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'ALL' ||
        (ev.category && ev.category.toUpperCase().includes(selectedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [upcomingEvents, searchQuery, selectedCategory]);

  // Handle Cancel Registration Confirmation
  const handleConfirmCancel = async () => {
    if (!cancellingReg) return;
    try {
      setCancelFeedback(null);
      await cancelMutation.mutateAsync(cancellingReg.eventId);
      setCancelFeedback('Registration successfully cancelled.');
      setCancellingReg(null);
      setTimeout(() => setCancelFeedback(null), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to cancel registration.');
      setCancelFeedback(msg);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/college/${slug}`);
  };

  if (authLoading || (user && user.role === 'COLLEGE_ADMIN')) {
    return (
      <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
        <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 text-[#00F0FF] animate-spin mb-4" />
          <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            {user?.role === 'COLLEGE_ADMIN' ? 'Redirecting to College Admin Workspace...' : 'Verifying Student Session...'}
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (!user) {
    return null; // Redirecting via useEffect
  }

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Manager Workspace Banner if user has active club manager memberships */}
        {isManager && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-[#00F0FF] shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                  Club Manager Workspace Available
                </p>
                <p className="text-xs text-gray-300">
                  You are an authorized manager for <strong>{myClubs.length} {myClubs.length === 1 ? 'club' : 'clubs'}</strong>. Switch anytime to create events and manage member registrations.
                </p>
              </div>
            </div>
            <Link
              href={`/college/${slug}/manager`}
              className="px-4 py-2 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 whitespace-nowrap shrink-0"
            >
              <span>Switch to Manager Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Student Welcome Header Card */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-[11px] font-bold uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student Account • {collegeDisplay}</span>
              </div>
              {isManager && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-bold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Club Manager ({myClubs.length})</span>
                </div>
              )}
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-2xl sm:text-4xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              WELCOME BACK, <span className="text-[#00F0FF]">{user.name || 'STUDENT'}.</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {user.rollNumber && (
                <span className={`px-2.5 py-1 rounded-lg font-mono font-bold uppercase border ${
                  isDark ? 'bg-white/5 border-white/10 text-cyan-400' : 'bg-slate-100 border-slate-200 text-cyan-700'
                }`}>
                  Roll: {user.rollNumber}
                </span>
              )}
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {user.email}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {isManager && (
              <Link
                href={`/college/${slug}/manager`}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00F0FF] hover:bg-[#38f2ff] text-black transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Manager Workspace</span>
              </Link>
            )}
            <Link
              href={`/college/${slug}`}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Campus Directory
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {cancelFeedback && (
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 text-cyan-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <span>{cancelFeedback}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b pb-4 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'registrations'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/20'
                : isDark
                ? 'bg-white/5 text-gray-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>My Registrations ({myRegistrations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'events'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/20'
                : isDark
                ? 'bg-white/5 text-gray-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Discover Events ({upcomingEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificates')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'certificates'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/20'
                : isDark
                ? 'bg-white/5 text-gray-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>My Certificates ({myCertificates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/20'
                : isDark
                ? 'bg-white/5 text-gray-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Student Profile</span>
          </button>
        </div>

        {/* TAB 1: MY REGISTRATIONS */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                  Active Registrations & RSVPs
                </h2>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Events you have secured spots for. Present your registration or confirmation at the venue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchRegs()}
                className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                  isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Refresh registrations"
              >
                <RefreshCw className={`w-4 h-4 ${regsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {regsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-48 rounded-3xl animate-pulse border ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                    }`}
                  />
                ))}
              </div>
            ) : myRegistrations.length === 0 ? (
              <div
                className={`text-center py-16 rounded-3xl border space-y-4 ${
                  isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
                }`}
              >
                <Ticket className="w-12 h-12 text-gray-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className={`font-['Syne',sans-serif] text-lg font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    No Event Registrations Yet
                  </h3>
                  <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    You haven’t registered for any campus events yet. Explore the campus calendar to find upcoming workshops, hackathons, and activities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className="px-5 py-2.5 rounded-full bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider shadow-md shadow-cyan-500/20 cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Explore Campus Events</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myRegistrations.map((reg) => {
                  const ev = reg.event;
                  const dateInfo = formatDate(ev?.startAt);
                  const regDate = formatDate(reg.registeredAt);

                  return (
                    <div
                      key={reg.id}
                      className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between space-y-4 transition-all ${
                        isDark ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/30' : 'bg-white border-slate-200 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-400 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>RSVP Confirmed</span>
                              </span>
                              {ev?.club?.name && (
                                <span className={`text-[11px] font-semibold truncate ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                                  • {ev.club.name}
                                </span>
                              )}
                            </div>
                            <h3 className={`font-['Syne',sans-serif] text-lg font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                              {ev?.title || 'Campus Event'}
                            </h3>
                          </div>

                          <div className="px-3 py-1 rounded-xl bg-black/60 border border-white/15 text-center shrink-0">
                            <span className="block font-black text-sm text-white">{dateInfo.day}</span>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400">{dateInfo.month}</span>
                          </div>
                        </div>

                        {/* Event Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="truncate">{dateInfo.time || 'Time TBA'}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="truncate">{ev?.location || 'Campus Auditorium'}</span>
                          </div>
                        </div>

                        <p className={`text-[11px] line-clamp-2 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          {ev?.description || 'Campus student activity.'}
                        </p>
                      </div>

                      <div className={`pt-3 border-t flex items-center justify-between gap-3 text-xs ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                          Registered: {regDate.full}
                        </span>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/college/${slug}/events/${reg.eventId}`}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-[#00F0FF] font-bold text-[11px] uppercase tracking-wider transition"
                          >
                            Details
                          </Link>
                          <button
                            type="button"
                            onClick={() => setCancellingReg(reg)}
                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-[11px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISCOVER EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                  Upcoming Campus Events
                </h2>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Discover hackathons, workshops, and competitions happening at {collegeDisplay}.
                </p>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  className={`w-full pl-10 pr-4 py-2 rounded-xl border text-xs transition-all ${
                    isDark
                      ? 'bg-[#12141C] border-white/10 text-white placeholder-gray-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {['ALL', 'TECH', 'CULTURAL', 'SPORTS', 'WORKSHOP'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#00F0FF] text-black shadow-md shadow-cyan-500/20'
                      : isDark
                        ? 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {eventsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-64 rounded-3xl animate-pulse border ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                    }`}
                  />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div
                className={`text-center py-16 rounded-3xl border space-y-2 ${
                  isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <Calendar className="w-10 h-10 text-gray-400 mx-auto" />
                <p className="text-sm font-semibold">No events matching your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((ev) => {
                  const dateInfo = formatDate(ev.startAt);
                  const isRegistered = registeredEventIds.has(ev.id);

                  return (
                    <div
                      key={ev.id}
                      className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between space-y-4 transition-all ${
                        isDark ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/30' : 'bg-white border-slate-200 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-[10px] font-bold uppercase tracking-wider text-[#00F0FF]">
                            {ev.category || 'EVENT'}
                          </span>
                          {isRegistered && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-bold uppercase tracking-wider text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Registered</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className={`font-['Syne',sans-serif] text-base font-bold uppercase tracking-tight line-clamp-1 ${
                            isDark ? 'text-white' : 'text-[#0F172A]'
                          }`}>
                            {ev.title}
                          </h3>
                          <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {ev.club?.name || `${collegeDisplay} Club`}
                          </p>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <Calendar className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span>{dateInfo.full} • {dateInfo.time}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span>{ev.location || 'Campus Main Venue'}</span>
                          </div>
                        </div>
                      </div>

                      <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <Link
                          href={`/college/${slug}/events/${ev.id}`}
                          className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isRegistered
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-[#00F0FF] hover:bg-[#38f2ff] text-black shadow-md shadow-cyan-500/20'
                          }`}
                        >
                          <span>{isRegistered ? 'View RSVP Ticket' : 'View Details & RSVP'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY CERTIFICATES */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                  Official Event Certificates
                </h2>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Verified participation credentials issued for your completed campus club events.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchCerts()}
                className={`p-2 rounded-xl border text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Refresh certificates"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${certsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {certsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-48 rounded-3xl animate-pulse border ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                    }`}
                  />
                ))}
              </div>
            ) : myCertificates.length === 0 ? (
              <div
                className={`text-center py-16 rounded-3xl border space-y-3 ${
                  isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <Award className="w-12 h-12 text-cyan-400/50 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200">No Certificates Earned Yet</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Certificates will appear here once event managers issue or generate official credentials for events you attended.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Discover Upcoming Events</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myCertificates.map((cert) => {
                  const downloadUrl = `/api/certificates/${cert.id}/download?college=${slug}`;
                  const verifyUrl = `/college/${slug}/verify/${cert.certificateNumber}`;

                  return (
                    <div
                      key={cert.id}
                      className={`p-6 rounded-3xl border shadow-lg flex flex-col justify-between space-y-4 transition-all relative overflow-hidden ${
                        isDark
                          ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/30'
                          : 'bg-white border-slate-200 shadow-slate-200/50 hover:border-cyan-500/40'
                      }`}
                    >
                      {/* Top ribbon decoration */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/15 via-transparent to-transparent pointer-events-none" />

                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Official Certificate</span>
                          </span>

                          <span className="text-[11px] text-slate-400">
                            Issued:{' '}
                            {new Date(cert.issuedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <div>
                          <h3
                            className={`font-['Syne',sans-serif] text-lg font-bold uppercase tracking-tight line-clamp-1 ${
                              isDark ? 'text-white' : 'text-[#0F172A]'
                            }`}
                          >
                            {cert.event?.title || 'Campus Event Participation'}
                          </h3>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {cert.event?.club?.name || `${collegeDisplay} Event`}
                          </p>
                        </div>

                        {/* Certificate Number with Copy */}
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                            isDark ? 'bg-black/30 border-white/10' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span className="text-cyan-400 font-bold truncate">{cert.certificateNumber}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(cert.certificateNumber);
                              setCopiedCertId(cert.certificateNumber);
                              setTimeout(() => setCopiedCertId(null), 2000);
                            }}
                            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition shrink-0 ml-2"
                            title="Copy certificate ID"
                          >
                            {copiedCertId === cert.certificateNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Download & Verification CTA Buttons */}
                      <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener"
                          className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-1.5 transition shadow-sm shadow-cyan-500/20"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>

                        <Link
                          href={verifyUrl}
                          target="_blank"
                          className={`p-2.5 rounded-xl border transition ${
                            isDark
                              ? 'border-white/10 text-slate-300 hover:text-cyan-400 hover:bg-white/5'
                              : 'border-slate-200 text-slate-700 hover:text-cyan-600 hover:bg-slate-50'
                          }`}
                          title="Verify Certificate Authenticity"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENT PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                Student Institutional Profile
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Verified student roster credentials scoped to {collegeDisplay}.
              </p>
            </div>

            {profileLoading ? (
              <div className={`p-8 rounded-3xl border animate-pulse flex items-center justify-center ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
              }`}>
                <RefreshCw className="w-6 h-6 animate-spin text-[#00F0FF]" />
              </div>
            ) : (
              (() => {
                const studentUser = (profileData as unknown as { user?: typeof user })?.user || user;
                return (
                  <div
                    className={`p-6 sm:p-8 rounded-3xl border shadow-lg space-y-6 transition-all ${
                      isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4 border-b pb-6">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-[#00F0FF] flex items-center justify-center font-black text-xl shrink-0">
                        {studentUser.name ? studentUser.name.slice(0, 2).toUpperCase() : 'ST'}
                      </div>
                      <div>
                        <h3 className={`font-['Syne',sans-serif] text-lg font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                          {studentUser.name || 'Enrolled Student'}
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Active Campus Student Account
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Roll Number
                        </span>
                        <span className="font-mono font-bold text-sm text-[#00F0FF]">
                          {studentUser.rollNumber || 'N/A'}
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Institutional Email
                        </span>
                        <span className="font-bold text-xs truncate block">
                          {studentUser.email}
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Institution / Tenant
                        </span>
                        <span className="font-bold text-xs">
                          {collegeDisplay} ({slug})
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Account Status
                        </span>
                        <span className="font-bold text-xs text-emerald-400 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified & Active</span>
                        </span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <p className="font-bold">Total Events Registered</p>
                        <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          All registered campus activities
                        </p>
                      </div>
                      <span className="text-xl font-black text-[#00F0FF]">
                        {myRegistrations.length}
                      </span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* CANCEL REGISTRATION CONFIRMATION MODAL */}
        {cancellingReg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
                isDark ? 'bg-[#12141C] border-white/10 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
              }`}
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="font-['Syne',sans-serif] text-lg font-bold uppercase tracking-tight">
                  Cancel Event RSVP?
                </h3>
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                Are you sure you want to cancel your registration for{' '}
                <strong>{cancellingReg.event?.title || 'this event'}</strong>? Your spot will be released immediately to other students.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingReg(null)}
                  disabled={cancelMutation.isPending}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                    isDark ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  Keep Registration
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                >
                  {cancelMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Cancellation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default StudentDashboardClient;
