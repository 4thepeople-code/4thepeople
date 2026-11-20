'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useUpcomingEvents,
  usePublicEventById,
  useMyRegistrationStatus,
  useRegisterForEventMutation,
  useCancelRegistrationMutation,
  useExternalRegistrationStatus,
  useCancelExternalMutation,
} from '@/lib/api/events';
import { getStoredExternalToken, clearStoredExternalToken } from '@/lib/auth/tokenStorage';
import { ExternalGuestRegistrationDialog } from '@/components/public/ExternalGuestRegistrationDialog';
import { useAuth } from '@/context/AuthContext';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import { getEventCoverImage } from '@/lib/utils/eventCovers';
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
  Check,
  CreditCard,
  Globe,
  Users,
} from 'lucide-react';
import { launchPaymentCheckout } from '@/lib/payment/paymentSdk';
import {
  useStudentCheckoutMutation,
  useStudentVerifyPaymentMutation,
} from '@/lib/api/payment';
import type { Event } from '@/types/models';

export interface EventDetailPageClientProps {
  slug: string;
  eventId: string;
  clubId?: string;
}

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

  // Queries
  const { data: upcomingEvents = [], isLoading, isError, error, refetch } = useUpcomingEvents(slug);
  const { data: directEvent } = usePublicEventById(eventId, !upcomingEvents.some((e) => e.id === eventId));

  const registerMutation = useRegisterForEventMutation(slug);
  const cancelMutation = useCancelRegistrationMutation(slug);
  const cancelExternalMutation = useCancelExternalMutation(slug);
  const studentCheckoutMutation = useStudentCheckoutMutation();
  const studentVerifyPaymentMutation = useStudentVerifyPaymentMutation(slug);

  const [showModal, setShowModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showExternalDialog, setShowExternalDialog] = useState(false);
  const [showCrossCollegeModal, setShowCrossCollegeModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState(false);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // External token tracking
  const [externalToken, setExternalToken] = useState<string | null>(null);
  useEffect(() => {
    setExternalToken(getStoredExternalToken());
  }, []);

  const event = upcomingEvents.find((e) => e.id === eventId) || directEvent || upcomingEvents[0];
  const club = event?.club;
  const clubId = propClubId || club?.id || event?.clubId;

  const collegeDisplay = slug.toUpperCase();

  const { data: regStatus } = useMyRegistrationStatus(slug, eventId, Boolean(user));
  const { data: externalRegStatus } = useExternalRegistrationStatus(eventId, !user && Boolean(externalToken));

  const hostCollegeId = event?.collegeId || event?.college?.id || (event?.club as unknown as { collegeId?: string })?.collegeId;
  const isCrossCollege = Boolean(user && user.collegeId && hostCollegeId && user.collegeId !== hostCollegeId);
  const isRegistered = Boolean(regStatus?.isRegistered || externalRegStatus?.isRegistered);

  const dateInfo = formatDateParts(event?.startAt || event?.startDate || event?.date);
  const eventTime = formatEventTime(
    event?.startAt || event?.startDate || event?.date,
    event?.endAt || event?.endDate
  );

  const rawRegistrationUrl =
    event?.registrationUrl || event?.url || event?.formUrl || event?.link || event?.externalUrl;
  const validRegistrationUrl = getValidUrl(rawRegistrationUrl);
  const coverUrl = event ? getEventCoverImage(event) : null;

  const isCapacityFull =
    event?.capacity !== null &&
    event?.capacity !== undefined &&
    (event?.registeredCount || 0) >= event.capacity;

  const executePaidCheckout = async (submittedAnswers?: Record<string, unknown>) => {
    if (!event?.id || !user) return;
    try {
      setIsCheckingOut(true);
      setRegError(null);

      const session = await studentCheckoutMutation.mutateAsync({
        eventId: event.id,
        formAnswers: submittedAnswers,
        returnUrl: window.location.href,
      });

      await launchPaymentCheckout({
        session,
        participant: {
          name: user.name || 'Student Participant',
          email: user.email,
          phone: (user as unknown as { phone?: string })?.phone || undefined,
        },
        onSuccess: async (verifyPayload) => {
          const verifyRes = await studentVerifyPaymentMutation.mutateAsync({
            eventId: event.id,
            payload: verifyPayload,
          });

          if (verifyRes.success && verifyRes.registration) {
            setShowModal(true);
          } else {
            router.push(
              `/college/${slug}/events/${event.id}/payment/status?transactionId=${session.transactionId}`
            );
          }
        },
        onFailure: (err) => {
          setRegError(err.message);
        },
        onDismiss: () => {
          setRegError('Checkout cancelled. You may complete your registration within 15 minutes before the seat reservation expires.');
        },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to initiate payment checkout.');
      setRegError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleRegister = async () => {
    if (validRegistrationUrl) {
      window.open(validRegistrationUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // 1. Unauthenticated visitor
    if (!user) {
      if (event?.visibility === 'PUBLIC' || !event?.visibility) {
        setShowExternalDialog(true);
        return;
      }
      const returnPath = `/college/${slug}/events/${eventId}`;
      router.push(`/college/${slug}/login?returnUrl=${encodeURIComponent(returnPath)}`);
      return;
    }

    if (!event?.id) return;

    // 2. Cross-college student
    if (isCrossCollege) {
      if (event.visibility !== 'PUBLIC') {
        setRegError('Cross-college registration is only available for public events.');
        return;
      }
      setShowCrossCollegeModal(true);
      return;
    }

    // 3. Same-college student flow
    const fields = event.customFormDefinition?.fields;
    if (fields && Array.isArray(fields) && fields.length > 0) {
      setShowFormModal(true);
      return;
    }

    // If event is paid, initiate checkout
    if (event.isPaid) {
      await executePaidCheckout();
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

  const handleConfirmCrossCollege = async () => {
    setShowCrossCollegeModal(false);
    if (!event?.id) return;

    const fields = event.customFormDefinition?.fields;
    if (fields && Array.isArray(fields) && fields.length > 0) {
      setShowFormModal(true);
      return;
    }

    if (event.isPaid) {
      await executePaidCheckout();
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

    if (event.isPaid) {
      setShowFormModal(false);
      await executePaidCheckout(formAnswers);
      return;
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
    if (!event?.id) return;
    try {
      setRegError(null);
      if (user) {
        await cancelMutation.mutateAsync(event.id);
      } else if (externalRegStatus?.isRegistered) {
        await cancelExternalMutation.mutateAsync({ eventId: event.id });
        clearStoredExternalToken();
        setExternalToken(null);
      }
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
    } catch {
      // Ignored
    }
  };

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-140px)]">
        {/* Loading State */}
        {isLoading && (
          <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8" role="status" aria-label="Loading event">
            <div className="h-40 w-2/3 animate-pulse rounded-2xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                />
              ))}
            </div>
            <div className="h-14 w-56 animate-pulse rounded-xl bg-[var(--surface-tile)] motion-reduce:animate-none" />
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && (isError && !event || !event) && (
          <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 text-center">
            <div className="space-y-4 rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10">
              <AlertCircle className="mx-auto h-12 w-12 text-[var(--accent-strong)]" />
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                Event Not Found
              </h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                {error instanceof Error ? error.message : 'The event you are looking for is no longer active or does not exist.'}
              </p>
              <Link
                href={`/college/${slug}#upcoming-events`}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
              >
                Back to campus events
              </Link>
            </div>
          </div>
        )}

        {/* Main Event Content */}
        {!isLoading && event && (
          <>
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
              />
              <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
                <Link
                  href={`/college/${slug}`}
                  className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to campus schedule
                </Link>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border-2 border-[var(--border-strong)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-brutal-xs ${
                      event.status === 'ONGOING'
                        ? 'bg-[var(--accent-strong)] text-white'
                        : 'bg-[var(--surface-card)] text-[var(--text-primary)]'
                    }`}
                  >
                    {event.status === 'ONGOING' ? 'LIVE NOW' : event.status || 'UPCOMING'}
                  </span>

                  {event.category && (
                    <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                      {event.category}
                    </span>
                  )}

                  {club?.name && clubId && (
                    <Link
                      href={`/college/${slug}/clubs/${clubId}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-page)] shadow-brutal-xs"
                    >
                      <Building2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                      <span>{club.name}</span>
                    </Link>
                  )}
                </div>

                <h1 className="font-campus mt-6 text-5xl uppercase leading-[0.9] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                  {event.title}
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-medium text-[var(--text-secondary)]">
                  Presented by{' '}
                  {club?.name && clubId ? (
                    <Link href={`/college/${slug}/clubs/${clubId}`} className="font-bold text-[var(--accent-strong)] hover:underline">
                      {club.name}
                    </Link>
                  ) : (
                    <span className="font-bold text-[var(--accent-strong)]">{club?.name || collegeDisplay}</span>
                  )}
                </p>

                {/* Event Image and About this Event (Between Event Title and Event Boxes) */}
                <div className="mt-8 space-y-6">
                  {coverUrl && (
                    <div className="overflow-hidden rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] shadow-brutal-md">
                      <img
                        src={coverUrl}
                        alt={event.title}
                        className="aspect-[16/9] sm:aspect-[21/9] max-h-[460px] w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                    <div className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 sm:p-8 shadow-brutal-xs lg:col-span-8">
                      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                        About this event
                      </h2>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                        {event.description || 'No detailed description provided for this campus event.'}
                      </p>
                    </div>

                    {/* Organizer Card */}
                    <aside className="space-y-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs lg:col-span-4 h-fit">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                        Organized by
                      </p>
                      <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                        {club?.name || `${collegeDisplay} Student Body`}
                      </h3>
                      <p className="line-clamp-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {club?.description || 'Active campus club organizing technical symposia, cultural showcases, and workshops.'}
                      </p>

                      {clubId && (
                        <Link
                          href={`/college/${slug}/clubs/${clubId}`}
                          className="mt-2 block min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
                        >
                          View Club Profile &rarr;
                        </Link>
                      )}
                    </aside>
                  </div>
                </div>

                {/* 6-Tile Brutalist Event Spec Grid */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Host club</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{club?.name || collegeDisplay}</p>
                  </div>

                  <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Date</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{dateInfo.full}</p>
                  </div>

                  {eventTime && (
                    <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Time</p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{eventTime}</p>
                    </div>
                  )}

                  <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Venue</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">
                      {event.venue || event.location || 'Campus Arena'}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Attending</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">
                      {typeof event.registeredCount === 'number' && event.registeredCount > 0
                        ? `${event.registeredCount} students going`
                        : 'Be the first to RSVP'}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-brutal-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Admission</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">
                      {event.isPaid ? `₹${event.fee || 0} (Paid Ticket)` : 'Free Campus Entry'}
                    </p>
                  </div>
                </div>

                {/* Registration Actions (Directly after Event Boxes, without separating border lines) */}
                <div id="register" className="mt-6 space-y-4">
                  {regError && (
                    <div className="flex items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-3 text-xs font-semibold text-[var(--text-primary)]">
                      <AlertCircle className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
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
                          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-7 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-sm sm:flex-none"
                        >
                          <span>External Registration Form</span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                      ) : isRegistered ? (
                        <>
                          <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--surface-inverse)] px-7 text-sm font-bold uppercase tracking-wider text-[var(--text-inverse)] shadow-brutal-xs">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>RSVP Confirmed</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelRegistration}
                            disabled={cancelMutation.isPending || cancelExternalMutation.isPending}
                            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] disabled:cursor-not-allowed disabled:opacity-50 shadow-brutal-xs"
                          >
                            {cancelMutation.isPending || cancelExternalMutation.isPending ? 'Cancelling…' : 'Cancel Registration'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={registerMutation.isPending || isCheckingOut || isCapacityFull}
                          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-8 text-sm font-bold transition-transform shadow-brutal-sm sm:flex-none cursor-pointer ${
                            isCapacityFull
                              ? 'cursor-not-allowed border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[var(--text-muted)]'
                              : 'bg-[var(--accent-strong)] text-white hover:-translate-y-0.5'
                          }`}
                        >
                          {registerMutation.isPending || isCheckingOut ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Processing…</span>
                            </>
                          ) : isCapacityFull ? (
                            <>
                              <AlertCircle className="h-4 w-4" />
                              <span>Capacity Full</span>
                            </>
                          ) : (
                            <>
                              <span>{event.isPaid ? `Pay ₹${event.fee || 0} & Register` : 'Register for Event'}</span>
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleShare}
                        title="Share event"
                        aria-label="Share event"
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs cursor-pointer"
                      >
                        {shareNotice ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="text-xs font-semibold text-[var(--text-secondary)]">
                      {validRegistrationUrl ? (
                        <span className="flex items-center gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span>Registration managed externally by organizer</span>
                        </span>
                      ) : (
                        <span>
                          {event.capacity !== null && event.capacity !== undefined
                            ? `${event.registeredCount || 0} / ${event.capacity} seats filled`
                            : 'Open capacity'}
                          {isCapacityFull ? ' · Capacity reached' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {shareNotice && (
                    <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-brutal-xs">
                      <Check className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                      Link copied to clipboard!
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Gallery Section */}
            {event.gallery && event.gallery.length > 0 && (
              <section className="border-t-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-page)]">
                <div className="mx-auto max-w-7xl space-y-6 px-4 py-14 sm:px-6 lg:px-8">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                      Event Photo Gallery
                    </h2>
                    <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] shadow-brutal-xs">
                      {event.gallery.length} photos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {event.gallery.map((img, idx) => (
                      <button
                        key={img.publicId || idx}
                        type="button"
                        onClick={() => setActiveGalleryEvent(event)}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] shadow-brutal-xs transition-all duration-200 hover:-translate-y-1"
                        aria-label={`View photo ${idx + 1}`}
                      >
                        <img src={img.url} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Custom Questionnaire Form Modal */}
        {showFormModal && event?.customFormDefinition?.fields && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="form-modal-title"
              className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-lg sm:p-8"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Registration form
                </p>
                <h3 id="form-modal-title" className="font-campus text-2xl uppercase tracking-tight text-[var(--text-primary)]">
                  {event.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">Please answer these organizer questions to complete RSVP.</p>
              </div>

              {formValidationError && (
                <div className="flex items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-3 text-xs font-semibold text-[var(--text-primary)]">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
                  <span>{formValidationError}</span>
                </div>
              )}

              <form onSubmit={handleCustomFormSubmit} className="space-y-4">
                {event.customFormDefinition.fields.map((field, idx) => {
                  const fieldKey: string = field.id || field.name || `field_${idx}`;
                  const value = (formAnswers[fieldKey] as string) || '';

                  return (
                    <div key={fieldKey} className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        {field.label || fieldKey} {field.required && <span className="text-[var(--accent-strong)]">*</span>}
                      </label>

                      {field.type === 'SELECT' ? (
                        <select
                          value={value}
                          onChange={(e) =>
                            setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          className="w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-page)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
                          required={field.required}
                        >
                          <option value="">Select an option…</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'RADIO' ? (
                        <div className="space-y-1.5 pt-1">
                          {field.options?.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                              <input
                                type="radio"
                                name={fieldKey}
                                value={opt}
                                checked={value === opt}
                                onChange={(e) =>
                                  setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                                }
                                required={field.required}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={field.type === 'NUMBER' ? 'number' : 'text'}
                          value={value}
                          onChange={(e) =>
                            setFormAnswers((prev) => ({
                              ...prev,
                              [fieldKey]: field.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.label || fieldKey}…`}
                          className="w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-page)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
                          required={field.required}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-soft)]">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    disabled={registerMutation.isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-6 text-xs font-bold uppercase tracking-wider text-white shadow-brutal-sm"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Submitting…</span>
                      </>
                    ) : (
                      <>
                        <span>Submit &amp; Register</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* External Guest Registration Dialog */}
        {showExternalDialog && event && (
          <ExternalGuestRegistrationDialog
            isOpen={showExternalDialog}
            event={event}
            onClose={() => setShowExternalDialog(false)}
            onSuccess={() => {
              setExternalToken(getStoredExternalToken());
              setShowExternalDialog(false);
              setShowModal(true);
            }}
          />
        )}

        {/* Cross-College Student Confirmation Modal */}
        {showCrossCollegeModal && event && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="max-w-lg w-full rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 sm:p-8 space-y-5 shadow-brutal-lg">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[var(--surface-tile)] border-2 border-[var(--border-strong)] text-[var(--accent-strong)]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-campus text-2xl uppercase tracking-tight text-[var(--text-primary)]">
                    Cross-College Registration
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">Inter-institutional event participation</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-4 text-xs leading-relaxed space-y-2.5">
                <p>
                  You are registering as a verified student for an event organized by another institution.
                </p>
                <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Host Campus:</span>
                    <span className="font-bold text-[var(--text-primary)]">{event?.college?.name || slug.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Your Account:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{user?.email}</span>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  &bull; Your student identity details will be securely shared with the host college organizers.<br />
                  &bull; Your home institution affiliation and account remain unchanged.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCrossCollegeModal(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrossCollege}
                  disabled={registerMutation.isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-6 text-xs font-bold uppercase tracking-wider text-white shadow-brutal-sm"
                >
                  {registerMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; Register</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] max-w-md w-full p-8 text-center space-y-4 shadow-brutal-lg">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="font-campus text-3xl font-bold uppercase text-[var(--text-primary)]">
                RSVP Confirmed!
              </h3>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Your registration for <strong>{event?.title}</strong> is confirmed. Check your email for event check-in details.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-3 rounded-xl bg-[var(--accent-strong)] text-white text-xs font-bold uppercase tracking-wider shadow-brutal-xs transition-transform hover:-translate-y-0.5"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Gallery Lightbox */}
        {activeGalleryEvent && (
          <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />
        )}
      </div>
    </PublicLayout>
  );
}

export default EventDetailPageClient;
