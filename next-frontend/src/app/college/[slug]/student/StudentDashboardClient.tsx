'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMyRegistrationsQuery,
  useUpcomingEvents,
  useCancelRegistrationMutation,
  useMyCertificatesQuery,
} from '@/lib/api/events';
import { useMeQuery } from '@/lib/api/auth';
import { useMyClubsQuery } from '@/lib/api/manager';
import PublicLayout from '@/components/public/PublicLayout';
import CollegeEventCard from '@/components/college/CollegeEventCard';
import EventModal from '@/components/public/EventModal';
import BrandLogo from '@/components/landing/BrandLogo';
import { LBRCE_LOGO_URL } from '@/components/public/PublicNavbar';
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
  CreditCard,
  Receipt,
  Sparkles,
} from 'lucide-react';
import type { Event, EventRegistration } from '@/types/models';
import { getEventCategory } from '@/lib/utils/categories';

export interface StudentDashboardClientProps {
  slug: string;
  initialTab?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: 'TBA', full: 'Date TBA', time: 'Time TBA' };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { day: 'TBA', month: 'TBA', weekday: 'TBA', full: 'Date TBA', time: 'Time TBA' };
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
  const [selectedEventModal, setSelectedEventModal] = useState<Event | null>(null);

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

  // Filtered upcoming events for Discover tab
  const filteredEvents = useMemo(() => {
    return upcomingEvents.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
      const evCat = getEventCategory(ev);
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.club?.name?.toLowerCase().includes(q) ||
        evCat.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'ALL' || evCat === selectedCategory;

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
        <div className="college-scope min-h-[calc(100vh-200px)] bg-[var(--surface-page)] flex flex-col items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 text-[var(--accent-strong)] animate-spin mb-4" />
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
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
      <div className="college-scope student-scope min-h-[calc(100vh-140px)] bg-[var(--surface-page)] text-[var(--text-primary)]">
        {/* Hero Banner Section */}
        <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 shadow-brutal-xs">
                    <BrandLogo size="sm" variant="dark" />
                    <span className="h-5 w-px bg-[var(--border-strong)]" />
                    <div className="flex items-center gap-1.5">
                      <img
                        src={LBRCE_LOGO_URL}
                        alt={`${collegeDisplay} Logo`}
                        className="h-6 w-6 rounded-full object-contain bg-white border border-[var(--border-strong)]"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span className="font-display text-[10px] font-black uppercase text-[var(--accent-strong)]">
                        {collegeDisplay}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)] shadow-brutal-xs">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Student Account</span>
                  </span>

                  {isManager && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 shadow-brutal-xs">
                      <Shield className="h-3.5 w-3.5 text-purple-500" />
                      <span>Club Manager ({myClubs.length})</span>
                    </span>
                  )}
                </div>

                <h1 className="font-campus text-4xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-5xl">
                  WELCOME BACK, <span className="text-[var(--accent-strong)]">{user.name || 'STUDENT'}.</span>
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {user.rollNumber && (
                    <span className="inline-flex items-center rounded-lg border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent-strong)] shadow-brutal-xs">
                      Roll: {user.rollNumber}
                    </span>
                  )}
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Quick Header Actions */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {isManager && (
                  <Link
                    href={`/college/${slug}/manager`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Manager Workspace</span>
                  </Link>
                )}

                <Link
                  href={`/college/${slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
                >
                  Campus Directory
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 px-4 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20 shadow-brutal-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Manager Workspace Callout Banner if authorized */}
            {isManager && (
              <div className="mt-8 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[var(--accent-strong)] shadow-brutal-xs">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                      Club Manager Workspace Available
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      You are an authorized manager for <strong>{myClubs.length} {myClubs.length === 1 ? 'club' : 'clubs'}</strong>. Switch anytime to create events and manage member registrations.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/college/${slug}/manager`}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs whitespace-nowrap shrink-0"
                >
                  <span>Switch to Manager</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Content Container */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
          {/* Feedback Alert */}
          {cancelFeedback && (
            <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-bold shadow-brutal-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{cancelFeedback}</span>
            </div>
          )}

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-2 border-b-2 border-[var(--border-soft)] pb-4 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('registrations')}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-brutal-xs ${
                activeTab === 'registrations'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>My Registrations ({myRegistrations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-brutal-xs ${
                activeTab === 'events'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Discover Events ({upcomingEvents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('certificates')}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-brutal-xs ${
                activeTab === 'certificates'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>My Certificates ({myCertificates.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-brutal-xs ${
                activeTab === 'profile'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Student Profile</span>
            </button>
          </div>

          {/* TAB 1: MY REGISTRATIONS */}
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    My registrations
                  </h2>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Events you have secured spots for. Present your registration or confirmation at the venue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchRegs()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs cursor-pointer"
                  title="Refresh registrations"
                  aria-label="Refresh registrations"
                >
                  <RefreshCw className={`w-4 h-4 ${regsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {regsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-56 rounded-3xl animate-pulse border-2 border-[var(--border-soft)] bg-[var(--surface-tile)]"
                    />
                  ))}
                </div>
              ) : myRegistrations.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-12 text-center shadow-brutal-xs space-y-4">
                  <Ticket className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      No event registrations yet
                    </h3>
                    <p className="text-xs max-w-sm mx-auto text-[var(--text-secondary)] font-medium">
                      You haven’t registered for any campus events yet. Explore the campus calendar to find upcoming workshops, hackathons, and activities.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('events')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-6 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs cursor-pointer"
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
                        className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm transition-shadow duration-200 hover:shadow-brutal-md"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 shadow-brutal-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>RSVP Confirmed</span>
                                </span>

                                {ev?.isPaid && (
                                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 shadow-brutal-xs">
                                    <CreditCard className="w-3 h-3" />
                                    <span>Paid • ₹{ev.fee || 0}</span>
                                  </span>
                                )}

                                {reg.paymentTransaction?.status === 'REFUNDED' && (
                                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 shadow-brutal-xs">
                                    <Receipt className="w-3 h-3" />
                                    <span>Refunded</span>
                                  </span>
                                )}

                                {ev?.club?.name && (
                                  <span className="truncate text-xs font-semibold text-[var(--accent-strong)]">
                                    • {ev.club.name}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
                                {ev?.title || 'Campus Event'}
                              </h3>
                            </div>

                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-center shadow-brutal-xs">
                              <span className="block font-black text-sm text-[var(--text-primary)] leading-none">{dateInfo.day}</span>
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">{dateInfo.month}</span>
                            </div>
                          </div>

                          {/* Event Specs Tile */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-3.5 text-xs text-[var(--text-secondary)]">
                            <div className="flex items-center gap-1.5 truncate">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-[var(--accent-strong)]" />
                              <span className="truncate">{dateInfo.time || 'Time TBA'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--accent-strong)]" />
                              <span className="truncate">{ev?.location || ev?.venue || 'Campus Auditorium'}</span>
                            </div>
                          </div>

                          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {ev?.description || 'Campus student activity.'}
                          </p>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[var(--border-soft)] pt-3 text-xs">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[var(--accent-strong)]" />
                              <span>Registered: {regDate.full}</span>
                            </span>
                            {reg.paymentTransactionId && (
                              <span className="text-[9px] font-mono text-[var(--accent-strong)] truncate max-w-[150px]" title={reg.paymentTransactionId}>
                                Txn: {reg.paymentTransactionId.slice(0, 8)}...
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {(ev?.isPaid || reg.paymentTransactionId) && (
                              <Link
                                href={`/college/${slug}/events/${reg.eventId}/payment/status${reg.paymentTransactionId ? `?transactionId=${reg.paymentTransactionId}` : ''}`}
                                className="inline-flex min-h-9 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)] shadow-brutal-xs"
                              >
                                Receipt
                              </Link>
                            )}

                            <Link
                              href={`/college/${slug}/events/${reg.eventId}`}
                              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-4 text-[11px] font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                            >
                              Details
                            </Link>

                            <button
                              type="button"
                              onClick={() => setCancellingReg(reg)}
                              className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10 shadow-brutal-xs"
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
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    Discover events
                  </h2>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Hackathons, workshops and competitions happening at {collegeDisplay}.
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, club or venue…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-xs font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {['ALL', 'TECHNOLOGY', 'CULTURAL', 'SPORTS', 'ARTS', 'LITERARY', 'SOCIAL'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory((prev) => (prev === cat ? 'ALL' : cat))}
                    className={`inline-flex min-h-8 cursor-pointer items-center rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all shadow-brutal-xs ${
                      selectedCategory === cat
                        ? 'border-[var(--border-strong)] bg-[var(--surface-inverse)] text-[var(--text-inverse)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {eventsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-72 rounded-3xl animate-pulse border-2 border-[var(--border-soft)] bg-[var(--surface-tile)]"
                    />
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-12 text-center shadow-brutal-xs space-y-2">
                  <Calendar className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                  <p className="font-display text-lg font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    No events match
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Try a different search term or clear the filters to see everything.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((ev) => (
                    <CollegeEventCard
                      key={ev.id}
                      event={ev}
                      href={`/college/${slug}/events/${ev.id}`}
                      onOpenModal={(e) => setSelectedEventModal(e)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MY CERTIFICATES */}
          {activeTab === 'certificates' && (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    My certificates
                  </h2>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Verified participation credentials issued for your completed campus events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchCerts()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs cursor-pointer"
                  title="Refresh certificates"
                  aria-label="Refresh certificates"
                >
                  <RefreshCw className={`w-4 h-4 ${certsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {certsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-56 rounded-3xl animate-pulse border-2 border-[var(--border-soft)] bg-[var(--surface-tile)]"
                    />
                  ))}
                </div>
              ) : myCertificates.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-12 text-center shadow-brutal-xs space-y-3">
                  <Award className="w-12 h-12 text-[var(--accent-strong)] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      No certificates earned yet
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto font-medium">
                      Certificates will appear here once event managers issue or generate official credentials for events you attended.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('events')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-6 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs cursor-pointer"
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
                        className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm flex flex-col justify-between space-y-4 hover:shadow-brutal-md transition-shadow relative overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-[var(--border-strong)] bg-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 shadow-brutal-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>Official Certificate</span>
                            </span>

                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              Issued:{' '}
                              {new Date(cert.issuedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)] line-clamp-1">
                              {cert.event?.title || 'Campus Event Participation'}
                            </h3>
                            <p className="text-xs font-semibold text-[var(--accent-strong)] mt-0.5">
                              {cert.event?.club?.name || `${collegeDisplay} Event`}
                            </p>
                          </div>

                          {/* Certificate Number with Copy Button */}
                          <div className="p-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] flex items-center justify-between text-xs font-mono shadow-brutal-xs">
                            <span className="text-[var(--accent-strong)] font-bold truncate">{cert.certificateNumber}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cert.certificateNumber);
                                setCopiedCertId(cert.certificateNumber);
                                setTimeout(() => setCopiedCertId(null), 2000);
                              }}
                              className="p-1 rounded-md hover:bg-[var(--surface-card)] text-[var(--text-primary)] transition shrink-0 ml-2 cursor-pointer"
                              title="Copy certificate ID"
                            >
                              {copiedCertId === cert.certificateNumber ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Download & Verification CTA Buttons */}
                        <div className="pt-3 border-t-2 border-dashed border-[var(--border-soft)] flex items-center gap-3">
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener"
                            className="flex-1 min-h-10 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[var(--accent-strong)] hover:opacity-95 text-white flex items-center justify-center gap-1.5 transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </a>

                          <Link
                            href={verifyUrl}
                            target="_blank"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
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
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                  Student profile
                </h2>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  Verified student roster credentials scoped to {collegeDisplay}.
                </p>
              </div>

              {profileLoading ? (
                <div className="p-8 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] animate-pulse flex items-center justify-center shadow-brutal-sm">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-strong)]" />
                </div>
              ) : (
                (() => {
                  const studentUser = (profileData as unknown as { user?: typeof user })?.user || user;
                  return (
                    <div className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] shadow-brutal-sm space-y-6">
                      <div className="flex items-center gap-4 border-b-2 border-[var(--border-soft)] pb-6">
                        <div className="w-14 h-14 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[var(--accent-strong)] flex items-center justify-center font-black text-xl shrink-0 shadow-brutal-xs">
                          {studentUser.name ? studentUser.name.slice(0, 2).toUpperCase() : 'ST'}
                        </div>
                        <div>
                          <h3 className="font-campus text-2xl uppercase tracking-wide text-[var(--text-primary)]">
                            {studentUser.name || 'Enrolled Student'}
                          </h3>
                          <p className="text-xs font-semibold text-[var(--text-secondary)]">
                            Active Campus Student Account
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Roll Number
                          </span>
                          <span className="font-mono font-bold text-sm text-[var(--accent-strong)]">
                            {studentUser.rollNumber || 'Not provided'}
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Institutional Email
                          </span>
                          <span className="font-bold text-xs truncate block text-[var(--text-primary)]">
                            {studentUser.email}
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Institution / Tenant
                          </span>
                          <span className="font-bold text-xs text-[var(--text-primary)]">
                            {collegeDisplay} ({slug})
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Account Status
                          </span>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified & Active</span>
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] flex items-center justify-between text-xs shadow-brutal-xs">
                        <div>
                          <p className="font-bold text-sm text-[var(--text-primary)]">Total Events Registered</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            All registered campus activities
                          </p>
                        </div>
                        <span className="font-campus text-3xl font-black text-[var(--accent-strong)]">
                          {myRegistrations.length}
                        </span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* CANCEL REGISTRATION CONFIRMATION MODAL */}
        {cancellingReg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md p-6 sm:p-7 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] shadow-brutal-lg space-y-4">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                  Cancel Event RSVP?
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-[var(--text-secondary)] font-medium">
                Are you sure you want to cancel your registration for{' '}
                <strong>{cancellingReg.event?.title || 'this event'}</strong>? Your spot will be released immediately to other students.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingReg(null)}
                  disabled={cancelMutation.isPending}
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] disabled:opacity-50 shadow-brutal-xs"
                >
                  Keep Registration
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelMutation.isPending}
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50 shadow-brutal-xs"
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

        {/* Event Quick View Modal */}
        {selectedEventModal && (
          <EventModal
            event={selectedEventModal}
            collegeSlug={slug}
            onClose={() => setSelectedEventModal(null)}
          />
        )}
      </div>
    </PublicLayout>
  );
}

export default StudentDashboardClient;
