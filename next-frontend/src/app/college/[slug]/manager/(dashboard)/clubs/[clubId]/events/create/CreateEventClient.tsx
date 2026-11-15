'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateClubEventMutation } from '@/lib/api/manager';
import { useToast } from '@/components/dashboard/ui/Toast';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { actions, eventManager } from '@/lib/copy';

export interface CreateEventClientProps {
  slug: string;
  clubId: string;
}

/**
 * Event Manager create-event form for a single managed club. The club comes
 * from the route (the club-aware flow lives in the manager frame); submission
 * uses the same create mutation as before.
 */
export default function CreateEventClient({ slug, clubId }: CreateEventClientProps) {
  const t = eventManager.events;
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
    <p role="alert" className="rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] px-4 py-3 text-xs font-medium text-[var(--secondary)]">
      {error}
    </p>
  ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form id="create-event-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {errText}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Field label={t.formEventTitle} htmlFor="create-event-title" required>
              <Input id="create-event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>
          </div>
          <div className="space-y-1.5">
            <Field label={t.formLocation} htmlFor="create-event-location" required>
              <Input id="create-event-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </Field>
          </div>
          <div className="space-y-1.5">
            <Field label={t.formRegistrationUrl} htmlFor="create-event-registration-url">
              <Input id="create-event-registration-url" type="url" value={registrationUrl} onChange={(e) => setRegistrationUrl(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Field label={t.formDescription} htmlFor="create-event-description" required>
              <Textarea id="create-event-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
            </Field>
          </div>
          <div className="space-y-1.5">
            <DateTimePicker label={t.formStartAt} value={startAt} onChange={setStartAt} required />
          </div>
          <div className="space-y-1.5">
            <DateTimePicker label={t.formEndAt} value={endAt} onChange={setEndAt} min={startAt} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <DashboardButton variant="secondary" size="sm" onClick={() => router.push(`/college/${slug}/manager/clubs/${clubId}`)}>
            {actions.keep}
          </DashboardButton>
          <DashboardButton type="submit" variant="primary" loading={createEventMutation.isPending}>
            {actions.createEvent}
          </DashboardButton>
        </div>
      </form>
    </div>
  );
}
