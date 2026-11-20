'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { useCreateClubEventMutation } from '@/lib/api/manager';
import { useCollegeGatewayReadinessQuery } from '@/lib/api/payment';
import ManagerLayout from '@/components/manager/ManagerLayout';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import type { EventVisibility } from '@/types/models';
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  MapPin,
  FileText,
  Globe,
  Building2,
  Users,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react';

export interface CreateEventClientProps {
  slug: string;
  clubId: string;
}

export function CreateEventClient({ slug, clubId }: CreateEventClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // API Mutations & Queries
  const createEventMutation = useCreateClubEventMutation(slug);
  const { data: gatewayReadiness } = useCollegeGatewayReadinessQuery(slug);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [capacity, setCapacity] = useState<string>('');
  const [visibility, setVisibility] = useState<EventVisibility>('COLLEGE');
  const [isPaid, setIsPaid] = useState(false);
  const [fee, setFee] = useState<string>('');
  const [currency, setCurrency] = useState('INR');

  // UI Feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('Event title is required.');
      return;
    }

    if (!location.trim()) {
      setFormError('Event location or venue is required.');
      return;
    }

    if (!description.trim()) {
      setFormError('Event description is required.');
      return;
    }

    if (!startAt) {
      setFormError('Start date and time are required.');
      return;
    }

    const startDate = new Date(startAt);
    if (isNaN(startDate.getTime())) {
      setFormError('Start date and time are invalid.');
      return;
    }

    let endDate: Date | null = null;
    if (endAt) {
      endDate = new Date(endAt);
      if (isNaN(endDate.getTime())) {
        setFormError('End date and time are invalid.');
        return;
      }
      if (endDate <= startDate) {
        setFormError('End date/time must be strictly after the start date/time.');
        return;
      }
    }

    let parsedCapacity: number | null = null;
    if (capacity.trim()) {
      const capNum = parseInt(capacity, 10);
      if (isNaN(capNum) || capNum <= 0) {
        setFormError('Capacity must be a positive number.');
        return;
      }
      parsedCapacity = capNum;
    }

    let parsedFee = 0;
    if (isPaid) {
      const feeNum = parseFloat(fee);
      if (isNaN(feeNum) || feeNum <= 0) {
        setFormError('Please enter a valid ticket fee for paid events.');
        return;
      }
      if (gatewayReadiness && !gatewayReadiness.isReady) {
        setFormError(
          'Cannot create paid event: Payment gateway is not configured or active for this college. Please contact the College Administrator.'
        );
        return;
      }
      parsedFee = feeNum;
    }

    try {
      const created = await createEventMutation.mutateAsync({
        clubId,
        data: {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          registrationUrl: registrationUrl.trim() || undefined,
          startAt: startDate.toISOString(),
          endAt: endDate ? endDate.toISOString() : null,
          visibility,
          capacity: parsedCapacity,
          isPaid,
          fee: isPaid ? parsedFee : 0,
          currency: isPaid ? currency : 'INR',
        },
      });

      setFormSuccess('Event created successfully!');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.all,
      });

      // Redirect back to club workspace
      setTimeout(() => {
        router.push(`/college/${slug}/manager/clubs/${clubId}`);
      }, 700);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to create event. Please check required fields.';
      setFormError(message);
    }
  };

  return (
    <ManagerLayout slug={slug}>
      <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in duration-300">
        {/* Navigation Breadcrumb / Back Link */}
        <div>
          <Link
            href={`/college/${slug}/manager/clubs/${clubId}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] hover:bg-[var(--primary-soft)]/60 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to club workspace</span>
          </Link>
        </div>

        {/* Page Header */}
        <header className="border-b border-[var(--line)] pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
              Event Manager Workspace
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
              {slug.toUpperCase()}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            Create a new <span className="italic font-bold text-[var(--primary)]">campus event</span>
          </h1>
          <p className="mt-1.5 text-xs text-[var(--ink-soft)] sm:text-sm leading-relaxed">
            Publish a new event for your club with timings, venue, description, and registration rules.
          </p>
        </header>

        {/* Global Feedback Banners */}
        {formSuccess && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <span>{formSuccess} Redirecting to club workspace...</span>
          </div>
        )}

        {formError && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Container Card */}
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs">
          <form id="create-event-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Event Title */}
              <div className="space-y-1.5 md:col-span-2">
                <label
                  htmlFor="create-event-title"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                >
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-event-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. HackSprint 2026, Acoustic Night, Robotics Workshop"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                />
                <p className="text-[11px] text-[var(--ink-soft)]">
                  Give the event a clear, distinctive name students will recognize.
                </p>
              </div>

              {/* Location / Venue */}
              <div className="space-y-1.5">
                <label
                  htmlFor="create-event-location"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                >
                  Location / Venue <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                  <input
                    id="create-event-location"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Main Auditorium · Gate 2"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-[var(--ink-soft)]">
                  Campus venue, seminar hall number, or ground location.
                </p>
              </div>

              {/* External Registration Link */}
              <div className="space-y-1.5">
                <label
                  htmlFor="create-event-registration-url"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                >
                  External Registration Link (Optional)
                </label>
                <input
                  id="create-event-registration-url"
                  type="url"
                  value={registrationUrl}
                  onChange={(e) => setRegistrationUrl(e.target.value)}
                  placeholder="https://forms.google.com/..."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                />
                <p className="text-[11px] text-[var(--ink-soft)]">
                  Optional external Google Form or ticketing link.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <label
                  htmlFor="create-event-description"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                >
                  Event Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="create-event-description"
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the event agenda, highlights, prizes, prerequisites, and instructions for participants..."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors resize-y"
                />
                <p className="text-[11px] text-[var(--ink-soft)]">
                  Briefly describe what attendees will experience, eligibility, and rules.
                </p>
              </div>

              {/* Start Date & Time */}
              <div className="space-y-1.5">
                <DateTimePicker
                  label="Start Date & Time"
                  value={startAt}
                  onChange={setStartAt}
                  required={true}
                />
              </div>

              {/* End Date & Time */}
              <div className="space-y-1.5">
                <DateTimePicker
                  label="End Date & Time (Optional)"
                  value={endAt}
                  onChange={setEndAt}
                  min={startAt}
                  required={false}
                />
              </div>

              {/* Event Visibility Cards */}
              <div className="space-y-2 md:col-span-2 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Event Visibility
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('COLLEGE')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === 'COLLEGE'
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]/40 ring-1 ring-[var(--primary)]'
                        : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${visibility === 'COLLEGE' ? 'text-[var(--primary)]' : 'text-[var(--ink-soft)]'}`} />
                      <span className="font-bold text-xs text-[var(--ink)]">College Only</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] mt-1">
                      Restricted to verified students of this campus.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('PUBLIC')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === 'PUBLIC'
                        ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${visibility === 'PUBLIC' ? 'text-emerald-500' : 'text-[var(--ink-soft)]'}`} />
                      <span className="font-bold text-xs text-[var(--ink)]">Public Event</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-soft)] mt-1">
                      Open to all guests and external college participants.
                    </p>
                  </button>
                </div>
              </div>

              {/* Capacity Limit */}
              <div className="space-y-1.5">
                <label
                  htmlFor="create-event-capacity"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                >
                  Capacity Limit (Optional)
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                  <input
                    id="create-event-capacity"
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g. 150 (Leave blank for unlimited)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-[var(--ink-soft)]">
                  Maximum number of attendees allowed to RSVP.
                </p>
              </div>

              {/* Paid / Ticketed Event Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Ticketing & Fee
                </label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]">
                  <input
                    type="checkbox"
                    id="create-event-is-paid"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <label htmlFor="create-event-is-paid" className="text-xs font-bold text-[var(--ink)] cursor-pointer">
                    This is a paid ticketed event
                  </label>
                </div>

                {isPaid && (
                  <div className="pt-2 space-y-1.5 animate-in fade-in duration-200">
                    <label
                      htmlFor="create-event-fee"
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                    >
                      Registration Fee (INR) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                      <input
                        id="create-event-fee"
                        type="number"
                        min="1"
                        step="1"
                        required={isPaid}
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        placeholder="e.g. 199"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs sm:text-sm font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                      />
                    </div>
                    {gatewayReadiness && !gatewayReadiness.isReady && (
                      <p className="text-[11px] text-amber-500 font-medium">
                        Payment gateway is not currently active for this college.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Form Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] pt-6">
              <Link
                href={`/college/${slug}/manager/clubs/${clubId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)] transition-colors cursor-pointer shadow-xs"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={createEventMutation.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-[var(--primary-strong)] shadow-md shadow-[var(--primary)]/20 disabled:opacity-50 cursor-pointer"
              >
                {createEventMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publishing event...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Create Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ManagerLayout>
  );
}

export default CreateEventClient;
