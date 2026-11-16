'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useMyClubsQuery,
  fetchClubDashboard,
  fetchManagedClubEvents,
} from '@/lib/api/manager';
import type { Club, Event } from '@/types/models';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import Skeleton, { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { actions, eventManager, roleNames } from '@/lib/copy';
import { useOpenCreateEvent } from './ManagerDashboardFrame';

export interface ManagerDashboardClientProps {
  slug: string;
}

interface ManagedClubEvent extends Event {
  clubName?: string;
  clubId?: string;
}

type EventFilterType = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

/** Stable empty arrays: fresh `= []` defaults change identity every render
 *  and would re-trigger the aggregation effect below on each render. */
const EMPTY_CLUBS: Club[] = [];
const EMPTY_EVENTS: ManagedClubEvent[] = [];

function formatEventDate(dateStr?: string) {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Event Manager overview: personalized greeting, verified operational metrics,
 * managed club management, published event administration, and direct shortcuts.
 * Visually unified with the homepage design language and semantic token system.
 */
export default function ManagerDashboardClient({ slug }: ManagerDashboardClientProps) {
  const t = eventManager.dashboard;
  const { user } = useAuth();
  const openCreateEvent = useOpenCreateEvent();

  const [detailedClubs, setDetailedClubs] = useState<Club[]>([]);
  const [allEvents, setAllEvents] = useState<ManagedClubEvent[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<EventFilterType>('ALL');

  // Hydration-safe live date display
  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    );
  }, []);

  const {
    data: clubsData,
    isLoading: clubsLoading,
    isError: clubsIsError,
    refetch: refetchClubs,
  } = useMyClubsQuery(slug);

  // Referentially stable clubs array
  const clubs = useMemo(() => clubsData ?? EMPTY_CLUBS, [clubsData]);

  // Aggregate club dashboard details & events
  useEffect(() => {
    let isSubscribed = true;

    if (clubs.length === 0) {
      setDetailedClubs((prev) => (prev.length > 0 ? EMPTY_CLUBS : prev));
      setAllEvents((prev) => (prev.length > 0 ? EMPTY_EVENTS : prev));
      setTotalMembers((prev) => (prev !== 0 ? 0 : prev));
      setDetailsLoading(false);
      return;
    }

    setDetailsLoading(true);

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
        const aggregatedEvents: ManagedClubEvent[] = [];
        const updatedClubs: Club[] = [];

        for (const res of results) {
          updatedClubs.push(res.club);
          if (Array.isArray(res.club.members)) {
            memberCount += res.club.members.length;
          } else if (typeof res.club.memberCount === 'number') {
            memberCount += res.club.memberCount;
          }
          for (const evt of res.events) {
            aggregatedEvents.push({ ...evt, clubName: res.club.name, clubId: res.club.id });
          }
        }

        setDetailedClubs(updatedClubs);
        setTotalMembers(memberCount);
        setAllEvents(aggregatedEvents);
      })
      .finally(() => {
        if (isSubscribed) {
          setDetailsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [clubs]);

  const displayClubs = detailedClubs.length > 0 ? detailedClubs : clubs;
  const isInitialLoading = clubsLoading || (clubs.length > 0 && detailsLoading && detailedClubs.length === 0);
  const hasError = clubsIsError;

  const handleRefresh = () => {
    void refetchClubs();
  };

  // Event categorization based on current time & statuses
  const { upcomingEvents, completedEvents, cancelledEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: ManagedClubEvent[] = [];
    const completed: ManagedClubEvent[] = [];
    const cancelled: ManagedClubEvent[] = [];

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

      // Fallback inference from dates
      if (evt.startAt) {
        const start = new Date(evt.startAt);
        if (!isNaN(start.getTime()) && start >= now) {
          upcoming.push(evt);
          continue;
        }
      }
      completed.push(evt);
    }

    return {
      upcomingEvents: upcoming,
      completedEvents: completed,
      cancelledEvents: cancelled,
    };
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    switch (eventFilter) {
      case 'UPCOMING':
        return upcomingEvents;
      case 'COMPLETED':
        return completedEvents;
      case 'CANCELLED':
        return cancelledEvents;
      default:
        return allEvents;
    }
  }, [eventFilter, allEvents, upcomingEvents, completedEvents, cancelledEvents]);

  const renderStatusChip = (evt: ManagedClubEvent) => {
    if (evt.status === 'ONGOING') {
      return <Chip variant="success" dot>{t.statusOngoing}</Chip>;
    }
    if (evt.status === 'COMPLETED') {
      return <Chip variant="neutral">{t.statusCompleted}</Chip>;
    }
    if (evt.status === 'CANCELLED') {
      return <Chip variant="danger">{t.statusCancelled}</Chip>;
    }
    if (evt.startAt) {
      const start = new Date(evt.startAt);
      if (!isNaN(start.getTime()) && start < new Date()) {
        return <Chip variant="neutral">{t.statusCompleted}</Chip>;
      }
    }
    return <Chip variant="brand" dot>{t.statusUpcoming}</Chip>;
  };

  // 1. Loading State: Homepage-consistent shimmer skeleton
  if (isInitialLoading) {
    return (
      <div className="space-y-8" role="status" aria-label={t.loadingLabel}>
        <div className="space-y-3">
          <Skeleton shape="line" className="w-28" />
          <Skeleton shape="line" className="h-8 w-72" />
          <Skeleton shape="line" className="w-96" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex justify-between">
                <Skeleton shape="line" className="w-20" />
                <Skeleton shape="circle" className="h-8 w-8" />
              </div>
              <Skeleton shape="line" className="mt-3 h-8 w-16" />
              <Skeleton shape="line" className="mt-2 w-28" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Skeleton shape="line" className="h-6 w-44" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State: Clear explanation with retry
  if (hasError) {
    return (
      <EmptyState
        icon={Building2}
        title={t.loadFailedTitle}
        description={t.loadFailedDescription}
        actionLabel={actions.retry}
        onAction={() => void handleRefresh()}
      />
    );
  }

  const managerDisplayName = user?.name || 'Manager';

  return (
    <div className="space-y-10">
      {/* SECTION A: Dashboard Header */}
      <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
              {roleNames.eventManager}
            </span>
            {slug && (
              <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
                {slug.toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-4xl">
            Welcome back, <span className="italic font-bold text-[var(--primary)]">{managerDisplayName}</span>
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[var(--ink-soft)] sm:text-sm">
            <span className="flex items-center gap-1.5 font-medium" suppressHydrationWarning>
              <Calendar aria-hidden="true" className="h-4 w-4 text-[var(--primary)] shrink-0" />
              {currentDateStr || 'Today'}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-[var(--line)]">·</span>
            <span>{t.subheading}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.refresh}
          </DashboardButton>
          <DashboardButton
            variant="primary"
            size="sm"
            onClick={openCreateEvent}
            leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}
          >
            {t.createEvent}
          </DashboardButton>
        </div>
      </header>

      {/* SECTION B: Overview Statistics (derived 100% from live verified data) */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Management Statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label={t.statManagedClubs}
            value={clubs.length}
            hint={t.statManagedClubsHint}
            icon={Building2}
            tone="brand"
          />
          <StatCard
            label={t.statMembers}
            value={totalMembers > 0 ? totalMembers : '—'}
            hint={t.statMembersHint}
            icon={Users}
            tone="accent"
          />
          <StatCard
            label={t.statEvents}
            value={allEvents.length}
            hint={t.statEventsHint}
            icon={Calendar}
            tone="neutral"
          />
          <StatCard
            label={t.statUpcomingEvents}
            value={upcomingEvents.length}
            hint={t.statUpcomingEventsHint}
            icon={Clock}
            tone="success"
          />
          <StatCard
            label={t.statCompletedEvents}
            value={completedEvents.length}
            hint={t.statCompletedEventsHint}
            icon={CheckCircle2}
            tone="neutral"
          />
        </div>
      </section>

      {/* Contextual Action Bar: Non-redundant shortcut */}
      {clubs.length === 1 ? (
        <section aria-label="Club Quick Actions">
          <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary-soft)]/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)] shrink-0"
              >
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                  Primary Club · {clubs[0].name}
                </p>
                <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                  Publish an event or preview the live campus directory for this college.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/college/${slug}/manager/clubs/${clubs[0].id}/events/create`}>
                <DashboardButton variant="primary" size="sm" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                  {t.createEventForClub}
                </DashboardButton>
              </Link>
              <Link href={`/college/${slug}/events`} target="_blank" rel="noopener noreferrer">
                <DashboardButton variant="secondary" size="sm" leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
                  {t.browsePublicFeed}
                </DashboardButton>
              </Link>
            </div>
          </div>
        </section>
      ) : clubs.length > 1 ? (
        <section aria-label="Campus Directory Preview">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-[var(--ink-soft)]">
              <Compass aria-hidden="true" className="h-4 w-4 text-[var(--primary)] shrink-0" />
              <span>{t.browsePublicFeedHint}</span>
            </div>
            <Link href={`/college/${slug}/events`} target="_blank" rel="noopener noreferrer">
              <DashboardButton variant="secondary" size="sm" leftIcon={<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />}>
                {t.browsePublicFeed}
              </DashboardButton>
            </Link>
          </div>
        </section>
      ) : null}

      {/* SECTION C: My Managed Clubs */}
      <section aria-labelledby="managed-clubs-heading" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="managed-clubs-heading" className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
              {t.managedClubs}
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">{t.managedClubsHint}</p>
          </div>
          {displayClubs.length > 0 && (
            <Link
              href={`/college/${slug}/manager/clubs`}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-[var(--primary)] transition-colors hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <span>{t.viewAllClubs}</span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {displayClubs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t.noClubsTitle}
            description={t.noClubsDescription}
            actionLabel={t.createEvent}
            onAction={openCreateEvent}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {displayClubs.map((club) => {
              const clubEventCount = allEvents.filter((e) => e.clubId === club.id).length;
              return (
                <article
                  key={club.id}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {club.logo?.url ? (
                          <img
                            src={club.logo.url}
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
                          <p className="truncate text-xs font-semibold text-[var(--primary)]">
                            {roleNames.eventManager}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)] min-h-[2.5rem]">
                      {club.description || t.noDescription}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-soft)]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Users aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                        <span>
                          {club.members?.length || club.memberCount || 0}{' '}
                          {(club.members?.length || club.memberCount) === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-[var(--secondary)] shrink-0" />
                        <span>{clubEventCount} events</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
                    <Link
                      href={`/college/${slug}/manager/clubs/${club.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      <span>{t.manageClub}</span>
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/college/${slug}/manager/clubs/${club.id}/events/create`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{t.createEventForClub}</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION D: Events Management with Filter Tabs */}
      <section aria-labelledby="events-heading" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="events-heading" className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
              {t.eventsTitle}
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">{t.eventsHint}</p>
          </div>

          {allEvents.length > 0 && (
            <div
              role="tablist"
              aria-label="Filter events by status"
              className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xs"
            >
              {[
                { key: 'ALL' as const, label: t.filterAll, count: allEvents.length },
                { key: 'UPCOMING' as const, label: t.filterUpcoming, count: upcomingEvents.length },
                { key: 'COMPLETED' as const, label: t.filterCompleted, count: completedEvents.length },
                { key: 'CANCELLED' as const, label: t.filterCancelled, count: cancelledEvents.length },
              ].map((tab) => {
                const isActive = eventFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setEventFilter(tab.key)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none ${
                      isActive
                        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? 'bg-[var(--surface)] text-[var(--ink)]'
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

        {allEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t.noEventsTitle}
            description={t.noEventsDescription}
            actionLabel={t.createEvent}
            onAction={openCreateEvent}
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t.noFilteredEventsTitle}
            description={t.noFilteredEventsDescription}
            actionLabel={t.filterAll}
            onAction={() => setEventFilter('ALL')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((evt) => (
              <article
                key={evt.id}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)]"
              >
                <div>
                  {/* Poster Well / Cover Image */}
                  <div className="relative h-40 w-full overflow-hidden bg-[var(--bg)]">
                    {evt.coverImage?.url ? (
                      <img
                        src={evt.coverImage.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary-soft)]/50 to-[var(--bg)] p-4">
                        <Calendar aria-hidden="true" className="h-10 w-10 text-[var(--ink-soft)]/30" />
                      </div>
                    )}
                    {/* Floating header badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      {evt.clubName && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
                          <Building2 aria-hidden="true" className="h-3 w-3" />
                          <span className="truncate max-w-[140px]">{evt.clubName}</span>
                        </span>
                      )}
                      <div className="ml-auto pointer-events-auto">
                        {renderStatusChip(evt)}
                      </div>
                    </div>
                  </div>

                  {/* Event Content Details */}
                  <div className="p-5">
                    <h3 className="font-display text-base font-bold tracking-tight text-[var(--ink)] line-clamp-1">
                      {evt.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)] min-h-[2rem]">
                      {evt.description || t.noDescription}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-[var(--ink-soft)]">
                      <div className="flex items-center gap-1.5">
                        <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                        <span className="truncate font-medium">{formatEventDate(evt.startAt)}</span>
                      </div>
                      {formatEventTime(evt.startAt) && (
                        <div className="flex items-center gap-1.5">
                          <Clock aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                          <span className="truncate">{formatEventTime(evt.startAt)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-[var(--secondary)] shrink-0" />
                        <span className="truncate">{evt.location || 'Location TBA'}</span>
                      </div>
                    </div>

                    {/* Capacity & Registered Seat Indicator */}
                    {typeof evt.capacity === 'number' && evt.capacity > 0 && (
                      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 p-2.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5">
                          <span className="uppercase tracking-wider">Capacity</span>
                          <span>
                            {typeof (evt as { registeredCount?: number }).registeredCount === 'number'
                              ? `${(evt as { registeredCount?: number }).registeredCount} / ${evt.capacity} registered`
                              : `${evt.capacity} seats limit`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                (((evt as { registeredCount?: number }).registeredCount || 0) / evt.capacity) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Links */}
                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] p-4 pt-3">
                  <Link
                    href={`/college/${slug}/manager/clubs/${evt.clubId}/events/${evt.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>{t.manageEvent}</span>
                  </Link>
                  <Link
                    href={`/college/${slug}/events/${evt.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>{t.publicEventPage}</span>
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
