'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
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
import { apiClient } from '@/lib/api/axios';
import ManagerLayout from '@/components/manager/ManagerLayout';
import { EventHero } from '@/components/manager/EventHero';
import { EventCertificatesSection } from '@/components/manager/certificates/EventCertificatesSection';
import { Modal } from '@/components/common/Modal';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import type { EventVisibility } from '@/types/models';
import {
  ArrowLeft,
  Calendar,
  Upload,
  Trash2,
  Ban,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  Image as ImageIcon,
  Sparkles,
  Plus,
  ExternalLink,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Globe,
  Building2,
} from 'lucide-react';

export interface ManagerEventDetailClientProps {
  slug: string;
  clubId: string;
  eventId: string;
}

const formatDateForInput = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ManagerEventDetailClient({
  slug,
  clubId,
  eventId,
}: ManagerEventDetailClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  // State: Pagination & Filter for Attendees
  const [attendeePage, setAttendeePage] = useState(1);
  const [participantTypeFilter, setParticipantTypeFilter] = useState<'ALL' | 'STUDENT' | 'EXTERNAL'>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const {
    data: event,
    isLoading: loading,
    isError,
    refetch: refetchEvent,
  } = useClubEvent(slug, clubId, eventId);

  const {
    data: attendeesData,
    isLoading: attendeesLoading,
    isError: attendeesError,
    refetch: refetchAttendees,
  } = useEventAttendeesQuery(slug, clubId, eventId, attendeePage, 10, participantTypeFilter);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.get(`/events/${eventId}/export`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `attendees-${eventId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to export attendees CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Mutations
  const updateEventMutation = useUpdateClubEventMutation(slug);
  const cancelEventMutation = useCancelClubEventMutation(slug);
  const deleteEventMutation = useDeleteClubEventMutation(slug);

  // Form State (using fallback to loaded event data)
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState<string | null>(null);
  const [customStartAt, setCustomStartAt] = useState<string | null>(null);
  const [customEndAt, setCustomEndAt] = useState<string | null>(null);
  const [customRegistrationUrl, setCustomRegistrationUrl] = useState<string | null>(null);
  const [customVisibility, setCustomVisibility] = useState<EventVisibility | null>(null);
  const [isVisibilityConfirmOpen, setIsVisibilityConfirmOpen] = useState(false);
  const [formError, setFormError] = useState('');

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
  const currentVisibility: EventVisibility = event?.visibility || 'COLLEGE';
  const visibility: EventVisibility = customVisibility ?? currentVisibility;

  // Cover Image State
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDeleting, setCoverDeleting] = useState(false);

  // Gallery Upload State
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [deletingPublicId, setDeletingPublicId] = useState<string | null>(null);

  // Confirmation Modals State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState('');

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setToastError(msg);
      setTimeout(() => setToastError(''), 4000);
    } else {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Submit Event Edits
  const handleSaveEvent = async (e: React.FormEvent) => {
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
        setFormError('End date/time must be after start date/time.');
        return;
      }
    }

    // Check if visibility changed relative to the loaded event
    if (customVisibility !== null && customVisibility !== currentVisibility) {
      setIsVisibilityConfirmOpen(true);
      return;
    }

    await doSaveEvent();
  };

  const doSaveEvent = async () => {
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
          visibility,
        },
      });

      showToast('Event updated successfully!');
      setCustomTitle(null);
      setCustomDescription(null);
      setCustomLocation(null);
      setCustomStartAt(null);
      setCustomEndAt(null);
      setCustomRegistrationUrl(null);
      setCustomVisibility(null);
      setIsVisibilityConfirmOpen(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to update event.';
      setFormError(message);
    }
  };

  // Cancel Event
  const handleCancelEvent = async () => {
    try {
      await cancelEventMutation.mutateAsync({ clubId, eventId });
      setIsCancelModalOpen(false);
      showToast('Event has been cancelled.');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to cancel event.';
      showToast(message, true);
    }
  };

  // Delete Event Permanently
  const handleDeleteEvent = async () => {
    try {
      await deleteEventMutation.mutateAsync({ eventId, clubId });
      setIsDeleteModalOpen(false);
      showToast('Event deleted permanently.');
      router.push(getPath(`/manager/clubs/${clubId}`));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to delete event.';
      showToast(message, true);
    }
  };

  // Cover Image Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cover', file);

    try {
      setCoverUploading(true);
      await uploadEventCover(eventId, formData);
      showToast('Cover image uploaded!');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to upload cover image.';
      showToast(message, true);
    } finally {
      setCoverUploading(false);
    }
  };

  // Cover Image Delete
  const handleCoverDelete = async () => {
    if (!window.confirm('Are you sure you want to remove the cover image?')) return;

    try {
      setCoverDeleting(true);
      await deleteEventCover(eventId);
      showToast('Cover image removed.');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to remove cover image.';
      showToast(message, true);
    } finally {
      setCoverDeleting(false);
    }
  };

  // Multi-image Gallery Upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 10) {
      showToast('You can upload a maximum of 10 gallery images at once.', true);
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });

    try {
      setGalleryUploading(true);
      await uploadEventGallery(eventId, formData);
      showToast('Gallery images uploaded!');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to upload gallery images.';
      showToast(message, true);
    } finally {
      setGalleryUploading(false);
    }
  };

  // Single Gallery Image Delete
  const handleGalleryImageDelete = async (publicId: string) => {
    if (!window.confirm('Remove this photo from the event gallery?')) return;

    try {
      setDeletingPublicId(publicId);
      await deleteEventGalleryImage(eventId, publicId);
      showToast('Photo removed from gallery.');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to remove photo.';
      showToast(message, true);
    } finally {
      setDeletingPublicId(null);
    }
  };

  const isCancelledOrCompleted =
    event?.status === 'CANCELLED' || event?.status === 'COMPLETED';
  const gallery = Array.isArray(event?.gallery) ? event.gallery : [];

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-10 animate-in fade-in duration-300">
        {/* Toast Notifications */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded-xl shadow-xl text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {toastError && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-rose-950 border border-rose-500/40 text-rose-300 rounded-xl shadow-xl text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{toastError}</span>
          </div>
        )}

        {/* Back Button */}
        <div>
          <Link
            href={getPath(`/manager/clubs/${clubId}`)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--primary)]" />
            <span>Back to Club Management</span>
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 animate-dashboard-skeleton space-y-4">
            <div className="h-8 bg-[var(--line)]/50 rounded-xl w-1/3" />
            <div className="h-4 bg-[var(--line)]/30 rounded-xl w-2/3" />
          </div>
        ) : isError || !event ? (
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-6 flex items-center justify-between text-rose-700 dark:text-rose-300 text-sm shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span className="font-medium">Failed to load event details.</span>
            </div>
            <button
              onClick={() => refetchEvent()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-200/60 dark:bg-rose-900/50 px-3 py-1 text-xs font-bold uppercase transition hover:bg-rose-200 dark:hover:bg-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Magazine Hero Banner for Event */}
            <EventHero event={event}>
              <div className="flex items-center gap-2.5 flex-wrap">
                {!isCancelledOrCompleted && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold rounded-xl backdrop-blur-md transition-colors cursor-pointer shadow-xs"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel Event</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold rounded-xl backdrop-blur-md transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Event</span>
                </button>
              </div>
            </EventHero>

            {/* Section 1: Edit Event Details Form */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                    Edit Event Details
                  </h2>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Update schedule, venue, registration URL, and visibility settings
                  </p>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Event Title */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                      required
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                      Location *
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                      required
                    />
                  </div>

                  {/* Registration URL */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Registration / Redirect URL</span>
                    </label>
                    <input
                      type="url"
                      value={registrationUrl}
                      onChange={(e) => setCustomRegistrationUrl(e.target.value)}
                      placeholder="e.g. https://forms.google.com/your-form"
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] resize-none transition-all"
                      required
                    />
                  </div>

                  {/* Event Visibility Selector */}
                  <div className="md:col-span-2 pt-2 border-t border-[var(--line)]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                        Event Visibility *
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-[var(--ink-soft)]">Current Setting:</span>
                        {currentVisibility === 'PUBLIC' ? (
                          <span className="text-emerald-500 uppercase">Public Event</span>
                        ) : (
                          <span className="text-[var(--primary)] uppercase">College Only</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* College Only Option */}
                      <div
                        onClick={() => setCustomVisibility('COLLEGE')}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          visibility === 'COLLEGE'
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                            : 'border-[var(--line)] bg-[var(--bg)]/50 hover:border-[var(--primary)]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Building2
                              className={`w-4 h-4 ${
                                visibility === 'COLLEGE' ? 'text-[var(--primary)]' : 'text-[var(--ink-soft)]'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                visibility === 'COLLEGE' ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                              }`}
                            >
                              College Only
                            </span>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              visibility === 'COLLEGE' ? 'border-[var(--primary)]' : 'border-[var(--line)]'
                            }`}
                          >
                            {visibility === 'COLLEGE' && (
                              <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                          Only students belonging to this college can register. External guest and cross-college registrations are unavailable.
                        </p>
                      </div>

                      {/* Public Event Option */}
                      <div
                        onClick={() => setCustomVisibility('PUBLIC')}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          visibility === 'PUBLIC'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-[var(--line)] bg-[var(--bg)]/50 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Globe
                              className={`w-4 h-4 ${
                                visibility === 'PUBLIC' ? 'text-emerald-500' : 'text-[var(--ink-soft)]'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                visibility === 'PUBLIC' ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                              }`}
                            >
                              Public Event
                            </span>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              visibility === 'PUBLIC' ? 'border-emerald-500' : 'border-[var(--line)]'
                            }`}
                          >
                            {visibility === 'PUBLIC' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                          Platform-wide discovery. Students from other colleges and external guests (via email OTP) can discover and register.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Date Pickers */}
                  <div className="md:col-span-2 pt-2 border-t border-[var(--line)] grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateTimePicker
                      label="Start Date & Time"
                      value={startAt}
                      onChange={(val) => setCustomStartAt(val)}
                      required
                    />

                    <DateTimePicker
                      label="End Date & Time (Optional)"
                      value={endAt}
                      onChange={(val) => setCustomEndAt(val)}
                      min={startAt}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updateEventMutation.isPending}
                    className="inline-flex min-h-11 items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {updateEventMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section 2: Cover Image Section */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                    Event Cover Image
                  </h2>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Upload a high-resolution cover image to showcase on the campus event feed
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="relative w-full md:w-80 h-44 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 overflow-hidden shrink-0 shadow-xs">
                  {event.coverImage?.url ? (
                    <img
                      src={event.coverImage.url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 text-center text-[var(--ink-soft)]">
                      <div className="space-y-1">
                        <Sparkles className="w-6 h-6 text-[var(--primary)]/60 mx-auto" />
                        <p className="text-xs font-semibold">No cover image uploaded</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-[var(--ink-soft)] font-medium leading-relaxed">
                    Recommended ratio 16:9. Displayed full-bleed across student portal feeds, RSVPs, and certificates.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex min-h-10 items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                      {coverUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>
                        {event.coverImage?.url ? 'Replace Cover Image' : 'Upload Cover Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        disabled={coverUploading || coverDeleting}
                        className="hidden"
                      />
                    </label>

                    {event.coverImage?.url && (
                      <button
                        onClick={handleCoverDelete}
                        disabled={coverUploading || coverDeleting}
                        className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        {coverDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Event Photo Gallery */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                      Photo Gallery
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)]">
                      Upload photos captured during or after the event
                    </p>
                  </div>
                </div>

                <label className="cursor-pointer inline-flex min-h-10 items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                  {galleryUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Add Photos (Up to 10)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryUpload}
                    disabled={galleryUploading}
                    className="hidden"
                  />
                </label>
              </div>

              {gallery.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)]/50 p-8 text-center">
                  <ImageIcon className="w-8 h-8 text-[var(--ink-soft)]/50 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[var(--ink)] font-display">
                    No photos in gallery yet
                  </p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">
                    Upload event photos to allow campus visitors to view the gallery on public event pages.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {gallery.map((img, idx) => (
                    <div
                      key={img.publicId || idx}
                      className="relative group rounded-2xl overflow-hidden border border-[var(--line)] aspect-square bg-[var(--bg)] shadow-xs"
                    >
                      <img
                        src={img.url}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <button
                        onClick={() => img.publicId && handleGalleryImageDelete(img.publicId)}
                        disabled={deletingPublicId === img.publicId}
                        className="absolute top-2 right-2 p-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full transition opacity-90 group-hover:opacity-100 shadow-md cursor-pointer"
                        title="Delete Photo"
                      >
                        {deletingPublicId === img.publicId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Attendees / Registrations Section */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                      Event Attendees
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)]">
                      Registered campus students, cross-college attendees, and external guests
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                    className="inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--primary-soft)]/60 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                    <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)]">
                    {attendeesData?.total || 0} Registered
                    {event.capacity ? ` / ${event.capacity} Capacity` : ''}
                  </span>
                </div>
              </div>

              {/* Participant Type Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-[var(--ink-soft)] flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                {(['ALL', 'STUDENT', 'EXTERNAL'] as const).map((type) => {
                  const isActive = participantTypeFilter === type;
                  const label = type === 'ALL' ? 'All' : type === 'STUDENT' ? 'Students' : 'External Guests';
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setParticipantTypeFilter(type); setAttendeePage(1); }}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {attendeesLoading ? (
                <div className="py-8 text-center text-[var(--ink-soft)]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--primary)]" />
                  <p className="text-xs font-semibold">Loading attendee list...</p>
                </div>
              ) : attendeesError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
                  <span>Failed to load attendee registrations.</span>
                  <button
                    onClick={() => refetchAttendees()}
                    className="underline font-bold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : !attendeesData?.registrations || attendeesData.registrations.length === 0 ? (
                <div className="py-8 text-center text-[var(--ink-soft)] text-xs font-medium">
                  {participantTypeFilter === 'ALL'
                    ? 'No attendees have registered for this event yet.'
                    : `No ${participantTypeFilter.toLowerCase()} attendees found.`}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--line)] bg-[var(--bg)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          <th className="py-3 px-4">Attendee</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Institution / Roll No</th>
                          <th className="py-3 px-4">Registered Date</th>
                          <th className="py-3 px-4">Payment & Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]/50">
                        {attendeesData.registrations.map((reg) => {
                          const displayName =
                            (typeof reg.participantName === 'string' && reg.participantName.trim()) ||
                            (typeof reg.user?.name === 'string' && reg.user.name.trim()) ||
                            'Anonymous Attendee';
                          const displayInitials = displayName.slice(0, 2).toUpperCase();
                          const displayEmail = reg.participantEmail || reg.user?.email || '—';
                          const isExternal = reg.participantType === 'EXTERNAL';
                          const isCross = Boolean(reg.homeCollegeId && event?.collegeId && reg.homeCollegeId !== event.collegeId);
                          const institutionOrRoll =
                            reg.participantCollegeName ||
                            reg.participantRollNumber ||
                            (isExternal ? 'Guest / External' : 'Campus Student');

                          const formatRegisteredDate = (dateStr?: string | null) => {
                            if (!dateStr) return '—';
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return '—';
                            return d.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            });
                          };

                          return (
                            <tr
                              key={reg.id}
                              className="transition-colors hover:bg-[var(--primary-soft)]/20 text-[var(--ink)]"
                            >
                              <td className="py-3 px-4 flex items-center gap-3">
                                {reg.user?.avatarUrl ? (
                                  <img
                                    src={reg.user.avatarUrl}
                                    alt={displayName}
                                    className="w-8 h-8 rounded-full object-cover border border-[var(--line)]"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-xs uppercase bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20 shadow-xs">
                                    {displayInitials}
                                  </div>
                                )}
                                <span className="font-bold">{displayName}</span>
                              </td>
                              <td className="py-3 px-4">
                                {isExternal ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    External Guest
                                  </span>
                                ) : isCross ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                                    Cross-College
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Student
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-[var(--ink-soft)]">{displayEmail}</td>
                              <td className="py-3 px-4 text-[var(--ink-soft)]">{institutionOrRoll}</td>
                              <td className="py-3 px-4 text-[var(--ink-soft)]">
                                {formatRegisteredDate(reg.registeredAt)}
                              </td>
                              <td className="py-3 px-4">
                                {reg.isUserDeleted ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    User Deleted (Snapshot)
                                  </span>
                                ) : reg.paymentTransaction ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                                        Paid ₹{Number(reg.paymentTransaction.amount) || 0}
                                      </span>
                                      {reg.paymentTransaction.status === 'REFUNDED' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/20 text-blue-500">
                                          Refunded
                                        </span>
                                      )}
                                    </div>
                                    {typeof reg.paymentTransaction.id === 'string' && (
                                      <div className="text-[9px] font-mono text-[var(--ink-soft)] truncate max-w-[120px]" title={reg.paymentTransaction.id}>
                                        Txn: {reg.paymentTransaction.id.slice(0, 8)}...
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Confirmed (Free)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Attendees Pagination */}
                  {(attendeesData.totalPages || 1) > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
                      <span className="text-xs text-[var(--ink-soft)]">
                        Page {attendeePage} of {attendeesData.totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={attendeePage <= 1}
                          onClick={() => setAttendeePage((p) => Math.max(1, p - 1))}
                          className="p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--primary-soft)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={attendeePage >= (attendeesData.totalPages || 1)}
                          onClick={() => setAttendeePage((p) => p + 1)}
                          className="p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--primary-soft)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 5: EVENT CERTIFICATES */}
        <EventCertificatesSection
          slug={slug}
          clubId={clubId}
          eventId={eventId}
          eventTitle={event?.title}
        />

        {/* Modal: Cancel Event */}
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => !cancelEventMutation.isPending && setIsCancelModalOpen(false)}
          title="Cancel Event"
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-700 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Are you sure you want to cancel &quot;{event?.title}&quot;? The event status will change to CANCELLED on public listings.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={cancelEventMutation.isPending}
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--primary-soft)]/60 text-[var(--ink-soft)] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                No, Keep Event
              </button>
              <button
                type="button"
                disabled={cancelEventMutation.isPending}
                onClick={handleCancelEvent}
                className="inline-flex min-h-10 items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cancelEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Yes, Cancel Event</span>
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: Delete Event */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !deleteEventMutation.isPending && setIsDeleteModalOpen(false)}
          title="Permanently Delete Event"
        >
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-800 dark:text-rose-200 mb-1">
                  Warning: Permanent Deletion
                </p>
                <p>
                  Deleting &quot;{event?.title}&quot; will permanently remove this event and all associated cover & gallery photos. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteEventMutation.isPending}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--primary-soft)]/60 text-[var(--ink-soft)] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteEventMutation.isPending}
                onClick={handleDeleteEvent}
                className="inline-flex min-h-10 items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleteEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: Confirm Visibility Change */}
        <Modal
          isOpen={isVisibilityConfirmOpen}
          onClose={() => !updateEventMutation.isPending && setIsVisibilityConfirmOpen(false)}
          title={
            visibility === 'PUBLIC'
              ? 'Make Event Public?'
              : 'Restrict Event to College Only?'
          }
        >
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl flex items-start gap-3 text-xs border ${
                visibility === 'PUBLIC'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  visibility === 'PUBLIC' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
              <div className="space-y-2">
                <p className="font-bold text-sm">
                  {visibility === 'PUBLIC'
                    ? 'Confirm Visibility Change: College Only → Public Event'
                    : 'Confirm Visibility Change: Public Event → College Only'}
                </p>
                {visibility === 'PUBLIC' ? (
                  <p className="leading-relaxed">
                    You are changing <strong>&quot;{event?.title}&quot;</strong> to a{' '}
                    <strong>Public Event</strong>. Students from other partner colleges and external participants (via email OTP) will become eligible to discover and register for this event.
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    You are changing <strong>&quot;{event?.title}&quot;</strong> to{' '}
                    <strong>College Only</strong>. New cross-college student registrations and external guest registrations will no longer be accepted. Existing registrations will remain intact and will not be deleted.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={updateEventMutation.isPending}
                onClick={() => setIsVisibilityConfirmOpen(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--primary-soft)]/60 text-[var(--ink-soft)] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateEventMutation.isPending}
                onClick={doSaveEvent}
                className={`inline-flex min-h-10 items-center gap-2 px-5 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer ${
                  visibility === 'PUBLIC'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {updateEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>
                    {visibility === 'PUBLIC'
                      ? 'Yes, Make Public'
                      : 'Yes, Restrict to College'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </ManagerLayout>
  );
}

export default ManagerEventDetailClient;
