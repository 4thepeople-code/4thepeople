'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useClubEvent } from '@/lib/api/events';
import {
  useUpdateClubEventMutation,
  useCancelClubEventMutation,
  useDeleteClubEventMutation,
  useEventAttendeesQuery,
  uploadEventCover,
  deleteEventCover,
  uploadEventGallery,
  deleteEventGalleryImage,
} from '@/lib/api/manager';
import { queryKeys } from '@/lib/api/queryKeys';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import Modal from '@/components/dashboard/ui/Modal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { EventCertificatesSection } from '@/components/manager/certificates/EventCertificatesSection';
import { actions, emptyStates, eventManager } from '@/lib/copy';

export interface ManagerEventEditorClientProps {
  slug: string;
  clubId: string;
  eventId: string;
}

const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ||
  fallback;

function formatEventDate(dateStr?: string) {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(dateStr?: string, endStr?: string | null) {
  if (!dateStr) return null;
  const s = new Date(dateStr);
  if (isNaN(s.getTime())) return null;
  const startFormatted = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (endStr) {
    const e = new Date(endStr);
    if (!isNaN(e.getTime())) {
      return `${startFormatted} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  return startFormatted;
}

function formatDateForInput(dateStr?: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Event Manager event editor: hero with cover + status, edit details form,
 * cover upload/remove, photo gallery (max 10), attendees list, cancel + delete.
 * Presentation moved to the new UI system; same manager API hooks as before.
 */
export default function ManagerEventEditorClient({
  slug,
  clubId,
  eventId,
}: ManagerEventEditorClientProps) {
  const t = eventManager.events;
  const em = eventManager.dashboard;
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [attendeePage, setAttendeePage] = useState(1);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState<string | null>(null);
  const [customStartAt, setCustomStartAt] = useState<string | null>(null);
  const [customEndAt, setCustomEndAt] = useState<string | null>(null);
  const [customRegistrationUrl, setCustomRegistrationUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDeleting, setCoverDeleting] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [deletingPublicId, setDeletingPublicId] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCoverConfirmOpen, setIsCoverConfirmOpen] = useState(false);
  const [galleryPhotoToRemove, setGalleryPhotoToRemove] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: event,
    isLoading,
    isError,
    refetch,
  } = useClubEvent(slug, clubId, eventId);

  const {
    data: attendeesData,
    isLoading: attendeesLoading,
    isError: attendeesError,
    refetch: refetchAttendees,
  } = useEventAttendeesQuery(slug, clubId, eventId, attendeePage, 10);

  const updateEventMutation = useUpdateClubEventMutation(slug);
  const cancelEventMutation = useCancelClubEventMutation(slug);
  const deleteEventMutation = useDeleteClubEventMutation(slug);

  const title = customTitle ?? (event?.title || '');
  const description = customDescription ?? (event?.description || '');
  const location = customLocation ?? (event?.location || '');
  const startAt = customStartAt ?? formatDateForInput(event?.startAt);
  const endAt = customEndAt ?? formatDateForInput(event?.endAt);
  const registrationUrl =
    customRegistrationUrl ??
    (event?.registrationUrl ||
      (event as unknown as { url?: string })?.url ||
      (event as unknown as { externalUrl?: string })?.externalUrl ||
      '');

  const invalidateEventQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId) });
  };

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !description.trim() || !location.trim() || !startAt) {
      setFormError('Title, description, location, and start date are required.');
      return;
    }

    const start = new Date(startAt);
    if (isNaN(start.getTime())) {
      setFormError('Start date/time is invalid.');
      return;
    }

    if (endAt) {
      const end = new Date(endAt);
      if (isNaN(end.getTime())) {
        setFormError('End date/time is invalid.');
        return;
      }
      if (end <= start) {
        setFormError('End date/time must be after the start date/time.');
        return;
      }
    }

    try {
      await updateEventMutation.mutateAsync({
        clubId,
        eventId,
        data: {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          registrationUrl: registrationUrl.trim() || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : null,
        },
      });

      toast(t.toastSaved, { variant: 'success' });
      setCustomTitle(null);
      setCustomDescription(null);
      setCustomLocation(null);
      setCustomStartAt(null);
      setCustomEndAt(null);
      setCustomRegistrationUrl(null);
      invalidateEventQueries();
    } catch (err: unknown) {
      setFormError(errMsg(err, 'Failed to update event.'));
    }
  };

  const handleCancelEvent = async () => {
    try {
      await cancelEventMutation.mutateAsync({ clubId, eventId });
      setIsCancelModalOpen(false);
      toast(t.toastCancelled, { variant: 'success' });
      invalidateEventQueries();
    } catch (err: unknown) {
      toast(errMsg(err, 'Failed to cancel event.'), { variant: 'error' });
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await deleteEventMutation.mutateAsync({ eventId, clubId });
      setIsDeleteModalOpen(false);
      toast(t.toastDeleted, { variant: 'success' });
      router.push(`/college/${slug}/manager/clubs/${clubId}`);
    } catch (err: unknown) {
      toast(errMsg(err, 'Failed to delete event.'), { variant: 'error' });
    }
  };

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cover', file);

    try {
      setCoverUploading(true);
      await uploadEventCover(eventId, formData);
      toast(t.toastCoverUploaded, { variant: 'success' });
      invalidateEventQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errCoverUpload), { variant: 'error' });
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverDelete = async () => {
    setCoverDeleting(true);
    try {
      await deleteEventCover(eventId);
      toast(t.toastCoverRemoved, { variant: 'success' });
      invalidateEventQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errCoverRemove), { variant: 'error' });
    } finally {
      setCoverDeleting(false);
    }
  };

  const handleGalleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 10) {
      toast(t.errMaxGallery, { variant: 'error' });
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });

    try {
      setGalleryUploading(true);
      await uploadEventGallery(eventId, formData);
      toast(t.galleryUpload, { variant: 'success' });
      invalidateEventQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.galleryUploadError), { variant: 'error' });
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleGalleryImageDelete = async (publicId: string) => {
    setDeletingPublicId(publicId);
    try {
      await deleteEventGalleryImage(eventId, publicId);
      toast(t.galleryPhotoRemove, { variant: 'success' });
      invalidateEventQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.galleryPhotoRemoveError), { variant: 'error' });
    } finally {
      setDeletingPublicId(null);
    }
  };

  const isCancelledOrCompleted = event?.status === 'CANCELLED' || event?.status === 'COMPLETED';
  const gallery = Array.isArray(event?.gallery) ? event.gallery : [];
  const coverUrl = event?.coverImageUrl || event?.coverUrl || event?.coverImage?.url;
  const statusChip =
    event?.status === 'CANCELLED' ? 'danger' : event?.status === 'COMPLETED' ? 'neutral' : 'success';

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <SkeletonLines count={2} />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <EmptyState
        icon={Calendar}
        title={t.loadFailedTitle}
        description={t.loadFailedDescription}
        actionLabel={actions.retry}
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* Back */}
      <Link
        href={`/college/${slug}/manager/clubs/${clubId}`}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xl">
        <div className="relative min-h-[280px] sm:min-h-[340px]">
          {coverUrl && !coverFailed ? (
            <img src={coverUrl} alt={event.title} className="absolute inset-0 h-full w-full object-cover" onError={() => setCoverFailed(true)} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-soft)] via-[var(--surface)] to-[var(--bg)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
          <div className="relative z-10 flex min-h-[280px] flex-col justify-end gap-5 p-6 sm:min-h-[340px] sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="brand">{event.category || 'CAMPUS EVENT'}</Chip>
              <Chip variant={statusChip} dot>
                {event.status === 'CANCELLED'
                  ? em.statusCancelled
                  : event.status === 'COMPLETED'
                    ? em.statusCompleted
                    : event.status === 'ONGOING'
                      ? em.statusOngoing
                      : em.statusUpcoming}
              </Chip>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-black tracking-tight text-white uppercase sm:text-4xl">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/80">
                <div className="flex items-center gap-1.5">
                  <Calendar aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
                  <span>{formatEventDate(event.startAt)}</span>
                </div>
                {formatEventTime(event.startAt, event.endAt) && (
                  <div className="flex items-center gap-1.5">
                    <Clock aria-hidden="true" className="h-4 w-4 text-[var(--secondary)]" />
                    <span>{formatEventTime(event.startAt, event.endAt)}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin aria-hidden="true" className="h-4 w-4 text-[var(--secondary)]" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!isCancelledOrCompleted && (
                <DashboardButton variant="secondary" size="sm" onClick={() => setIsCancelModalOpen(true)}>
                  <Ban aria-hidden="true" className="h-4 w-4" />
                  {t.cancelTitle}
                </DashboardButton>
              )}
              <DashboardButton variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {actions.delete}
              </DashboardButton>
            </div>
          </div>
        </div>
      </section>

      {/* Edit event details */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <Calendar aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.editTitle}</h2>
        </div>

        {formError && (
          <p role="alert" className="mt-4 rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] px-4 py-3 text-xs font-medium text-[var(--secondary)]">
            {formError}
          </p>
        )}

        <form onSubmit={(e) => void handleSaveEvent(e)} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Field label={t.formEventTitle} htmlFor="event-title" required>
                <Input id="event-title" type="text" value={title} onChange={(e) => setCustomTitle(e.target.value)} required />
              </Field>
            </div>
            <div className="space-y-1.5">
              <Field label={t.formLocation} htmlFor="event-location" required>
                <Input id="event-location" type="text" value={location} onChange={(e) => setCustomLocation(e.target.value)} required />
              </Field>
            </div>
            <div className="space-y-1.5">
              <Field label={t.formRegistrationUrl} htmlFor="event-registration-url">
                <Input id="event-registration-url" type="url" value={registrationUrl} onChange={(e) => setCustomRegistrationUrl(e.target.value)} placeholder="https://forms.google.com/your-form" />
              </Field>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Field label={t.formDescription} htmlFor="event-description" required>
                <Textarea id="event-description" rows={3} value={description} onChange={(e) => setCustomDescription(e.target.value)} required />
              </Field>
            </div>
            <div className="space-y-1.5">
              <DateTimePicker label={t.formStartAt} value={startAt} onChange={(val) => setCustomStartAt(val)} required />
            </div>
            <div className="space-y-1.5">
              <DateTimePicker label={t.formEndAt} value={endAt} onChange={(val) => setCustomEndAt(val)} min={startAt} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <DashboardButton type="submit" variant="primary" loading={updateEventMutation.isPending}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {t.save}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>

      {/* Cover */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <ImageIcon aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.coverTitle}</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
            {coverUrl && !coverFailed ? (
              <img src={coverUrl} alt={event.title} className="h-40 w-full object-cover" onError={() => setCoverFailed(true)} />
            ) : (
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[var(--primary-soft)] via-[var(--surface)] to-[var(--bg)] p-4 text-center">
                <p className="text-xs font-semibold text-[var(--ink-soft)]">No cover image uploaded</p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium leading-relaxed text-[var(--ink-soft)]">{t.coverHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              <DashboardButton variant="primary" size="sm" onClick={() => coverInputRef.current?.click()} disabled={coverUploading || coverDeleting} leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}>
                {coverUploading ? 'Uploading…' : coverUrl ? t.replaceCover : t.uploadCover}
              </DashboardButton>
              {coverUrl && (
                <DashboardButton variant="danger" size="sm" onClick={() => setIsCoverConfirmOpen(true)} disabled={coverUploading || coverDeleting} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}>
                  {t.removeCover}
                </DashboardButton>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleCoverUpload(e); e.target.value = ''; }} disabled={coverUploading || coverDeleting} />
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Gallery */}
      <DashboardCard>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <ImageIcon aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.galleryTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.galleryHint}</p>
          </div>
          <DashboardButton variant="primary" size="sm" onClick={() => galleryInputRef.current?.click()} disabled={galleryUploading} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            {galleryUploading ? 'Uploading…' : t.galleryAdd}
          </DashboardButton>
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleGalleryUpload(e); e.target.value = ''; }} disabled={galleryUploading} />
        </div>

        {gallery.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-10 text-center">
            <ImageIcon aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-[var(--ink-soft)]" />
            <p className="text-sm font-semibold text-[var(--ink)]">{t.galleryEmptyTitle}</p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{t.galleryEmptyDescription}</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {gallery.map((img, idx) => (
              <div key={img.publicId || idx} className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <button type="button" onClick={() => setGalleryPhotoToRemove(img.publicId ?? null)} disabled={deletingPublicId === img.publicId} className="absolute top-2 right-2 rounded-full bg-rose-950/80 p-2 text-white transition opacity-90 hover:bg-rose-600 disabled:opacity-40" aria-label={t.galleryRemovePhoto}>
                  {deletingPublicId === img.publicId ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {/* Attendees */}
      <DashboardCard>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <Users aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.attendeesTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.attendeesHint}</p>
          </div>
          <Chip variant="neutral">
            {attendeesData?.total || 0} Registered
            {event.capacity ? ` / ${event.capacity} Capacity` : ''}
          </Chip>
        </div>

        {attendeesLoading ? (
          <div className="mt-4">
            <SkeletonLines count={3} />
          </div>
        ) : attendeesError ? (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title={emptyStates.loadingFailed.title}
              description={t.attendeesError}
              actionLabel={actions.retry}
              onAction={() => void refetchAttendees()}
            />
          </div>
        ) : !attendeesData?.registrations || attendeesData.registrations.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
            {t.attendeesEmpty}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3">
            {attendeesData.registrations.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {reg.user?.avatarUrl ? (
                    <img src={reg.user.avatarUrl} alt={reg.user.name || 'User'} className="h-10 w-10 rounded-full object-cover border border-[var(--line)]" />
                  ) : (
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] font-display text-xs font-bold text-white">
                      {(reg.user?.name || 'U').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--ink)]">{reg.user?.name || 'Anonymous Student'}</p>
                    <p className="truncate text-[11px] text-[var(--ink-soft)]">{reg.user?.email || '—'}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-[var(--ink-soft)]">
                  {new Date(reg.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {(attendeesData?.totalPages || 1) > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--ink-soft)]">
            <span>
              Page {attendeePage} of {attendeesData?.totalPages || 1}
            </span>
            <div className="flex items-center gap-2">
              <DashboardButton variant="secondary" size="sm" disabled={attendeePage <= 1} onClick={() => setAttendeePage((p) => Math.max(1, p - 1))} leftIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}>
                Prev
              </DashboardButton>
              <DashboardButton variant="secondary" size="sm" disabled={attendeePage >= (attendeesData?.totalPages || 1)} onClick={() => setAttendeePage((p) => p + 1)} leftIcon={<ChevronRight aria-hidden="true" className="h-4 w-4" />}>
                Next
              </DashboardButton>
            </div>
          </div>
        )}
      </DashboardCard>

      {/* Cancel modal */}
      <Modal open={isCancelModalOpen} onClose={() => !cancelEventMutation.isPending && setIsCancelModalOpen(false)} title={t.cancelTitle}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p>{t.cancelBody(event.title)}</p>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
            <DashboardButton variant="secondary" size="sm" onClick={() => setIsCancelModalOpen(false)} disabled={cancelEventMutation.isPending}>
              {actions.keep}
            </DashboardButton>
            <DashboardButton variant="danger" size="sm" onClick={() => void handleCancelEvent()} loading={cancelEventMutation.isPending}>
              {t.confirmCancel}
            </DashboardButton>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <ConfirmDialog
        open={isDeleteModalOpen}
        onClose={() => !deleteEventMutation.isPending && setIsDeleteModalOpen(false)}
        onConfirm={() => void handleDeleteEvent()}
        title={t.deleteTitle(event.title)}
        confirmLabel={t.confirmDelete}
        variant="danger"
        loading={deleteEventMutation.isPending}
      >
        {t.deleteBody(event.title)}
      </ConfirmDialog>

      {/* Cover removal confirm */}
      <ConfirmDialog
        open={isCoverConfirmOpen}
        onClose={() => setIsCoverConfirmOpen(false)}
        onConfirm={() => void handleCoverDelete()}
        title={t.removeCoverTitle(event.title)}
        confirmLabel={t.removeCover}
        variant="danger"
        loading={coverDeleting}
      >
        {t.removeCoverBody(event.title)}
      </ConfirmDialog>

      {/* Gallery photo removal confirm */}
      <ConfirmDialog
        open={galleryPhotoToRemove !== null}
        onClose={() => setGalleryPhotoToRemove(null)}
        onConfirm={() => {
          if (galleryPhotoToRemove) {
            void handleGalleryImageDelete(galleryPhotoToRemove);
          }
        }}
        title={t.galleryPhotoRemoveTitle}
        confirmLabel={t.galleryRemovePhoto}
        loading={deletingPublicId !== null}
      >
        {t.galleryPhotoRemoveBody}
      </ConfirmDialog>

      <EventCertificatesSection slug={slug} clubId={clubId} eventId={eventId} eventTitle={event?.title} />
    </div>
  );
}
