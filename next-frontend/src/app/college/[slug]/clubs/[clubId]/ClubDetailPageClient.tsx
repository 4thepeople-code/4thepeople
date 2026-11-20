'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub } from '@/lib/api/clubs';
import { useClubUpcomingEvents, useClubPastEvents } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import CollegeEventCard from '@/components/college/CollegeEventCard';
import EventModal from '@/components/public/EventModal';
import { getClubCoverImage } from '@/lib/utils/clubCovers';
import {
  ArrowLeft,
  Calendar,
  Share2,
  Check,
  Building2,
  Globe,
  Mail,
  Link2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { Event } from '@/types/models';

export interface ClubDetailPageClientProps {
  slug: string;
  clubId: string;
}

export function ClubDetailPageClient({ slug, clubId }: ClubDetailPageClientProps) {
  const router = useRouter();

  // Scoped queries
  const { data: club, isLoading: clubLoading, isError: clubError, error: clubErr, refetch: refetchClub } = useClub(slug, clubId);
  const { data: upcomingEvents = [], isLoading: upcomingLoading, isError: upcomingError, refetch: refetchUpcoming } = useClubUpcomingEvents(slug, clubId);
  const { data: pastEvents = [], isLoading: pastLoading, isError: pastError, refetch: refetchPast } = useClubPastEvents(slug, clubId);

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copied, setCopied] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);

  const collegeDisplay = slug.toUpperCase();
  const coverUrl = club ? getClubCoverImage(club) : null;

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: club?.name || 'Campus Club',
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignored
    }
  };

  const memberCount = club
    ? (club as any)._count?.members ??
      (club as any).membersCount ??
      (club as any).memberCount ??
      (club.members ? club.members.length : undefined)
    : undefined;

  const departments = Array.isArray(club?.departments) ? club.departments : [];
  const clubAny = club as any;

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-140px)]">
        {/* Loading Skeleton */}
        {clubLoading && (
          <div className="space-y-10" role="status" aria-label="Loading club details">
            <div className="h-72 animate-pulse border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
              <div className="h-10 w-2/3 animate-pulse rounded-xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Not Found / Error State */}
        {!clubLoading && (clubError || !club) && (
          <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
            <div className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 shadow-brutal-sm">
              <AlertCircle className="mx-auto h-12 w-12 text-[var(--accent-strong)]" />
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                Club Not Found
              </h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                {clubErr instanceof Error ? clubErr.message : 'The requested campus organization could not be loaded.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => refetchClub()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </button>
                <Link
                  href={`/college/${slug}/clubs`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
                >
                  Back to all clubs
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Club Details Header & Content */}
        {!clubLoading && club && (
          <>
            {/* Hero Profile Banner */}
            <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
              />
              <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
                <Link
                  href={`/college/${slug}/clubs`}
                  className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <span aria-hidden="true" className="mr-1.5">&larr;</span>
                  All clubs
                </Link>

                <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-start">
                  <div className="lg:col-span-6 xl:col-span-6">
                    {club.category && (
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                        {club.category}
                      </p>
                    )}
                    <h1 className="font-campus mt-3 text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                      {club.name}
                    </h1>

                    {typeof memberCount === 'number' && (
                      <p className="mt-3 text-sm font-bold text-[var(--text-secondary)]">
                        {memberCount} active campus members
                      </p>
                    )}

                    {/* Mobile Cover Card */}
                    {coverUrl && (
                      <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-sm lg:hidden">
                        <img
                          src={coverUrl}
                          alt={`${club.name} cover`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    {/* About The Club Box (Decreased width for compact readability) */}
                    <div className="mt-6 max-w-xl rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 sm:p-7 shadow-brutal-xs space-y-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                          About the club
                        </p>
                        <h2 className="font-display mt-1 text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                          The story behind {club.name}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line sm:text-base">
                          {club.description ||
                            'This club brings students together around shared interests, hands-on learning, and campus leadership.'}
                        </p>
                      </div>

                      {/* Academic Affiliation */}
                      {departments.length > 0 && (
                        <div className="border-t border-[var(--border-soft)] pt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">
                            Academic Affiliation
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {departments.map((dept: any) => (
                              <Link
                                key={dept.id || dept.code || dept.name}
                                href={`/college/${slug}/departments/${dept.id || dept.code}`}
                                className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)] shadow-brutal-xs"
                              >
                                <Building2 className="h-3 w-3 text-[var(--accent-strong)]" />
                                <span>{dept.name || dept.shortCode || dept.code}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Social & Contact Links */}
                      {(clubAny?.email || clubAny?.website || clubAny?.instagram || clubAny?.linkedin || clubAny?.twitter || clubAny?.github) && (
                        <div className="border-t border-[var(--border-soft)] pt-4 space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                            Connect &amp; Inquire
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {clubAny?.email && (
                              <a
                                href={`mailto:${clubAny.email}`}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Mail className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>Email</span>
                              </a>
                            )}
                            {clubAny?.website && (
                              <a
                                href={clubAny.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Globe className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>Website</span>
                              </a>
                            )}
                            {clubAny?.instagram && (
                              <a
                                href={clubAny.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>Instagram</span>
                              </a>
                            )}
                            {clubAny?.twitter && (
                              <a
                                href={clubAny.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>Twitter</span>
                              </a>
                            )}
                            {clubAny?.linkedin && (
                              <a
                                href={clubAny.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>LinkedIn</span>
                              </a>
                            )}
                            {clubAny?.github && (
                              <a
                                href={clubAny.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)]"
                              >
                                <Link2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                                <span>GitHub</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Explore campus events & Share buttons */}
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      {upcomingEvents.length > 0 ? (
                        <a
                          href="#club-events"
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-7 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-sm"
                        >
                          See upcoming events ({upcomingEvents.length})
                        </a>
                      ) : (
                        <Link
                          href={`/college/${slug}/events`}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-7 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-sm"
                        >
                          Explore campus events
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                        <span>{copied ? 'Link Copied!' : 'Share Club'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Side Cover Card (Slightly increased size) */}
                  <div className="hidden lg:block lg:col-span-6 xl:col-span-6 sticky top-6">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-md">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={`${club.name} cover`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <span className="font-display text-8xl font-bold text-[var(--text-muted)]">
                            {club.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Main Content Area: Events */}
            <div id="club-events" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20 space-y-16">
              <section className="space-y-8">
                <div className="flex flex-col justify-between gap-4 border-b-2 border-[var(--border-soft)] pb-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                      Live schedule
                    </p>
                    <h2 className="font-display mt-2 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-4xl">
                      Club events
                    </h2>
                  </div>

                  {/* Upcoming vs Past Tabs */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upcoming')}
                      className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border-2 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'upcoming'
                          ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)] border-[var(--border-strong)]'
                          : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                      }`}
                    >
                      Upcoming ({upcomingEvents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('past')}
                      className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border-2 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'past'
                          ? 'bg-[var(--surface-inverse)] text-[var(--text-inverse)] border-[var(--border-strong)]'
                          : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-tile)]'
                      }`}
                    >
                      Past ({pastEvents.length})
                    </button>
                  </div>
                </div>

                {/* Upcoming Tab Content */}
                {activeTab === 'upcoming' && (
                  <>
                    {upcomingLoading ? (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-72 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                          />
                        ))}
                      </div>
                    ) : upcomingEvents.length === 0 ? (
                      <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
                        <Calendar className="mx-auto h-10 w-10 text-[var(--accent-strong)]" />
                        <p className="font-display mt-3 text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                          No upcoming events scheduled
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                          {club.name} has not scheduled any events right now. Explore the full campus calendar for other activities.
                        </p>
                        <Link
                          href={`/college/${slug}#upcoming-events`}
                          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                        >
                          Explore campus events
                        </Link>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingEvents.map((ev) => (
                          <CollegeEventCard
                            key={ev.id}
                            event={ev}
                            href={`/college/${slug}/events/${ev.id}`}
                            onOpenModal={(e) => setSelectedEvent(e)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Past Tab Content */}
                {activeTab === 'past' && (
                  <>
                    {pastLoading ? (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-72 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                          />
                        ))}
                      </div>
                    ) : pastEvents.length === 0 ? (
                      <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
                        <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                          No past events recorded
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                          Past workshops and completed activities hosted by {club.name} will be archived here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {pastEvents.map((ev) => (
                          <CollegeEventCard
                            key={ev.id}
                            event={ev}
                            href={`/college/${slug}/events/${ev.id}`}
                            onOpenModal={(e) => setSelectedEvent(e)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {/* Event Modal for quick view */}
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

        {/* Gallery Lightbox */}
        {activeGalleryEvent && (
          <GalleryLightbox
            event={activeGalleryEvent}
            onClose={() => setActiveGalleryEvent(null)}
          />
        )}
      </div>
    </PublicLayout>
  );
}

export default ClubDetailPageClient;
