'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUpcomingEvents, useMyRegistrationStatus, useRegisterForEventMutation, useCancelRegistrationMutation } from '@/lib/api/events';
import { useAuth } from '@/context/AuthContext';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import CampusChip from '@/components/college/CampusChip';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { Event } from '@/types/models';
import { campusPublic } from '@/lib/copy';

export interface EventDetailPageClientProps {
  slug: string;
  eventId: string;
  clubId?: string;
}

const t = campusPublic.eventDetail;

const formatDateParts = (dateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const full = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return { day, month, full };
};

const formatEventTime = (startStr?: string, endStr?: string) => {
  if (!startStr) return null;
  const d = new Date(startStr);
  if (isNaN(d.getTime())) return null;
  let timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (endStr) {
    const end = new Date(endStr);
    if (!isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeStr = `${timeStr} - ${endTime}`;
    }
  }
  return timeStr;
};

const getValidUrl = (url?: string | null) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export function EventDetailPageClient({ slug, eventId, clubId: propClubId }: EventDetailPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Queries (unchanged)
  const { data: upcomingEvents = [], isLoading, isError, error, refetch } = useUpcomingEvents(slug);
  const { data: regStatus } = useMyRegistrationStatus(slug, eventId, Boolean(user));

  const registerMutation = useRegisterForEventMutation(slug);
  const cancelMutation = useCancelRegistrationMutation(slug);

  const [showModal, setShowModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState(false);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  const event = upcomingEvents.find((e) => e.id === eventId) || upcomingEvents[0];
  const club = event?.club;
  const clubId = propClubId || club?.id || event?.clubId;

  const collegeDisplay = slug.toUpperCase();

  const isRegistered = Boolean(regStatus?.isRegistered);

  const dateInfo = formatDateParts(event?.startAt || event?.startDate || event?.date);
  const eventTime = formatEventTime(
    event?.startAt || event?.startDate || event?.date,
    event?.endAt || event?.endDate
  );

  const rawRegistrationUrl =
    event?.registrationUrl || event?.url || event?.formUrl || event?.link || event?.externalUrl;
  const validRegistrationUrl = getValidUrl(rawRegistrationUrl);

  const isCapacityFull =
    event?.capacity !== null && event?.capacity !== undefined && (event.registeredCount || 0) >= event.capacity;

  const handleRegister = async () => {
    if (validRegistrationUrl) {
      window.open(validRegistrationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!user) {
      const returnPath = `/college/${slug}/events/${eventId}`;
      router.push(`/college/${slug}/login?returnUrl=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!event?.id) return;

    // Check if custom questions need to be answered
    const fields = event.customFormDefinition?.fields;
    if (fields && Array.isArray(fields) && fields.length > 0) {
      setShowFormModal(true);
      return;
    }

    try {
      setRegError(null);
      await registerMutation.mutateAsync({ eventId: event.id });
      setShowModal(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to register for event.');
      setRegError(msg);
    }
  };

  const handleCustomFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event?.id) return;

    const fields = event.customFormDefinition?.fields || [];
    for (const f of fields) {
      const key = f.id || f.name;
      if (!key) continue;
      const val = formAnswers[key];
      if (f.required && (val === undefined || val === null || val === '')) {
        setFormValidationError(`"${f.label || key}" is required.`);
        return;
      }
    }

    try {
      setFormValidationError(null);
      setRegError(null);
      await registerMutation.mutateAsync({ eventId: event.id, formAnswers });
      setShowFormModal(false);
      setShowModal(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to register for event.');
      setFormValidationError(msg);
    }
  };

  const handleCancelRegistration = async () => {
    if (!user || !event?.id) return;
    try {
      setRegError(null);
      await cancelMutation.mutateAsync(event.id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to cancel registration.');
      setRegError(msg);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event?.title || 'Campus Event',
          text: `Check out ${event?.title} organized by ${club?.name || 'campus clubs'} on 4 THE PEOPLE!`,
          url: window.location.href,
        });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error(err);
        }
      }
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareNotice(true);
        setTimeout(() => setShareNotice(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const infoTile = (label: string, value: React.ReactNode) => (
    <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-brutal-xs">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="font-display mt-1 text-xl font-bold uppercase text-[var(--text-primary)]">{value}</p>
    </div>
  );

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      {/* Error state */}
      {isError && (
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
          <div className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-10 text-center shadow-brutal-sm">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t.eventNotFoundTitle}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              {error instanceof Error ? error.message : t.errEventLoad}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
            >
              {campusPublic.common.retry}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8" role="status" aria-label={t.eventLoadingLabel}>
          <div className="h-40 w-2/3 animate-pulse rounded-2xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            ))}
          </div>
          <div className="h-14 w-56 animate-pulse rounded-xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
        </div>
      )}

      {/* Empty state: list loaded but nothing to show */}
      {!isLoading && !isError && !event && (
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
          <div className="space-y-4 rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
              {t.eventNotFoundTitle}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.errEventLoad}</p>
            <Link
              href={`/college/${slug}#events`}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {t.backToCampus}
            </Link>
          </div>
        </div>
      )}

      {/* Event main content */}
      {!isLoading && !isError && event && (
        <>
          {/* Hero (demo layout: back link, status chip, display title, info tiles) */}
          <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
            <div aria-hidden className="absolute -right-16 top-0 h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15" />
            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <Link
                href={`/college/${slug}`}
                className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] motion-reduce:transition-none"
              >
                <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
                {t.backLabel}
              </Link>

              <div className="mt-8 flex flex-wrap items-center gap-2">
                <CampusChip variant="accent" dot={(event.status || '').toUpperCase() === 'ONGOING'}>
                  {(event.status || 'UPCOMING').toUpperCase() === 'ONGOING' ? t.statusLive : (event.status || 'UPCOMING').toUpperCase()}
                </CampusChip>
                <CampusChip>{event.category || t.noCategory}</CampusChip>
                {club?.name && clubId && (
                  <Link
                    href={`/college/${slug}/clubs/${clubId}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                  >
                    <Building2 aria-hidden className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                    {club.name}
                  </Link>
                )}
              </div>

              <h1 className="font-campus mt-6 text-5xl uppercase leading-[0.9] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                {event.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium text-[var(--text-secondary)]">
                {t.presentedBy}{' '}
                {club?.name && clubId ? (
                  <Link href={`/college/${slug}/clubs/${clubId}`} className="font-bold text-[var(--accent-strong)] hover:underline">
                    {club.name}
                  </Link>
                ) : (
                  <span className="font-bold text-[var(--accent-strong)]">{club?.name || `${collegeDisplay} ${t.noHost}`}</span>
                )}
              </p>

              {/* Info tiles */}
              <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {infoTile(t.hostClub, club?.name || '—')}
                {infoTile(t.date, dateInfo.full)}
                {eventTime && infoTile(t.time, eventTime)}
                {infoTile(t.venue, event.venue || event.location || t.noVenue)}
                {typeof event.registeredCount === 'number' && infoTile(t.attending, t.attendingCount(event.registeredCount))}
              </div>

              <div className="mt-10">
                <a
                  href="#register"
                  className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-8 text-base font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-tile)]"
                >
                  {t.registerCta}
                </a>
              </div>
            </div>
          </section>

          {/* Registration band (real flow: internal RSVP, custom form, external URL, capacity) */}
          <section id="register" className="border-b-2 border-[var(--border-strong)] bg-[var(--surface-page)]">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              {regError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-3 text-xs font-semibold text-[var(--text-primary)]">
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
                  <span>{regError}</span>
                </div>
              )}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  {validRegistrationUrl ? (
                    <a
                      href={validRegistrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open official registration form"
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-6 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] sm:flex-none"
                    >
                      {t.externalCta}
                      <ExternalLink aria-hidden className="h-4 w-4 shrink-0" />
                    </a>
                  ) : isRegistered ? (
                    <>
                      <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--surface-inverse)] px-6 text-sm font-bold uppercase tracking-wider text-[var(--text-inverse)]">
                        <CheckCircle2 aria-hidden className="h-4 w-4" />
                        {t.rsvpConfirmed}
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelRegistration}
                        disabled={cancelMutation.isPending}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                      >
                        {cancelMutation.isPending ? t.cancelling : t.cancelRsvp}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={registerMutation.isPending || isCapacityFull}
                      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold transition-transform focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] motion-reduce:transition-none sm:flex-none ${
                        isCapacityFull
                          ? 'cursor-not-allowed border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[var(--text-muted)]'
                          : 'bg-[var(--accent-strong)] text-[var(--on-primary)] hover:-translate-y-0.5'
                      }`}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <RefreshCw aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                          {t.registering}
                        </>
                      ) : isCapacityFull ? (
                        <>
                          <AlertCircle aria-hidden className="h-4 w-4" />
                          {t.capacityFull}
                        </>
                      ) : (
                        <>
                          {t.registerCta}
                          <ArrowRight aria-hidden className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleShare}
                    title={t.share}
                    aria-label={t.share}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                  >
                    <Share2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xs font-semibold text-[var(--text-secondary)]">
                  {validRegistrationUrl ? (
                    <span className="flex items-center gap-1.5">
                      <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      {t.externalNote}
                    </span>
                  ) : (
                    <span>
                      {event.capacity !== null && event.capacity !== undefined
                        ? t.capacityNote(event.registeredCount ?? 0, event.capacity)
                        : t.noCapacityNote(event.registeredCount ?? 0)}
                      {isCapacityFull ? ` · ${t.capacityFull}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {shareNotice && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)]" role="status">
                  <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                  {t.shareCopied}
                </p>
              )}
            </div>
          </section>

          {/* Description + organizer */}
          <div className="mx-auto max-w-7xl grid grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="space-y-4 lg:col-span-8">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                {t.descriptionTitle}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                {event.description || t.noDescription}
              </p>
            </div>

            <aside className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm lg:col-span-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{t.organizerEyebrow}</p>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                {club?.name || `${collegeDisplay} ${t.noHost}`}
              </h3>
              <p className="line-clamp-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                {club?.description || t.organizerNoDescription}
              </p>
              {clubId && (
                <Link
                  href={`/college/${slug}/clubs/${clubId}`}
                  className="mt-2 block min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                >
                  {t.viewClubProfile}
                  <span aria-hidden> →</span>
                </Link>
              )}
            </aside>
          </div>

          {/* Event photo gallery */}
          {event.gallery && event.gallery.length > 0 && (
            <section className="border-t-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-page)]">
              <div className="mx-auto max-w-7xl space-y-4 px-4 py-14 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                    {t.galleryTitle}
                  </h2>
                  <CampusChip>{t.galleryCount(event.gallery.length)}</CampusChip>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {event.gallery.map((photo, idx) => (
                    <button
                      key={photo.publicId || idx}
                      type="button"
                      onClick={() => setActiveGalleryEvent(event)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs transition-all duration-200 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                      aria-label={`${t.galleryTitle} ${idx + 1}`}
                    >
                      <img
                        src={photo.url}
                        alt={`Event gallery ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Custom questions registration modal */}
      {showFormModal && event?.customFormDefinition?.fields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={event.title}
            className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-lg sm:p-8"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{t.formEyebrow}</p>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">{event.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t.formDescription}</p>
            </div>

            {formValidationError && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] p-3 text-xs font-semibold text-[var(--text-primary)]">
                <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleCustomFormSubmit} className="space-y-4">
              {event.customFormDefinition.fields.map((field, idx) => {
                const fieldKey: string = field.id || field.name || `field_${idx}`;
                const value = formAnswers[fieldKey] !== undefined ? String(formAnswers[fieldKey]) : '';

                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <label htmlFor={`form-${fieldKey}`} className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {field.label || fieldKey} {field.required && <span className="text-[var(--accent-strong)]">*</span>}
                    </label>

                    {field.type === 'SELECT' ? (
                      <select
                        id={`form-${fieldKey}`}
                        value={value}
                        onChange={(e) =>
                          setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                        }
                        className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
                        required={field.required}
                      >
                        <option value="">{t.selectOption}</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'RADIO' ? (
                      <div className="space-y-1.5 pt-1">
                        {field.options?.map((opt) => (
                          <label key={opt} className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-primary)]">
                            <input
                              type="radio"
                              name={fieldKey}
                              value={opt}
                              checked={value === opt}
                              onChange={(e) =>
                                setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                              }
                              required={field.required}
                              className="accent-[var(--accent-strong)]"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        id={`form-${fieldKey}`}
                        type={field.type === 'NUMBER' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) =>
                          setFormAnswers((prev) => ({
                            ...prev,
                            [fieldKey]: field.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                          }))
                        }
                        placeholder={`Enter ${field.label || fieldKey}...`}
                        className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
                        required={field.required}
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-end gap-3 border-t-2 border-dashed border-[var(--border-soft)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  disabled={registerMutation.isPending}
                  className="min-h-11 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                >
                  {t.formCancel}
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-xs font-bold uppercase tracking-wider text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                >
                  {registerMutation.isPending ? (
                    <>
                      <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                      {t.formSubmitting}
                    </>
                  ) : (
                    <>
                      {t.formSubmit}
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.rsvpConfirmedTitle}
            className="w-full max-w-md space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-8 text-center shadow-brutal-lg"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
              <CheckCircle2 aria-hidden className="h-9 w-9 text-[var(--accent-strong)]" />
            </div>
            <h3 className="font-campus text-3xl uppercase tracking-wide text-[var(--text-primary)]">{t.rsvpConfirmedTitle}</h3>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {t.rsvpConfirmedBody(event?.title || '')}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="min-h-11 w-full rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {t.done}
            </button>
          </div>
        </div>
      )}

      {/* Gallery lightbox */}
      {activeGalleryEvent && <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />}
    </PublicLayout>
  );
}

export default EventDetailPageClient;
