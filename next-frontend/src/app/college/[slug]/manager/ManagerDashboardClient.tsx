'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMyClubsQuery, fetchClubDashboard, fetchManagedClubEvents } from '@/lib/api/manager';
import type { Club, Event } from '@/types/models';
import ManagerLayout from '@/components/manager/ManagerLayout';
import {
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Pencil,
  MapPin,
  Compass,
} from 'lucide-react';
import { getEventCoverImage } from '@/lib/utils/eventCovers';

export interface ManagerDashboardClientProps {
  slug: string;
}

export function ManagerDashboardClient({ slug }: ManagerDashboardClientProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [currentDateString, setCurrentDateString] = useState('');

  useEffect(() => {
    setCurrentDateString(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    );
  }, []);

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  // Fetch Manager's Assigned Clubs
  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsError,
    error: clubsErrObj,
    refetch: refetchClubs,
  } = useMyClubsQuery(slug);

  // Aggregated data state for detailed member count and club events
  const [detailedClubs, setDetailedClubs] = useState<Club[]>([]);
  const [allEvents, setAllEvents] = useState<Array<Event & { clubName?: string; clubId: string }>>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // When clubs load, fetch details and events in parallel
  useEffect(() => {
    let isSubscribed = true;
    if (clubs.length === 0) {
      setDetailedClubs([]);
      setAllEvents([]);
      setTotalMembers(0);
      return;
    }

    setFetchingDetails(true);
    void Promise.all(
      clubs.map(async (c) => {
        try {
          const detail = await fetchClubDashboard(c.id);
          let clubEvents: Event[] = [];
          try {
            clubEvents = await fetchManagedClubEvents(c.id);
          } catch {
            // Non-fatal
          }
          return { club: detail || c, events: clubEvents };
        } catch {
          return { club: c, events: [] };
        }
      })
    )
      .then((results) => {
        if (!isSubscribed) return;
        let memberCount = 0;
        const aggregatedEvents: Array<Event & { clubName?: string; clubId: string }> = [];
        const updatedClubs: Club[] = [];

        for (const res of results) {
          updatedClubs.push(res.club);
          if (Array.isArray(res.club.members)) {
            memberCount += res.club.members.length;
          } else if (typeof res.club.memberCount === 'number') {
            memberCount += res.club.memberCount;
          }

          for (const evt of res.events) {
            aggregatedEvents.push({
              ...evt,
              clubName: res.club.name,
              clubId: res.club.id,
            });
          }
        }

        setDetailedClubs(updatedClubs);
        setTotalMembers(memberCount);
        setAllEvents(aggregatedEvents);
      })
      .finally(() => {
        if (isSubscribed) setFetchingDetails(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [clubs]);

  const loading = clubsLoading || (clubs.length > 0 && detailedClubs.length === 0 && fetchingDetails);
  const managerName = user?.name || user?.email?.split('@')[0] || 'Manager';
  const displayClubs = detailedClubs.length > 0 ? detailedClubs : clubs;

  const handleRefresh = () => {
    refetchClubs();
  };

  // Split events into Upcoming, Completed, Cancelled
  const { upcomingEvents, completedEvents, cancelledEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: Array<Event & { clubName?: string; clubId: string }> = [];
    const completed: Array<Event & { clubName?: string; clubId: string }> = [];
    const cancelled: Array<Event & { clubName?: string; clubId: string }> = [];

    for (const evt of allEvents) {
      if (evt.status === 'CANCELLED') {
        cancelled.push(evt);
        continue;
      }
      if (evt.status === 'ONGOING' || evt.status === 'UPCOMING') {
        upcoming.push(evt);
        continue;
      }
      if (evt.status === 'COMPLETED') {
        completed.push(evt);
        continue;
      }

      const dStr = evt.startAt || evt.startDate;
      if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime()) && d < now) {
          completed.push(evt);
          continue;
        }
      }
      upcoming.push(evt);
    }

    return {
      upcomingEvents: upcoming,
      completedEvents: completed,
      cancelledEvents: cancelled,
    };
  }, [allEvents]);

  // Filtered list by status tab
  const filteredEvents = useMemo(() => {
    if (statusFilter === 'UPCOMING') return upcomingEvents;
    if (statusFilter === 'COMPLETED') return completedEvents;
    if (statusFilter === 'CANCELLED') return cancelledEvents;
    return allEvents;
  }, [statusFilter, allEvents, upcomingEvents, completedEvents, cancelledEvents]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-10">
        {/* 1. Header Banner */}
        <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                Event Manager
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
                {slug ? slug.toUpperCase() : 'CAMPUS'}
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-4xl">
              Welcome back, <span className="italic font-bold text-[var(--primary)]">{managerName}</span>
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--ink-soft)] sm:text-sm">
              <span className="flex items-center gap-1.5 font-medium" suppressHydrationWarning>
                <Calendar className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                {currentDateString || 'Today'}
              </span>
              <span className="hidden text-[var(--line)] sm:inline" aria-hidden="true">
                ·
              </span>
              <span>Monitor club performance, track live RSVPs, and coordinate campus events.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${fetchingDetails ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            {displayClubs.length > 0 && (
              <Link
                href={getPath(`/manager/clubs/${displayClubs[0].id}/events/create`)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--primary-strong)] cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create Event</span>
              </Link>
            )}
          </div>
        </header>

        {/* Error Alert */}
        {clubsError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span>
                {(clubsErrObj as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                  'Failed to load manager dashboard.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-200/60 px-3 py-1 text-xs font-bold uppercase transition hover:bg-rose-200 dark:bg-rose-900/50 dark:hover:bg-rose-900"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 2. Management Statistics (5 Cards) */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Management Statistics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {/* Stat 1: Managed Clubs */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors hover:border-[var(--primary)]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Managed Clubs
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
                {loading ? '…' : clubs.length}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Active club assignments</p>
            </div>

            {/* Stat 2: Total Members */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors hover:border-[var(--primary)]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Total Members
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--secondary-soft)] text-[var(--secondary)]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
                {loading ? '…' : totalMembers > 0 ? totalMembers : '—'}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Across your managed clubs</p>
            </div>

            {/* Stat 3: Total Events */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors hover:border-[var(--primary)]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Total Events
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
                {loading ? '…' : allEvents.length}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Created by your clubs</p>
            </div>

            {/* Stat 4: Upcoming Events */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors hover:border-[var(--primary)]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Upcoming
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
                {loading ? '…' : upcomingEvents.length}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Scheduled or live now</p>
            </div>

            {/* Stat 5: Completed Events */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors hover:border-[var(--primary)]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Past Events
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
                {loading ? '…' : completedEvents.length}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Completed campus events</p>
            </div>
          </div>
        </section>

        {/* 3. Club Quick Actions Banner */}
        {displayClubs.length === 1 ? (
          <section aria-label="Club Quick Actions">
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary-soft)]/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-white"
                >
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                    Primary club: {displayClubs[0].name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                    Manage schedules, members, and event registrations directly
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={getPath(`/manager/clubs/${displayClubs[0].id}/events/create`)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--primary-strong)] cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Create event</span>
                </Link>
                <Link
                  href={`/college/${slug}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)] cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  <span>Browse public feed</span>
                </Link>
              </div>
            </div>
          </section>
        ) : displayClubs.length > 1 ? (
          <section aria-label="Campus Directory Preview">
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5 text-xs text-[var(--ink-soft)]">
                <Compass className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <span>See how your clubs and events appear to students on the public campus directory</span>
              </div>
              <Link
                href={`/college/${slug}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)] cursor-pointer"
              >
                <span>Browse public feed</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {/* 4. Managed Clubs Section */}
        <section aria-labelledby="managed-clubs-heading" className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="managed-clubs-heading"
                className="font-display text-xl font-bold tracking-tight text-[var(--ink)]"
              >
                Managed clubs
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">
                Clubs where you have event manager permissions
              </p>
            </div>

            {displayClubs.length > 0 && (
              <Link
                href={getPath('/manager/clubs')}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-[var(--primary)] transition-colors hover:underline"
              >
                <span>View all clubs</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-56 animate-dashboard-skeleton rounded-3xl border border-[var(--line)] bg-[var(--surface)]"
                />
              ))}
            </div>
          ) : displayClubs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center">
              <Building2 className="mx-auto mb-4 h-10 w-10 text-[var(--ink-soft)]/50" />
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">No Managed Clubs Assigned</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">
                You are not currently assigned to manage any clubs. Contact your college administrator to grant manager access.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {displayClubs.map((club) => {
                const logoUrl = club.logoUrl || club.logo?.url;
                const clubEventsCount = allEvents.filter((e) => e.clubId === club.id).length;
                const memberCount = Array.isArray(club.members)
                  ? club.members.length
                  : typeof club.memberCount === 'number'
                  ? club.memberCount
                  : 0;

                return (
                  <article
                    key={club.id}
                    className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs transition-colors duration-150 hover:border-[var(--primary)]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-2xl border border-[var(--line)] object-cover shadow-xs"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--primary-soft)] font-display text-base font-bold text-[var(--primary)] shadow-xs"
                            >
                              {club.name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-base font-bold text-[var(--ink)]">
                              {club.name}
                            </h3>
                            <p className="truncate text-xs font-semibold text-[var(--primary)]">Event Manager</p>
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)] min-h-[2.5rem]">
                        {club.description || 'No description provided for this campus club.'}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-soft)]">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Users className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" aria-hidden="true" />
                          <span>
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-[var(--secondary)] shrink-0" aria-hidden="true" />
                          <span>{clubEventsCount} events</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
                      <Link
                        href={getPath(`/manager/clubs/${club.id}`)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)]"
                      >
                        <span>Manage club</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <Link
                        href={getPath(`/manager/clubs/${club.id}/events/create`)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Create event</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 5. Events Management Section */}
        <section aria-labelledby="events-heading" className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="events-heading" className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
                Events
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">
                Manage schedules, seat limits, and attendance
              </p>
            </div>

            {allEvents.length > 0 && (
              <div
                role="tablist"
                aria-label="Filter events by status"
                className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xs"
              >
                {[
                  { key: 'ALL' as const, label: 'All', count: allEvents.length },
                  { key: 'UPCOMING' as const, label: 'Upcoming', count: upcomingEvents.length },
                  { key: 'COMPLETED' as const, label: 'Completed', count: completedEvents.length },
                  { key: 'CANCELLED' as const, label: 'Cancelled', count: cancelledEvents.length },
                ].map((tab) => {
                  const isActive = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--line)]/50 text-[var(--ink-soft)]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-64 animate-dashboard-skeleton rounded-3xl border border-[var(--line)] bg-[var(--surface)]"
                />
              ))}
            </div>
          ) : allEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center">
              <Calendar className="mx-auto mb-4 h-10 w-10 text-[var(--ink-soft)]/50" />
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">No Events Published</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">
                You haven&apos;t created any events for your managed clubs yet. Choose a club above to publish your first event.
              </p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center">
              <Calendar className="mx-auto mb-4 h-10 w-10 text-[var(--ink-soft)]/50" />
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">No {statusFilter.toLowerCase()} events</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">
                There are no events currently marked as {statusFilter.toLowerCase()}.
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary-soft)] px-4 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors cursor-pointer"
              >
                View all events
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => {
                const coverUrl = getEventCoverImage(event);

                const statusBadge = (() => {
                  if (event.status === 'ONGOING') {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live now
                      </span>
                    );
                  }
                  if (event.status === 'COMPLETED') {
                    return (
                      <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                        Completed
                      </span>
                    );
                  }
                  if (event.status === 'CANCELLED') {
                    return (
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-300">
                        Cancelled
                      </span>
                    );
                  }
                  const dStr = event.startAt || event.startDate;
                  if (dStr) {
                    const d = new Date(dStr);
                    if (!isNaN(d.getTime()) && d < new Date()) {
                      return (
                        <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Completed
                        </span>
                      );
                    }
                  }
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/25 bg-[var(--primary-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                      Upcoming
                    </span>
                  );
                })();

                return (
                  <article
                    key={event.id}
                    className="flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xs transition-colors duration-150 hover:border-[var(--primary)]"
                  >
                    <div>
                      {/* Image / Header area */}
                      <div className="relative h-40 w-full overflow-hidden bg-[var(--bg)]">
                        {coverUrl ? (
                          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary-soft)]/50 to-[var(--bg)] p-4">
                            <Calendar className="h-10 w-10 text-[var(--ink-soft)]/30" />
                          </div>
                        )}

                        <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                          {event.clubName && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                              <Building2 className="h-3 w-3" />
                              <span className="max-w-[140px] truncate">{event.clubName}</span>
                            </span>
                          )}
                          <div className="pointer-events-auto ml-auto">{statusBadge}</div>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-5">
                        <h3 className="line-clamp-1 font-display text-base font-bold tracking-tight text-[var(--ink)]">
                          {event.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-[var(--ink-soft)]">
                          {event.description || 'No description provided.'}
                        </p>

                        <div className="mt-4 space-y-1.5 text-xs text-[var(--ink-soft)]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                            <span className="truncate font-medium">{formatDate(event.startAt || event.startDate)}</span>
                          </div>

                          {formatTime(event.startAt || event.startDate) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                              <span className="truncate">{formatTime(event.startAt || event.startDate)}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--secondary)]" aria-hidden="true" />
                            <span className="truncate">{event.location || event.venue || 'Location TBA'}</span>
                          </div>
                        </div>

                        {/* Capacity meter */}
                        {typeof event.capacity === 'number' && event.capacity > 0 && (
                          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 p-2.5">
                            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--ink-soft)]">
                              <span className="uppercase tracking-wider">Capacity</span>
                              <span>
                                {typeof event.registeredCount === 'number'
                                  ? `${event.registeredCount} / ${event.capacity} registered`
                                  : `${event.capacity} seats limit`}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                              <div
                                className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                                style={{
                                  width: `${Math.min(((event.registeredCount || 0) / event.capacity) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] p-4 pt-3">
                      <Link
                        href={getPath(`/manager/clubs/${event.clubId}/events/${event.id}`)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Manage event</span>
                      </Link>
                      <Link
                        href={`/college/${slug}/events/${event.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
                      >
                        <span>Public page</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ManagerLayout>
  );
}

export default ManagerDashboardClient;
