'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/api/clubs';
import { useClubUpcomingEvents, useClubPastEvents } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import ClubHero from '@/components/college/ClubHero';
import CampusSectionHeader from '@/components/college/CampusSectionHeader';
import CampusChip from '@/components/college/CampusChip';
import EventCard from '@/components/common/EventCard';
import { resolveImageUrl } from '@/components/college/imageUrl';
import { campusPublic } from '@/lib/copy';
import type { Event } from '@/types/models';

export interface ClubDetailPageClientProps {
  slug: string;
  clubId: string;
}

const t = campusPublic.clubDetail;

type EventsTab = 'upcoming' | 'past';

function SegmentedControl({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: EventsTab; label: string }>;
  value: EventsTab;
  onChange: (tab: EventsTab) => void;
}) {
  return (
    <div role="tablist" aria-label={t.scheduleTitle} className="inline-flex rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-colors ${
            value === tab.id ? 'bg-[var(--accent-strong)] text-[var(--on-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ClubDetailPageClient({ slug, clubId }: ClubDetailPageClientProps) {
  // Scoped queries (unchanged)
  const { data: club, isLoading: clubLoading, isError: clubError, error: clubErr, refetch: refetchClub } = useClub(slug, clubId);
  const { data: upcomingEvents = [], isLoading: upcomingLoading, isError: upcomingError, refetch: refetchUpcoming } = useClubUpcomingEvents(slug, clubId);
  const { data: pastEvents = [], isLoading: pastLoading, isError: pastError, refetch: refetchPast } = useClubPastEvents(slug, clubId);

  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);
  const [tab, setTab] = useState<EventsTab>('upcoming');

  const collegeDisplay = slug.toUpperCase();
  const coverUrl = club ? resolveImageUrl(club.coverImageUrl, club.coverImage?.url, club.coverUrl, club.bannerUrl) : null;
  const departments = Array.isArray(club?.departments) ? club.departments : [];
  const memberCount = club ? (club._count?.members ?? club.membersCount ?? club.memberCount) : undefined;

  const showUpcoming = upcomingEvents.length > 0;
  const showPast = pastEvents.length > 0;
  const activeTab: EventsTab = showUpcoming && showPast ? tab : showUpcoming ? 'upcoming' : 'past';

  const eventsHref = (eventId: string) => `/college/${slug}/events/${eventId}`;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {clubLoading ? (
        /* Loading state */
        <div className="space-y-10" role="status" aria-label={t.clubLoadingLabel}>
          <div className="h-72 animate-pulse rounded-none border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
          <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
              ))}
            </div>
          </div>
        </div>
      ) : clubError || !club ? (
        /* Error state */
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <div className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 shadow-brutal-sm">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t.clubNotFoundTitle}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              {clubErr instanceof Error && clubErr.message.includes('404') ? t.errClubLoad : campusPublic.common.errGeneric}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => refetchClub()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
              >
                {campusPublic.common.retry}
              </button>
              <Link
                href={`/college/${slug}/clubs`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
              >
                {t.backToClubs}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ClubHero club={club} slug={slug} backHref={`/college/${slug}/clubs`} backLabel={t.backLabel} coverUrl={coverUrl} upcomingCount={upcomingEvents.length} />

          {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
            /* Empty state: no upcoming and no past events — one compact plain row. */
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
              <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
                <p className="font-campus text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{campusPublic.events.emptyTitle}</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.noUpcomingDescription(club.name)}</p>
                <Link
                  href={`/college/${slug}/events`}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                >
                  {campusPublic.events.emptyAction}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                {/* Main — one events section with segmented control */}
                <section>
                  <CampusSectionHeader title={t.scheduleTitle} aside={showUpcoming && showPast ? <SegmentedControl tabs={[{ id: 'upcoming', label: `${campusPublic.events.tabUpcoming} (${upcomingEvents.length})` }, { id: 'past', label: `${campusPublic.events.tabPast} (${pastEvents.length})`}]} value={activeTab} onChange={setTab} /> : undefined} />
                  {activeTab === 'upcoming' ? (
                    upcomingLoading ? (
                      <div className="grid gap-6" role="status" aria-label={t.loadingEvents}>
                        {[1, 2].map((n) => (
                          <div key={n} className="h-28 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
                        ))}
                      </div>
                    ) : upcomingError ? (
                      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">{t.errEvents}</p>
                        <button
                          type="button"
                          onClick={() => refetchUpcoming()}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                        >
                          {campusPublic.common.retry}
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingEvents.map((evt) => (
                          <EventCard key={evt.id} event={evt} href={eventsHref(evt.id)} variant="card" />
                        ))}
                      </div>
                    )
                  ) : (
                    /* Past tab — archive cards with gallery below. */
                    pastLoading ? (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t.loadingPast}>
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
                        ))}
                      </div>
                    ) : pastError ? (
                      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">{t.errPast}</p>
                        <button
                          type="button"
                          onClick={() => refetchPast()}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                        >
                          {campusPublic.common.retry}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {pastEvents.map((evt) => {
                          const eventImage = resolveImageUrl(evt.coverImage?.url, evt.coverImageUrl, evt.coverUrl, evt.bannerUrl);
                          return (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={() => setActiveGalleryEvent(evt)}
                              className="group rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-5 text-left shadow-brutal-sm transition-all duration-200 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                            >
                              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-tile)]">
                                {eventImage && <img src={eventImage} alt={`Cover for ${evt.title}`} className="h-full w-full object-cover" />}
                                <span className="absolute left-3 top-3">
                                  <CampusChip variant="accent">{t.completed}</CampusChip>
                                </span>
                              </div>
                              <h3 className="font-display mt-4 text-lg font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                                {evt.title}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{evt.description}</p>
                              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                                {t.viewGallery}
                                <span aria-hidden>→</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </section>

                {/* Aside — About (only with description) + department card */}
                <aside className="space-y-8">
                  {club.description && (
                    <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm">
                      <h3 className="font-campus text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.storyTitle}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{club.description}</p>
                    </div>
                  )}
                  {departments.length > 0 && (
                    <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm">
                      <h3 className="font-campus text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{t.departmentsTitle}</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {departments.map((dept) => (
                          <CampusChip key={dept.id || dept.shortCode || dept.code || dept.name} variant="outline">
                            {dept.shortCode || dept.code || dept.name}
                          </CampusChip>
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox photo gallery */}
      {activeGalleryEvent && <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />}
    </PublicLayout>
  );
}

export default ClubDetailPageClient;
