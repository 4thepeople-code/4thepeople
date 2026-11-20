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
import { useCollegeGatewayReadinessQuery } from '@/lib/api/payment';
import ManagerLayout from '@/components/manager/ManagerLayout';
import { ClubHeader } from '@/components/manager/ClubHeader';
import { Modal } from '@/components/common/Modal';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import type { Event as ModelEvent, EventVisibility } from '@/types/models';
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
  Globe,
  CreditCard,
  IndianRupee,
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
  const { data: gatewayReadiness } = useCollegeGatewayReadinessQuery(slug);

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
  const [eventVisibility, setEventVisibility] = useState<EventVisibility>('COLLEGE');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [fee, setFee] = useState<string>('');
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

    if (isPaid) {
      if (gatewayReadiness && !gatewayReadiness.isReady) {
        setEventError(
          'Cannot create paid event: Payment gateway is not configured or active for this college. Please contact the Super Admin.'
        );
        return;
      }
      const numericFee = parseInt(fee, 10);
      if (!fee || isNaN(numericFee) || numericFee <= 0) {
        setEventError('Paid events require a valid positive fee in INR (e.g. ₹100).');
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
          visibility: eventVisibility,
          isPaid,
          fee: isPaid ? parseInt(fee, 10) : 0,
          currency: 'INR',
        },
      });

      setIsCreateEventModalOpen(false);
      setEventTitle('');
      setEventDesc('');
      setEventLocation('');
      setEventStartAt('');
      setEventEndAt('');
      setEventUrl('');
      setEventVisibility('COLLEGE');
      setIsPaid(false);
      setFee('');
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
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--primary)]" />
            <span>Back to My Clubs</span>
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 animate-dashboard-skeleton space-y-4">
            <div className="h-8 bg-[var(--line)]/50 rounded-xl w-1/3" />
            <div className="h-4 bg-[var(--line)]/30 rounded-xl w-2/3" />
          </div>
        ) : isError || !club ? (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center max-w-xl mx-auto space-y-5 my-8 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold uppercase text-rose-500">
                {errorStatus === 403
                  ? 'Access Restricted'
                  : errorStatus === 404
                  ? 'Club Not Found'
                  : 'Unable to Load Club'}
              </h2>
              <p className="text-xs font-medium leading-relaxed text-[var(--ink-soft)]">
                {clubErrorMessage}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href={getPath('/manager/clubs')}
                className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to My Clubs</span>
              </Link>
              {errorStatus !== 403 && errorStatus !== 404 && (
                <button
                  onClick={() => refetchClub()}
                  className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--primary-soft)]/60 text-[var(--ink)] transition-colors cursor-pointer"
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
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--primary-soft)]/60 transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit3 className="h-4 w-4 text-[var(--primary)]" />
                    <span>{isEditingInfo ? 'Cancel Edit' : 'Edit Info'}</span>
                  </button>
                  <button
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer px-5 py-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Event</span>
                  </button>
                </div>
              </ClubHeader>

              {/* Club Images & Branding Controls */}
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
                <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                      Club Media & Branding
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)]">
                      Manage high-res cover photos and official square avatar
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Cover Image Upload Options */}
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-5 space-y-4">
                    <div>
                      <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                        <span>Club Cover Banner</span>
                      </h3>
                      <p className="text-xs text-[var(--ink-soft)] font-medium mt-1 leading-relaxed">
                        Upload a wide 16:9 or panoramic banner to display at the top of your club and event headers.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <label className="cursor-pointer inline-flex min-h-10 items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
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
                          className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-5 space-y-4">
                    <div>
                      <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--primary)]" />
                        <span>Club Square Logo</span>
                      </h3>
                      <p className="text-xs text-[var(--ink-soft)] font-medium mt-1 leading-relaxed">
                        Upload a 1:1 square club insignia or seal to represent the club across campus event badges.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <label className="cursor-pointer inline-flex min-h-10 items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
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
                          className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
                    className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-5 space-y-4"
                  >
                    <h3 className="font-display text-sm font-bold text-[var(--ink)]">
                      Edit Club Information
                    </h3>

                    {clubFormError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{clubFormError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                        Club Name *
                      </label>
                      <input
                        ref={clubNameInputRef}
                        type="text"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={clubDescription}
                        onChange={(e) => setClubDescription(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] resize-none transition-all"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateClubMutation.isPending}
                        className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {updateClubMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Members Section */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
                      Club Members
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)]">
                      Managers and members assigned to this club
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)]">
                  {club.members?.length || 0} Member
                  {(club.members?.length || 0) === 1 ? '' : 's'}
                </span>
              </div>

              {!club.members || club.members.length === 0 ? (
                <div className="py-8 text-center text-xs font-medium text-[var(--ink-soft)]">
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
                        className="p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs border border-[var(--line)] bg-[var(--bg)]/50 hover:border-[var(--primary)]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-display font-bold text-sm shrink-0 shadow-xs">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--ink)] truncate">
                              {name}
                            </p>
                            <p className="text-[11px] text-[var(--ink-soft)] font-medium truncate">
                              {email}
                            </p>
                          </div>
                        </div>

                        {isManager ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20 tracking-wider uppercase">
                            <ShieldCheck className="w-3 h-3" />
                            MANAGER
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]">
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
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
                      Club Events
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)]">
                      Manage schedules, locations, and attendance for this club
                    </p>
                  </div>
                </div>

                {/* Status Filter Tabs */}
                <div
                  role="tablist"
                  aria-label="Filter events by status"
                  className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xs"
                >
                  {[
                    { key: 'ALL' as const, label: 'All', count: events.length },
                    { key: 'UPCOMING_ONGOING' as const, label: 'Upcoming', count: upcomingOngoingCount },
                    { key: 'COMPLETED' as const, label: 'Completed', count: completedCount },
                    { key: 'CANCELLED' as const, label: 'Cancelled', count: cancelledCount },
                  ].map((tab) => {
                    const isActive = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                            : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--line)]/50 text-[var(--ink-soft)]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Loading Skeleton */}
              {eventsLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-64 animate-dashboard-skeleton rounded-3xl border border-[var(--line)] bg-[var(--surface)]"
                    />
                  ))}
                </div>
              )}

              {/* Error Message */}
              {isEventsError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-sm">
                  <span>Failed to load club events.</span>
                  <button
                    onClick={() => refetchEvents()}
                    className="underline text-xs font-bold hover:opacity-80 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!eventsLoading && !isEventsError && filteredEvents.length === 0 && (
                <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center">
                  <Calendar className="mx-auto mb-4 h-10 w-10 text-[var(--ink-soft)]/50" />
                  <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                    {statusFilter === 'ALL'
                      ? 'No Events Created Yet'
                      : `No ${statusFilter.replace('_', ' ').toLowerCase()} events`}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">
                    Create an event for this club to start sharing schedules, locations, and photo galleries.
                  </p>
                  <button
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
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
                      className="group flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div>
                        <div className="relative h-44 w-full overflow-hidden border-b border-[var(--line)] bg-[var(--bg)]">
                          {evt.coverImage?.url ? (
                            <img
                              src={evt.coverImage.url}
                              alt={evt.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4">
                              <Sparkles className="w-8 h-8 text-[var(--primary)]/40" />
                            </div>
                          )}

                          {/* Event Visibility Badge */}
                          <div className="absolute top-3 left-3">
                            {evt.visibility === 'PUBLIC' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 backdrop-blur-md shadow-xs">
                                <Globe className="w-3 h-3" />
                                <span>Public Event</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-[var(--line)] bg-[var(--surface)]/90 text-[var(--ink)] backdrop-blur-md shadow-xs">
                                <Building2 className="w-3 h-3" />
                                <span>College Only</span>
                              </span>
                            )}
                          </div>

                          {/* Event Status Badge */}
                          <div className="absolute top-3 right-3">
                            {evt.status === 'ONGOING' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300 backdrop-blur-md shadow-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live now
                              </span>
                            ) : evt.status === 'COMPLETED' ? (
                              <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)] backdrop-blur-md shadow-xs">
                                Completed
                              </span>
                            ) : evt.status === 'CANCELLED' ? (
                              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-300 backdrop-blur-md shadow-xs">
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] backdrop-blur-md shadow-xs">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-5 space-y-3">
                          <h3 className="font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                            {evt.title}
                          </h3>
                          <p className="text-xs text-[var(--ink-soft)] font-medium line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        </div>
                      </div>

                      <div className="p-5 pt-0 border-t border-[var(--line)] mt-3 space-y-1.5 text-xs text-[var(--ink-soft)] font-semibold">
                        <div className="flex items-center gap-2 pt-3">
                          <Calendar className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                          <span>
                            {formatDate(evt.startAt)} • {formatTime(evt.startAt)}
                          </span>
                        </div>
                        {evt.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                            <span className="truncate">{evt.location}</span>
                          </div>
                        )}
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
          <form onSubmit={handleCreateEvent} className="space-y-5">
            {eventError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{eventError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Annual Tech Symposium"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                  Location / Venue *
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Main Auditorium / Lab 3"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Registration URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="e.g. https://forms.google.com/..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                  Description *
                </label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Provide event details, schedule, agenda..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder-[var(--ink-soft)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] resize-none transition-all"
                  required
                />
              </div>

              {/* Event Visibility Selector */}
              <div className="md:col-span-2 pt-2 border-t border-[var(--line)]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                  Event Visibility *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: College Only */}
                  <div
                    onClick={() => setEventVisibility('COLLEGE')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      eventVisibility === 'COLLEGE'
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--primary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Building2
                          className={`w-4 h-4 ${
                            eventVisibility === 'COLLEGE'
                              ? 'text-[var(--primary)]'
                              : 'text-[var(--ink-soft)]'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            eventVisibility === 'COLLEGE'
                              ? 'text-[var(--ink)]'
                              : 'text-[var(--ink-soft)]'
                          }`}
                        >
                          College Only
                        </span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          eventVisibility === 'COLLEGE'
                            ? 'border-[var(--primary)]'
                            : 'border-[var(--line)]'
                        }`}
                      >
                        {eventVisibility === 'COLLEGE' && (
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Only students belonging to this college can register. External guest and cross-college registrations are unavailable.
                    </p>
                  </div>

                  {/* Option 2: Public Event */}
                  <div
                    onClick={() => setEventVisibility('PUBLIC')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      eventVisibility === 'PUBLIC'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Globe
                          className={`w-4 h-4 ${
                            eventVisibility === 'PUBLIC'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-[var(--ink-soft)]'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            eventVisibility === 'PUBLIC'
                              ? 'text-[var(--ink)]'
                              : 'text-[var(--ink-soft)]'
                          }`}
                        >
                          Public Event
                        </span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          eventVisibility === 'PUBLIC'
                            ? 'border-emerald-500'
                            : 'border-[var(--line)]'
                        }`}
                      >
                        {eventVisibility === 'PUBLIC' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Students from other colleges and external participants (via email OTP) can discover and register.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Settings (Free vs Paid) */}
              <div className="md:col-span-2 pt-2 border-t border-[var(--line)]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                  Event Fee & Pricing *
                </label>

                {/* Gateway Unready Advisory */}
                {gatewayReadiness && !gatewayReadiness.isReady && (
                  <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-bold">Payment Gateway Not Configured</p>
                      <p className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                        This college does not have an active payment gateway configured. Only free events can currently be published. Contact the Super Admin to configure Razorpay or Cashfree.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {/* Free Event */}
                  <div
                    onClick={() => {
                      setIsPaid(false);
                      setFee('');
                    }}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      !isPaid
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--primary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            !isPaid ? 'text-[var(--primary)]' : 'text-[var(--ink-soft)]'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            !isPaid ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                          }`}
                        >
                          Free Event
                        </span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          !isPaid ? 'border-[var(--primary)]' : 'border-[var(--line)]'
                        }`}
                      >
                        {!isPaid && (
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Zero fee. Eligible participants RSVP directly with instant registration.
                    </p>
                  </div>

                  {/* Paid Event */}
                  <div
                    onClick={() => {
                      if (gatewayReadiness && !gatewayReadiness.isReady) {
                        setEventError(
                          'Payment gateway is not active for this college. Only free events can be published.'
                        );
                        return;
                      }
                      setIsPaid(true);
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      gatewayReadiness && !gatewayReadiness.isReady
                        ? 'opacity-60 cursor-not-allowed border-[var(--line)] bg-[var(--bg)]'
                        : isPaid
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] cursor-pointer'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--primary)]/40 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <CreditCard
                          className={`w-4 h-4 ${
                            isPaid ? 'text-[var(--primary)]' : 'text-[var(--ink-soft)]'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isPaid ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                          }`}
                        >
                          Paid Event
                        </span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isPaid ? 'border-[var(--primary)]' : 'border-[var(--line)]'
                        }`}
                      >
                        {isPaid && (
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Requires online payment checkout via college gateway (Razorpay / Cashfree) before registration confirmation.
                    </p>
                  </div>
                </div>

                {/* Paid Fee Input Field */}
                {isPaid && (
                  <div className="p-3.5 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 space-y-2 animate-in fade-in">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      Registration Fee (INR) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ink-soft)]">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        placeholder="e.g. 150"
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] font-mono font-bold"
                        required={isPaid}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      Amount in Indian Rupees (₹). Online payments will only process if Super Admin has activated a gateway for this institution.
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 pt-2 border-t border-[var(--line)] grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--line)]">
              <button
                type="button"
                disabled={createEventMutation.isPending}
                onClick={() => setIsCreateEventModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-colors border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEventMutation.isPending}
                className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
