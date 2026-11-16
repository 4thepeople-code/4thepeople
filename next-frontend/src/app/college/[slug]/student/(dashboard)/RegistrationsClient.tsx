'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  Ticket,
  Trash2,
} from 'lucide-react';
import {
  useCancelRegistrationMutation,
  useMyRegistrationsQuery,
} from '@/lib/api/events';
import type { EventRegistration } from '@/types/models';
import CampusPageHeader from './CampusPageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, emptyStates, student } from '@/lib/copy';

export interface RegistrationsClientProps {
  slug: string;
}

const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ||
  fallback;

function formatFullDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Student "My registrations": confirmed RSVPs with event metadata, a Details
 * link to the public event page, and cancellation with a named confirmation.
 * Presentation moved to the new UI system; same events API hooks as before.
 */
export default function RegistrationsClient({ slug }: RegistrationsClientProps) {
  const t = student.registrations;
  const { toast } = useToast();

  const [cancellingReg, setCancellingReg] = useState<EventRegistration | null>(null);

  const {
    data: myRegistrations = [],
    isLoading,
    isError,
    refetch,
  } = useMyRegistrationsQuery(slug, true);

  const cancelMutation = useCancelRegistrationMutation(slug);

  const handleConfirmCancel = async () => {
    if (!cancellingReg) return;
    try {
      await cancelMutation.mutateAsync(cancellingReg.eventId);
      toast(t.toastCancelled, { variant: 'success' });
      setCancellingReg(null);
    } catch (err: unknown) {
      toast(errMsg(err, t.errCancel), { variant: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <CampusPageHeader title={t.title} description={t.description} />
        <EmptyState
          icon={Ticket}
          title={emptyStates.loadingFailed.title}
          description={emptyStates.loadingFailed.description}
          actionLabel={actions.retry}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CampusPageHeader
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.refresh}
          </DashboardButton>
        }
      />

      {myRegistrations.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={t.emptyTitle}
          description={t.emptyDescription}
          actionLabel={t.emptyAction}
          actionHref={`/college/${slug}/student/events`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {myRegistrations.map((reg) => {
            const ev = reg.event;
            return (
              <div
                key={reg.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-sm transition-shadow duration-200 hover:shadow-brutal-md motion-reduce:transition-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip variant="success" dot>
                          {t.rsvpConfirmed}
                        </Chip>
                        {ev?.club?.name && (
                          <span className="truncate text-[11px] font-semibold text-[var(--ink-soft)]">
                            {ev.club.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-base font-bold tracking-tight text-[var(--ink)]">
                        {ev?.title || t.noEventTitle}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] p-3.5 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                    <div className="flex items-center gap-1.5">
                      <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                      <span className="truncate">{formatTime(ev?.startAt) || t.noTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                      <span className="truncate">{ev?.location || t.noLocation}</span>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
                    {ev?.description || t.noDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[var(--border-soft)] pt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                    {t.registeredOn(formatFullDate(reg.registeredAt) || '—')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/college/${slug}/events/${reg.eventId}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--accent-strong)] underline-offset-2 transition-colors hover:bg-[var(--accent-soft)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] motion-reduce:transition-none"
                    >
                      {t.details}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                    <DashboardButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancellingReg(reg)}
                      leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                    >
                      {t.cancel}
                    </DashboardButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation is reversible in spirit but releases the spot to other
          students immediately — named confirmation, then a toast. */}
      <ConfirmDialog
        open={cancellingReg !== null}
        onClose={() => !cancelMutation.isPending && setCancellingReg(null)}
        onConfirm={() => void handleConfirmCancel()}
        title={t.cancelTitle}
        confirmLabel={t.confirmCancel}
        variant="danger"
        loading={cancelMutation.isPending}
      >
        {t.cancelBody(cancellingReg?.event?.title || t.noEventTitle)}
      </ConfirmDialog>
    </div>
  );
}
