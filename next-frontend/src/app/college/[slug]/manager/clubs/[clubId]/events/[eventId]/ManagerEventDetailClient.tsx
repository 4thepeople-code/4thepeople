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
            className={`inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-full border transition-all shadow-xs ${
              isDark
                ? 'bg-[#12141C] border-white/10 text-white hover:border-[#FF5733] hover:text-[#FF5733]'
                : 'bg-white border-[#E2E0D5] text-[#0F172A] hover:border-[#FF5733] hover:text-[#FF5733]'
            }`}
          >
            <ArrowLeft className="w-4 h-4 text-[#FF5733]" />
            <span>Back to Club Management</span>
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div
            className={`rounded-3xl p-8 animate-pulse space-y-4 border ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
            }`}
          >
            <div className="h-8 bg-slate-500/20 rounded w-1/3" />
            <div className="h-4 bg-slate-500/20 rounded w-2/3" />
          </div>
        ) : isError || !event ? (
          <div
            className={`p-6 rounded-2xl flex items-center justify-between text-rose-300 text-sm border ${
              isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>Failed to load event details.</span>
            </div>
            <button
              onClick={() => refetchEvent()}
              className="underline text-xs font-bold hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Magazine Hero Banner for Event */}
            <EventHero event={event}>
              <div className="flex items-center gap-3 flex-wrap">
                {!isCancelledOrCompleted && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold uppercase tracking-wider rounded-xl backdrop-blur-md transition cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Cancel Event</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold uppercase tracking-wider rounded-xl backdrop-blur-md transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Event</span>
                </button>
              </div>
            </EventHero>

            {/* Section 1: Edit Event Details Form */}
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <h2
                className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                <Calendar className="w-5 h-5 text-[#FF5733]" />
                <span>Edit Event Details</span>
              </h2>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Event Title */}
                  <div className="md:col-span-2">
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-1 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A]'
                      }`}
                      required
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-1 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      Location *
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A]'
                      }`}
                      required
                    />
                  </div>

                  {/* Registration URL */}
                  <div>
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Registration / Redirect URL</span>
                    </label>
                    <input
                      type="url"
                      value={registrationUrl}
                      onChange={(e) => setCustomRegistrationUrl(e.target.value)}
                      placeholder="e.g. https://forms.google.com/your-form"
                      className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A]'
                      }`}
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-1 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] resize-none border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A]'
                      }`}
                      required
                    />
                  </div>

                  {/* Event Visibility Selector */}
                  <div
                    className={`md:col-span-2 pt-2 border-t ${
                      isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label
                        className={`block text-xs font-extrabold uppercase tracking-wider ${
                          isDark ? 'text-slate-300' : 'text-[#0F172A]'
                        }`}
                      >
                        Event Visibility *
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-slate-400">Current Setting:</span>
                        {currentVisibility === 'PUBLIC' ? (
                          <span className="text-emerald-400 uppercase">Public Event</span>
                        ) : (
                          <span className="text-slate-300 uppercase">College Only</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* College Only Option */}
                      <div
                        onClick={() => setCustomVisibility('COLLEGE')}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          visibility === 'COLLEGE'
                            ? 'border-[#FF5733] bg-[#FF5733]/5 dark:bg-[#FF5733]/10'
                            : isDark
                            ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                            : 'border-[#E2E0D5] bg-[#FAF9F5] hover:border-[#E8E6DF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Building2
                              className={`w-4 h-4 ${
                                visibility === 'COLLEGE' ? 'text-[#FF5733]' : 'text-slate-400'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                visibility === 'COLLEGE'
                                  ? isDark ? 'text-white' : 'text-[#0F172A]'
                                  : isDark ? 'text-slate-300' : 'text-slate-700'
                              }`}
                            >
                              College Only
                            </span>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              visibility === 'COLLEGE' ? 'border-[#FF5733]' : 'border-slate-500'
                            }`}
                          >
                            {visibility === 'COLLEGE' && (
                              <span className="w-2 h-2 rounded-full bg-[#FF5733]" />
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Only students belonging to this college can register. External guest and cross-college registrations are unavailable.
                        </p>
                      </div>

                      {/* Public Event Option */}
                      <div
                        onClick={() => setCustomVisibility('PUBLIC')}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          visibility === 'PUBLIC'
                            ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                            : isDark
                            ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                            : 'border-[#E2E0D5] bg-[#FAF9F5] hover:border-[#E8E6DF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Globe
                              className={`w-4 h-4 ${
                                visibility === 'PUBLIC' ? 'text-emerald-500' : 'text-slate-400'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                visibility === 'PUBLIC'
                                  ? isDark ? 'text-white' : 'text-[#0F172A]'
                                  : isDark ? 'text-slate-300' : 'text-slate-700'
                              }`}
                            >
                              Public Event
                            </span>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              visibility === 'PUBLIC' ? 'border-emerald-500' : 'border-slate-500'
                            }`}
                          >
                            {visibility === 'PUBLIC' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Platform-wide discovery. Students from other colleges and external guests (via email OTP) can discover and register.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Date Pickers */}
                  <div
                    className={`md:col-span-2 pt-2 border-t grid grid-cols-1 md:grid-cols-2 gap-4 ${
                      isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                    }`}
                  >
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition disabled:opacity-50 cursor-pointer"
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
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <h2
                className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                <ImageIcon className="w-5 h-5 text-[#FF5733]" />
                <span>Event Cover Image</span>
              </h2>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div
                  className={`relative w-full md:w-80 h-44 rounded-2xl border overflow-hidden shrink-0 ${
                    isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  {event.coverImage?.url ? (
                    <img
                      src={event.coverImage.url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 text-center text-slate-400">
                      <div className="space-y-1">
                        <Sparkles className="w-6 h-6 text-[#FF5733]/60 mx-auto" />
                        <p className="text-xs font-semibold">No cover image uploaded</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Upload a high-resolution cover image to showcase on the campus event feed.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition">
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
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer"
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
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div>
                  <h2
                    className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight flex items-center gap-2 ${
                      isDark ? 'text-white' : 'text-[#2563EB]'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5 text-[#2563EB]" />
                    <span>Photo Gallery</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Upload photos captured during or after the event
                  </p>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition">
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
                <div
                  className={`p-8 text-center rounded-2xl border ${
                    isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p
                    className={`text-sm font-semibold ${
                      isDark ? 'text-slate-300' : 'text-[#0F172A]'
                    }`}
                  >
                    No photos in gallery yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload event photos to allow campus visitors to view the gallery.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {gallery.map((img, idx) => (
                    <div
                      key={img.publicId || idx}
                      className="relative group rounded-2xl overflow-hidden border border-slate-700/50 aspect-square bg-slate-950"
                    >
                      <img
                        src={img.url}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />

                      <button
                        onClick={() => img.publicId && handleGalleryImageDelete(img.publicId)}
                        disabled={deletingPublicId === img.publicId}
                        className="absolute top-2 right-2 p-2 bg-rose-950/80 hover:bg-rose-600 text-white rounded-full border border-rose-500/40 transition opacity-90 group-hover:opacity-100 shadow-lg cursor-pointer"
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
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <div
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2
                      className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      Event Attendees
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Registered campus students, cross-college attendees, and external guests
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isDark
                        ? 'border-white/10 hover:bg-white/5 text-slate-300'
                        : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                    <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                  </button>

                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isDark
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-[#FAF9F5] text-[#0F172A] border-[#E2E0D5]'
                    }`}
                  >
                    {attendeesData?.total || 0} Registered
                    {event.capacity ? ` / ${event.capacity} Capacity` : ''}
                  </span>
                </div>
              </div>

              {/* Participant Type Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                <button
                  type="button"
                  onClick={() => { setParticipantTypeFilter('ALL'); setAttendeePage(1); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    participantTypeFilter === 'ALL'
                      ? 'bg-[#FF5733] text-white shadow-sm'
                      : isDark ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setParticipantTypeFilter('STUDENT'); setAttendeePage(1); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    participantTypeFilter === 'STUDENT'
                      ? 'bg-[#FF5733] text-white shadow-sm'
                      : isDark ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => { setParticipantTypeFilter('EXTERNAL'); setAttendeePage(1); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    participantTypeFilter === 'EXTERNAL'
                      ? 'bg-[#FF5733] text-white shadow-sm'
                      : isDark ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  External Guests
                </button>
              </div>

              {attendeesLoading ? (
                <div className="py-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF5733]" />
                  <p className="text-xs font-semibold">Loading attendee list...</p>
                </div>
              ) : attendeesError ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-rose-300 text-xs">
                  <span>Failed to load attendee registrations.</span>
                  <button
                    onClick={() => refetchAttendees()}
                    className="underline font-bold"
                  >
                    Retry
                  </button>
                </div>
              ) : !attendeesData?.registrations || attendeesData.registrations.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  {participantTypeFilter === 'ALL'
                    ? 'No attendees have registered for this event yet.'
                    : `No ${participantTypeFilter.toLowerCase()} attendees found.`}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr
                          className={`border-b text-[10px] font-black uppercase tracking-wider ${
                            isDark
                              ? 'border-white/10 text-slate-400'
                              : 'border-[#E8E6DF] text-[#64748B]'
                          }`}
                        >
                          <th className="py-3 px-4">Attendee</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Institution / Roll No</th>
                          <th className="py-3 px-4">Registered Date</th>
                          <th className="py-3 px-4">Payment & Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
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
                              className={`transition-colors ${
                                isDark
                                  ? 'hover:bg-white/5 text-slate-200'
                                  : 'hover:bg-slate-50 text-[#0F172A]'
                              }`}
                            >
                              <td className="py-3 px-4 flex items-center gap-3">
                                {reg.user?.avatarUrl ? (
                                  <img
                                    src={reg.user.avatarUrl}
                                    alt={displayName}
                                    className="w-8 h-8 rounded-full object-cover border border-white/10"
                                  />
                                ) : (
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                      isExternal ? 'bg-orange-500 text-white' : 'bg-[#FF5733] text-white'
                                    }`}
                                  >
                                    {displayInitials}
                                  </div>
                                )}
                                <span className="font-bold">{displayName}</span>
                              </td>
                              <td className="py-3 px-4">
                                {isExternal ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                    External Guest
                                  </span>
                                ) : isCross ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                    Cross-College
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Student
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-400">{displayEmail}</td>
                              <td className="py-3 px-4 text-slate-400">{institutionOrRoll}</td>
                              <td className="py-3 px-4 text-slate-400">
                                {formatRegisteredDate(reg.registeredAt)}
                              </td>
                              <td className="py-3 px-4">
                                {reg.isUserDeleted ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                    User Deleted (Snapshot)
                                  </span>
                                ) : reg.paymentTransaction ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                        Paid ₹{Number(reg.paymentTransaction.amount) || 0}
                                      </span>
                                      {reg.paymentTransaction.status === 'REFUNDED' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/20 text-blue-400">
                                          Refunded
                                        </span>
                                      )}
                                    </div>
                                    {typeof reg.paymentTransaction.id === 'string' && (
                                      <div className="text-[9px] font-mono text-slate-400 truncate max-w-[120px]" title={reg.paymentTransaction.id}>
                                        Txn: {reg.paymentTransaction.id.slice(0, 8)}...
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
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
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-xs text-slate-400">
                        Page {attendeePage} of {attendeesData.totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={attendeePage <= 1}
                          onClick={() => setAttendeePage((p) => Math.max(1, p - 1))}
                          className="p-2 rounded-xl border border-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={attendeePage >= (attendeesData.totalPages || 1)}
                          onClick={() => setAttendeePage((p) => p + 1)}
                          className="p-2 rounded-xl border border-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
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
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Are you sure you want to cancel &quot;{event?.title}&quot;? The event status will change to CANCELLED on public listings.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={cancelEventMutation.isPending}
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition cursor-pointer"
              >
                No, Keep Event
              </button>
              <button
                type="button"
                disabled={cancelEventMutation.isPending}
                onClick={handleCancelEvent}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
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
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-200 mb-1">
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteEventMutation.isPending}
                onClick={handleDeleteEvent}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
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
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  visibility === 'PUBLIC' ? 'text-emerald-400' : 'text-amber-400'
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateEventMutation.isPending}
                onClick={doSaveEvent}
                className={`inline-flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer ${
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
