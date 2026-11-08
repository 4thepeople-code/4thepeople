'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import {
  useClubDashboardQuery,
  useManagedClubEventsQuery,
  useUpdateManagedClubMutation,
  useCreateClubEventMutation,
  uploadClubLogo,
  deleteClubLogo,
  uploadClubCover,
  deleteClubCover,
} from '@/lib/api/manager';
import ManagerLayout from '@/components/manager/ManagerLayout';
import { ClubHeader } from '@/components/manager/ClubHeader';
import { Modal } from '@/components/common/Modal';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import type { Event as ModelEvent } from '@/types/models';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Plus,
  Upload,
  Trash2,
  MapPin,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Edit3,
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

export interface ManagerClubDetailClientProps {
  slug: string;
  clubId: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export function ManagerClubDetailClient({ slug, clubId }: ManagerClubDetailClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  // Queries
  const {
    data: club,
    isLoading: loading,
    isError,
    error: clubErrorObj,
    refetch: refetchClub,
  } = useClubDashboardQuery(slug, clubId);

  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: isEventsError,
    refetch: refetchEvents,
  } = useManagedClubEventsQuery(slug, clubId);

  // Mutations
  const updateClubMutation = useUpdateManagedClubMutation(slug);
  const createEventMutation = useCreateClubEventMutation(slug);

  // Editable Club Info form state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubFormError, setClubFormError] = useState('');

  const editFormRef = useRef<HTMLFormElement | null>(null);
  const clubNameInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleEditInfo = () => {
    if (!isEditingInfo) {
      setClubName(club?.name || '');
      setClubDescription(club?.description || '');
      setIsEditingInfo(true);
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        clubNameInputRef.current?.focus();
      }, 60);
    } else {
      setIsEditingInfo(false);
    }
  };

  // Media state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDeleting, setCoverDeleting] = useState(false);

  // Events list filter
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING_ONGOING' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Create Event Modal state
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [eventError, setEventError] = useState('');

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

  // Handle Edit Club Details
  const handleUpdateClubInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setClubFormError('');

    if (!clubName.trim()) {
      setClubFormError('Club name cannot be empty.');
      return;
    }

    try {
      await updateClubMutation.mutateAsync({
        clubId,
        data: {
          name: clubName.trim(),
          description: clubDescription.trim() || undefined,
        },
      });
      showToast('Club information updated successfully!');
      setIsEditingInfo(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update club info.';
      setClubFormError(message);
    }
  };

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      setLogoUploading(true);
      await uploadClubLogo(clubId, formData);
      showToast('Club logo uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload logo.';
      showToast(message, true);
    } finally {
      setLogoUploading(false);
    }
  };

  // Handle Logo Remove
  const handleLogoDelete = async () => {
    if (!window.confirm('Are you sure you want to remove the club logo?')) return;

    try {
      setLogoDeleting(true);
      await deleteClubLogo(clubId);
      showToast('Club logo removed.');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove logo.';
      showToast(message, true);
    } finally {
      setLogoDeleting(false);
    }
  };

  // Handle Cover Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cover', file);

    try {
      setCoverUploading(true);
      await uploadClubCover(clubId, formData);
      showToast('Club cover image uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload cover image.';
      showToast(message, true);
    } finally {
      setCoverUploading(false);
    }
  };

  // Handle Cover Remove
  const handleCoverDelete = async () => {
    if (!window.confirm('Are you sure you want to remove the club cover image?')) return;

    try {
      setCoverDeleting(true);
      await deleteClubCover(clubId);
      showToast('Club cover image removed.');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove cover image.';
      showToast(message, true);
    } finally {
      setCoverDeleting(false);
    }
  };

  // Handle Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventError('');

    if (!eventTitle.trim() || !eventDesc.trim() || !eventLocation.trim() || !eventStartAt) {
      setEventError('Title, description, location, and start date are required.');
      return;
    }

    const start = new Date(eventStartAt);
    if (isNaN(start.getTime())) {
      setEventError('Start date/time is invalid.');
      return;
    }

    if (eventEndAt) {
      const end = new Date(eventEndAt);
      if (isNaN(end.getTime())) {
        setEventError('End date/time is invalid.');
        return;
      }
      if (end <= start) {
        setEventError('End date/time must be after the start date/time.');
        return;
      }
    }

    try {
      await createEventMutation.mutateAsync({
        clubId,
        data: {
          title: eventTitle.trim(),
          description: eventDesc.trim(),
          location: eventLocation.trim(),
          registrationUrl: eventUrl.trim() || undefined,
          startAt: new Date(eventStartAt).toISOString(),
          endAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
        },
      });

      setIsCreateEventModalOpen(false);
      setEventTitle('');
      setEventDesc('');
      setEventLocation('');
      setEventStartAt('');
      setEventEndAt('');
      setEventUrl('');
      showToast('Event created successfully!');
      void refetchEvents();
      void refetchClub();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create event.';
      setEventError(message);
    }
  };

  // Event counts
  const upcomingOngoingCount = events.filter(
    (e) => e.status === 'UPCOMING' || e.status === 'ONGOING'
  ).length;
  const completedCount = events.filter((e) => e.status === 'COMPLETED').length;
  const cancelledCount = events.filter((e) => e.status === 'CANCELLED').length;

  const filteredEvents = events.filter((evt) => {
    if (statusFilter === 'UPCOMING_ONGOING') {
      return evt.status === 'UPCOMING' || evt.status === 'ONGOING';
    }
    if (statusFilter === 'COMPLETED') {
      return evt.status === 'COMPLETED';
    }
    if (statusFilter === 'CANCELLED') {
      return evt.status === 'CANCELLED';
    }
    return true;
  });

  const rawClubError = clubErrorObj as { response?: { status?: number; data?: { message?: string } } };
  const errorStatus = rawClubError?.response?.status;
  const clubErrorMessage =
    rawClubError?.response?.data?.message ||
    (errorStatus === 403
      ? 'You do not have permission to manage this club.'
      : errorStatus === 404
      ? 'Club not found.'
      : 'Failed to load club details.');

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
            href={getPath('/manager/clubs')}
            className={`inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-full border transition-all shadow-xs ${
              isDark
                ? 'bg-[#12141C] border-white/10 text-white hover:border-[#FF5733] hover:text-[#FF5733]'
                : 'bg-white border-[#E2E0D5] text-[#0F172A] hover:border-[#FF5733] hover:text-[#FF5733]'
            }`}
          >
            <ArrowLeft className="w-4 h-4 text-[#FF5733]" />
            <span>Back to My Clubs</span>
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
        ) : isError || !club ? (
          <div
            className={`rounded-3xl p-10 text-center max-w-xl mx-auto space-y-5 my-8 shadow-sm border ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-['Syne',sans-serif] text-xl font-black uppercase text-rose-500">
                {errorStatus === 403
                  ? 'Access Restricted'
                  : errorStatus === 404
                  ? 'Club Not Found'
                  : 'Unable to Load Club'}
              </h2>
              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                {clubErrorMessage}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href={getPath('/manager/clubs')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to My Clubs</span>
              </Link>
              {errorStatus !== 403 && errorStatus !== 404 && (
                <button
                  onClick={() => refetchClub()}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 font-extrabold text-xs uppercase tracking-wider rounded-full border transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                      : 'bg-[#FAF9F5] hover:bg-[#F0EEE6] text-[#0F172A] border-[#E2E0D5]'
                  }`}
                >
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Club Header Banner */}
            <div className="space-y-6">
              <ClubHeader club={club} isDark={isDark}>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleToggleEditInfo}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-full border transition cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                        : 'bg-[#FAF9F5] hover:bg-[#F0EEE6] text-[#0F172A] border-[#E2E0D5]'
                    }`}
                  >
                    <Edit3 className="w-4 h-4 text-[#FF5733]" />
                    <span>{isEditingInfo ? 'Cancel Edit' : 'Edit Info'}</span>
                  </button>
                  <button
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#FF5733] hover:bg-[#E64A26] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md shadow-[#FF5733]/25 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Event</span>
                  </button>
                </div>
              </ClubHeader>

              {/* Club Images & Branding Controls */}
              <div
                className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                  isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
                }`}
              >
                <h2
                  className={`font-['Syne',sans-serif] text-lg font-black uppercase tracking-tight flex items-center gap-2 border-b pb-3 ${
                    isDark
                      ? 'text-white border-white/10'
                      : 'text-[#0F172A] border-[#E8E6DF]'
                  }`}
                >
                  <ImageIcon className="w-5 h-5 text-[#FF5733]" />
                  <span>Club Media & Branding</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Cover Image Upload Options */}
                  <div
                    className={`p-5 rounded-2xl border space-y-4 ${
                      isDark ? 'bg-[#151D2A] border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                    }`}
                  >
                    <div>
                      <h3
                        className={`text-xs font-black uppercase flex items-center gap-2 ${
                          isDark ? 'text-white' : 'text-[#0F172A]'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-[#FF5733]" />
                        <span>Club Cover Image</span>
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                        Upload a high-resolution cover image to display full-bleed at the top of your club page.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition">
                        {coverUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>
                          {club.coverImageUrl || club.coverUrl
                            ? 'Replace Cover Image'
                            : 'Upload Cover Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          disabled={coverUploading || coverDeleting}
                          className="hidden"
                        />
                      </label>

                      {(club.coverImageUrl || club.coverUrl) && (
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
                          <span>Remove Cover</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Logo Upload Options */}
                  <div
                    className={`p-5 rounded-2xl border space-y-4 ${
                      isDark ? 'bg-[#151D2A] border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                    }`}
                  >
                    <div>
                      <h3
                        className={`text-xs font-black uppercase flex items-center gap-2 ${
                          isDark ? 'text-white' : 'text-[#0F172A]'
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-[#2563EB]" />
                        <span>Club Square Logo</span>
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                        Upload a square logo image to represent your club avatar across event pages.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition">
                        {logoUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{club.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={logoUploading || logoDeleting}
                          className="hidden"
                        />
                      </label>

                      {club.logoUrl && (
                        <button
                          onClick={handleLogoDelete}
                          disabled={logoUploading || logoDeleting}
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer"
                        >
                          {logoDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span>Remove Logo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Edit Info Form */}
                {isEditingInfo && (
                  <form
                    ref={editFormRef}
                    onSubmit={handleUpdateClubInfo}
                    className={`scroll-mt-24 p-5 rounded-2xl border space-y-4 ${
                      isDark ? 'bg-[#151D2A] border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                    }`}
                  >
                    <h3
                      className={`font-['Syne',sans-serif] text-base font-black uppercase ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      Edit Club Information
                    </h3>

                    {clubFormError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{clubFormError}</span>
                      </div>
                    )}

                    <div>
                      <label
                        className={`block text-xs font-extrabold uppercase mb-1 ${
                          isDark ? 'text-slate-300' : 'text-[#0F172A]'
                        }`}
                      >
                        Club Name *
                      </label>
                      <input
                        ref={clubNameInputRef}
                        type="text"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-white border-[#E2E0D5] text-[#0F172A]'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label
                        className={`block text-xs font-extrabold uppercase mb-1 ${
                          isDark ? 'text-slate-300' : 'text-[#0F172A]'
                        }`}
                      >
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={clubDescription}
                        onChange={(e) => setClubDescription(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] resize-none border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-white border-[#E2E0D5] text-[#0F172A]'
                        }`}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-full border transition ${
                          isDark
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            : 'bg-white border-[#E2E0D5] text-[#0F172A] hover:bg-[#F0EEE6]'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateClubMutation.isPending}
                        className="px-5 py-2 bg-[#FF5733] hover:bg-[#E64A26] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md disabled:opacity-50 transition cursor-pointer"
                      >
                        {updateClubMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Members Section */}
            <div
              className={`rounded-3xl p-6 lg:p-8 space-y-6 shadow-sm border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#FF5733]/10 text-[#FF5733] rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2
                      className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      Club Members
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Managers and members assigned to this club
                    </p>
                  </div>
                </div>
                <span
                  className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    isDark
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-[#FAF9F5] text-[#0F172A] border-[#E2E0D5]'
                  }`}
                >
                  {club.members?.length || 0} Member
                  {(club.members?.length || 0) === 1 ? '' : 's'}
                </span>
              </div>

              {!club.members || club.members.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No members found for this club.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {club.members.map((member) => {
                    const name = member.user?.name || 'Anonymous User';
                    const email = member.user?.email || 'No email provided';
                    const role = member.role || member.user?.role || 'MEMBER';
                    const isManager = role === 'MANAGER' || role === 'ADMIN';

                    return (
                      <div
                        key={member.id || email}
                        className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs border ${
                          isDark
                            ? 'bg-[#151D2A] border-white/10'
                            : 'bg-[#FAF9F5] border-[#E2E0D5]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#FF5733] flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-sm shrink-0 shadow-xs">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-extrabold truncate ${
                                isDark ? 'text-white' : 'text-[#0F172A]'
                              }`}
                            >
                              {name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {email}
                            </p>
                          </div>
                        </div>

                        {isManager ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-full bg-[#2563EB]/10 text-[#2563EB] tracking-wider uppercase">
                            <ShieldCheck className="w-3 h-3" />
                            MANAGER
                          </span>
                        ) : (
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                              isDark
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-white text-[#64748B] border-[#E2E0D5]'
                            }`}
                          >
                            <UserCheck className="w-3 h-3" />
                            MEMBER
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Events Section */}
            <div className="space-y-6">
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#2563EB]/10 text-[#2563EB] rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2
                      className={`font-['Syne',sans-serif] text-2xl font-black uppercase tracking-tight ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      Club Events
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      All upcoming, completed, and cancelled club events
                    </p>
                  </div>
                </div>

                {/* Status Filter Tabs */}
                <div
                  className={`flex items-center gap-1.5 p-1 rounded-full border overflow-x-auto ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      statusFilter === 'ALL'
                        ? isDark
                          ? 'bg-[#FF5733] text-white'
                          : 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({events.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('UPCOMING_ONGOING')}
                    className={`px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      statusFilter === 'UPCOMING_ONGOING'
                        ? isDark
                          ? 'bg-[#FF5733] text-white'
                          : 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Upcoming ({upcomingOngoingCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('COMPLETED')}
                    className={`px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      statusFilter === 'COMPLETED'
                        ? isDark
                          ? 'bg-[#FF5733] text-white'
                          : 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Completed ({completedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('CANCELLED')}
                    className={`px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      statusFilter === 'CANCELLED'
                        ? isDark
                          ? 'bg-[#FF5733] text-white'
                          : 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cancelled ({cancelledCount})
                  </button>
                </div>
              </div>

              {/* Loading Skeleton */}
              {eventsLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-64 rounded-3xl animate-pulse border ${
                        isDark ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Error Message */}
              {isEventsError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-rose-300 text-sm">
                  <span>Failed to load club events.</span>
                  <button
                    onClick={() => refetchEvents()}
                    className="underline text-xs font-bold hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!eventsLoading && !isEventsError && filteredEvents.length === 0 && (
                <div
                  className={`p-10 text-center rounded-3xl border ${
                    isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
                  }`}
                >
                  <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3
                    className={`font-['Syne',sans-serif] text-base font-black uppercase ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {statusFilter === 'ALL'
                      ? 'No Events Created Yet'
                      : `No ${statusFilter.replace('_', ' ').toLowerCase()} events`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Create an event for this club to start sharing schedules, locations, and photo galleries.
                  </p>
                  <button
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-[#FF5733] hover:bg-[#E64A26] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Event</span>
                  </button>
                </div>
              )}

              {/* Events Grid */}
              {!eventsLoading && !isEventsError && filteredEvents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((evt: ModelEvent) => (
                    <div
                      key={evt.id}
                      onClick={() =>
                        router.push(getPath(`/manager/clubs/${clubId}/events/${evt.id}`))
                      }
                      className={`group rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer border ${
                        isDark
                          ? 'bg-[#12141C] border-white/10 hover:border-[#FF5733]'
                          : 'bg-white border-[#E2E0D5] hover:border-[#FF5733]'
                      }`}
                    >
                      <div
                        className={`relative h-44 w-full overflow-hidden border-b ${
                          isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E8E6DF]'
                        }`}
                      >
                        {evt.coverImage?.url ? (
                          <img
                            src={evt.coverImage.url}
                            alt={evt.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-4">
                            <Sparkles className="w-8 h-8 text-[#FF5733]/40" />
                          </div>
                        )}

                        {/* Event Status Badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border shadow-sm ${
                              evt.status === 'ONGOING'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : evt.status === 'COMPLETED'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                : evt.status === 'CANCELLED'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                : 'bg-[#FF5733] text-white border-[#FF5733]'
                            }`}
                          >
                            {evt.status || 'UPCOMING'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h3
                            className={`font-['Syne',sans-serif] text-base font-black group-hover:text-[#FF5733] transition line-clamp-1 ${
                              isDark ? 'text-white' : 'text-[#0F172A]'
                            }`}
                          >
                            {evt.title}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        </div>

                        <div
                          className={`pt-3 border-t space-y-1.5 text-xs text-slate-400 font-semibold ${
                            isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#FF5733] shrink-0" />
                            <span>
                              {formatDate(evt.startAt)} • {formatTime(evt.startAt)}
                            </span>
                          </div>
                          {evt.location && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                              <span className="truncate">{evt.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Create New Event */}
        <Modal
          isOpen={isCreateEventModalOpen}
          onClose={() => !createEventMutation.isPending && setIsCreateEventModalOpen(false)}
          title="Create New Event"
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleCreateEvent} className="space-y-4">
            {eventError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{eventError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Event Title *
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Annual Tech Symposium"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
                  }`}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Location / Venue *
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Main Auditorium / Lab 3"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
                  }`}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  <span>Registration URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="e.g. https://forms.google.com/..."
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Description *
                </label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Provide event details, schedule, agenda..."
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors resize-none ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-2 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                <DateTimePicker
                  label="Start Date & Time"
                  value={eventStartAt}
                  onChange={setEventStartAt}
                  required
                />

                <DateTimePicker
                  label="End Date & Time (Optional)"
                  value={eventEndAt}
                  onChange={setEventEndAt}
                  min={eventStartAt}
                />
              </div>
            </div>

            <div
              className={`pt-4 flex items-center justify-end gap-3 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                disabled={createEventMutation.isPending}
                onClick={() => setIsCreateEventModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition border cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEventMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {createEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Create Event</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </ManagerLayout>
  );
}

export default ManagerClubDetailClient;
