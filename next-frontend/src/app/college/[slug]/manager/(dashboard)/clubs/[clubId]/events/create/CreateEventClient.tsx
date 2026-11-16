'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Sparkles } from 'lucide-react';
import { useCreateClubEventMutation } from '@/lib/api/manager';
import { useToast } from '@/components/dashboard/ui/Toast';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { actions, eventManager, roleNames } from '@/lib/copy';

export interface CreateEventClientProps {
  slug: string;
  clubId: string;
}

/**
 * Event Manager create-event form for a single managed club. Form layout and
 * inputs are elevated to match the homepage typography, cards, and spacing.
 */
export default function CreateEventClient({ slug, clubId }: CreateEventClientProps) {
  const t = eventManager.events;
  const em = eventManager.dashboard;
  const { toast } = useToast();
  const router = useRouter();
  const createEventMutation = useCreateClubEventMutation(slug);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !location.trim() || !startAt) {
      setError('Title, description, location, and start date are required.');
      return;
    }

    const start = new Date(startAt);
    if (isNaN(start.getTime())) {
      setError('Start date/time is invalid.');
      return;
    }

    if (endAt) {
      const end = new Date(endAt);
      if (isNaN(end.getTime())) {
        setError('End date/time is invalid.');
        return;
      }
      if (end <= start) {
        setError('End date/time must be after the start date/time.');
        return;
      }
    }

    try {
      await createEventMutation.mutateAsync({
        clubId,
        data: {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          registrationUrl: registrationUrl.trim() || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
        },
      });

      toast(t.toastCreated, { variant: 'success' });
      router.push(`/college/${slug}/manager/clubs/${clubId}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t.errCreate,
      );
    }
  };

  const errText = error ? (
    <div role="alert" className="rounded-2xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] p-4 text-xs font-medium text-[var(--secondary)]">
      {error}
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Back link */}
      <div>
        <Link
          href={`/college/${slug}/manager/clubs/${clubId}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span>{t.back}</span>
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
            {roleNames.eventManager}
          </span>
          {slug && (
            <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
              {slug.toUpperCase()}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
          Create a new <span className="italic font-bold text-[var(--primary)]">campus event</span>
        </h1>
        <p className="mt-1.5 text-xs text-[var(--ink-soft)] sm:text-sm">
          {em.createEventHint}
        </p>
      </header>

      {/* Form Container */}
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
        <form id="create-event-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {errText}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Field label={t.formEventTitle} htmlFor="create-event-title" required hint="Give the event a clear, distinctive name students will recognize.">
                <Input
                  id="create-event-title"
                  type="text"
                  placeholder="e.g. HackSprint 2026, Acoustic Night"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <Field label={t.formLocation} htmlFor="create-event-location" required hint="Campus venue, hall number, or ground location.">
                <Input
                  id="create-event-location"
                  type="text"
                  placeholder="e.g. Main Auditorium · Gate 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <Field label={t.formRegistrationUrl} htmlFor="create-event-registration-url" hint="Optional external Google Form or ticketing link.">
                <Input
                  id="create-event-registration-url"
                  type="url"
                  value={registrationUrl}
                  onChange={(e) => setRegistrationUrl(e.target.value)}
                  placeholder="https://forms.google.com/..."
                />
              </Field>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Field label={t.formDescription} htmlFor="create-event-description" required hint="Briefly describe what attendees will experience, eligibility, and rules.">
                <Textarea
                  id="create-event-description"
                  rows={4}
                  placeholder="Detail the event agenda, highlights, prizes, and instructions for participants..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <DateTimePicker label={t.formStartAt} value={startAt} onChange={setStartAt} required />
            </div>

            <div className="space-y-1.5">
              <DateTimePicker label={t.formEndAt} value={endAt} onChange={setEndAt} min={startAt} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] pt-6">
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/college/${slug}/manager/clubs/${clubId}`)}
            >
              {actions.cancel}
            </DashboardButton>
            <DashboardButton
              type="submit"
              variant="primary"
              size="sm"
              loading={createEventMutation.isPending}
              leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}
            >
              {actions.createEvent}
            </DashboardButton>
          </div>
        </form>
      </div>
    </div>
  );
}
