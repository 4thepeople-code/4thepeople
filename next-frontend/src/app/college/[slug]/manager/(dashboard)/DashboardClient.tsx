'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Calendar, Users, ArrowRight } from 'lucide-react';
import { useMyClubsQuery, fetchClubDashboard, fetchManagedClubEvents } from '@/lib/api/manager';
import type { Club, Event } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { actions, eventManager } from '@/lib/copy';
import { useOpenCreateEvent } from './ManagerDashboardFrame';

export interface ManagerDashboardClientProps {
  slug: string;
}

interface ManagedClubEvent extends Event {
  clubName?: string;
  clubId?: string;
}

/**
 * Event Manager overview: managed clubs, aggregated member counts and the
 * events published across them. Same data sources as the old dashboard
 * (useMyClubsQuery + fetchClubDashboard + fetchManagedClubEvents); presentation
 * moved to the new UI system.
 */
export default function ManagerDashboardClient({ slug }: ManagerDashboardClientProps) {
  const t = eventManager.dashboard;
  const openCreateEvent = useOpenCreateEvent();

  const [detailedClubs, setDetailedClubs] = useState<Club[]>([]);
  const [allEvents, setAllEvents] = useState<ManagedClubEvent[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);

  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsIsError,
    refetch: refetchClubs,
  } = useMyClubsQuery(slug);

  const loading = clubsLoading || (clubs.length > 0 && detailedClubs.length === 0);
  const hasError = clubsIsError;

  useEffect(() => {
    let isSubscribed = true;
    if (clubs.length === 0) {
      setDetailedClubs([]);
      setAllEvents([]);
      setTotalMembers(0);
      return;
    }

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
      }),
    ).then((results) => {
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
    });

    return () => {
      isSubscribed = false;
    };
  }, [clubs]);

  const displayClubs = detailedClubs.length > 0 ? detailedClubs : clubs;

  const handleRefresh = () => {
    void refetchClubs();
  };

  const statusChip = (status?: string) => {
    switch (status) {
      case 'ONGOING':
        return <Chip variant="success"> {t.statusOngoing} </Chip>;
      case 'COMPLETED':
        return <Chip variant="neutral"> {t.statusCompleted} </Chip>;
      case 'CANCELLED':
        return <Chip variant="danger"> {t.statusCancelled} </Chip>;
      default:
        return <Chip variant="brand"> {t.statusUpcoming} </Chip>;
    }
  };

  if (loading) {
    return (
      <div role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={4} />
      </div>
    );
  }

  if (hasError) {
    return (
      <EmptyState
        title={t.loadFailedTitle}
        description={t.loadFailedDescription}
        actionLabel={actions.retry}
        onAction={() => void handleRefresh()}
      />
    );
  }

  return (
    <div>
      <PageHeader
        role="eventManager"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton variant="secondary" size="sm" onClick={() => void handleRefresh()}>
            {t.refresh}
          </DashboardButton>
        }
      />

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t.statManagedClubs} value={clubs.length} hint={t.statManagedClubsHint} icon={Building2} loading={loading} tone="brand" />
        <StatCard label={t.statMembers} value={totalMembers > 0 ? totalMembers : '—'} hint={t.statMembersHint} icon={Users} loading={loading} tone="accent" />
        <StatCard label={t.statEvents} value={allEvents.length} hint={t.statEventsHint} icon={Calendar} loading={loading} tone="neutral" />
      </div>

      {/* Managed clubs */}
      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.managedClubs}</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.managedClubsHint}</p>
          </div>
          <DashboardButton variant="ghost" size="sm" href={`/college/${slug}/manager/clubs`}>
            {t.viewAllClubs}
          </DashboardButton>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayClubs.map((club) => (
              <Link
                key={club.id}
                href={`/college/${slug}/manager/clubs/${club.id}`}
                className="group rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="flex items-center gap-3">
                  {club.logo?.url ? (
                    <img src={club.logo.url} alt="" className="h-11 w-11 rounded-xl border border-[var(--line)] object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] font-display text-sm font-bold text-[var(--primary)]">
                      {club.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold text-[var(--ink)]">{club.name}</h3>
                    <p className="text-xs text-[var(--ink-soft)]">{club.description || eventManager.dashboard.noDescription}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
                    {club.members?.length || club.memberCount || 0} {club.members?.length === 1 ? 'member' : 'members'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-extrabold text-[var(--primary)] uppercase tracking-wider">
                    {t.viewAllClubs}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Published events */}
      <div className="mt-8">
        <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.eventsTitle}</h2>
        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.eventsHint}</p>

        {allEvents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Calendar}
              title={t.noEventsTitle}
              description={t.noEventsDescription}
              actionLabel={t.createEvent}
              onAction={openCreateEvent}
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allEvents.map((evt) => (
              <Link
                key={evt.id}
                href={`/college/${slug}/manager/clubs/${evt.clubId}/events/${evt.id}`}
                className="group rounded-3xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="relative h-36 bg-[var(--bg)]">
                  {evt.coverImage?.url ? (
                    <img src={evt.coverImage.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4">
                      <Calendar aria-hidden="true" className="h-8 w-8 text-[var(--ink-soft)]" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">{statusChip(evt.status)}</div>
                </div>
                <div className="p-5">
                  <h3 className="truncate font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
                    {evt.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">{evt.description}</p>
                  <p className="mt-3 text-xs font-semibold text-[var(--ink-soft)]">
                    {evt.startAt ? new Date(evt.startAt).toLocaleDateString() : 'TBA'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
