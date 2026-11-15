'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  useClubDashboardQuery,
  useManagedClubEventsQuery,
  useUpdateManagedClubMutation,
  uploadClubLogo,
  deleteClubLogo,
  uploadClubCover,
  deleteClubCover,
} from '@/lib/api/manager';
import { queryKeys } from '@/lib/api/queryKeys';
import type { Event } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { Select } from '@/components/dashboard/ui/Field';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, emptyStates, eventManager } from '@/lib/copy';

export interface ClubDetailClientProps {
  slug: string;
  clubId: string;
}

type EventStatusFilter = 'ALL' | 'UPCOMING_ONGOING' | 'COMPLETED' | 'CANCELLED';

const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ||
  fallback;

function formatEventDate(dateStr?: string) {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Event Manager club detail: identity banner, club media & branding (cover +
 * logo upload with named confirmations), inline info editing, members grid,
 * and the club's events with a status filter. Presentation moved to the new
 * UI system; same manager API hooks as before.
 */
export default function ClubDetailClient({ slug, clubId }: ClubDetailClientProps) {
  const t = eventManager.clubDetail;
  const em = eventManager.dashboard;
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubFormError, setClubFormError] = useState('');

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDeleting, setCoverDeleting] = useState(false);

  const [logoConfirmOpen, setLogoConfirmOpen] = useState(false);
  const [coverConfirmOpen, setCoverConfirmOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>('ALL');

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: club,
    isLoading,
    isError,
    error: clubErrorObj,
    refetch: refetchClub,
  } = useClubDashboardQuery(slug, clubId);

  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsIsError,
    refetch: refetchEvents,
  } = useManagedClubEventsQuery(slug, clubId);

  const updateClubMutation = useUpdateManagedClubMutation(slug);

  const handleRefresh = () => {
    void refetchClub();
    void refetchEvents();
  };

  const handleToggleEditInfo = () => {
    if (!isEditingInfo) {
      setClubName(club?.name || '');
      setClubDescription(club?.description || '');
      setClubFormError('');
      setIsEditingInfo(true);
    } else {
      setIsEditingInfo(false);
    }
  };

  const handleUpdateClubInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!clubName.trim()) {
      setClubFormError(t.errNameRequired);
      return;
    }
    try {
      await updateClubMutation.mutateAsync({
        clubId,
        data: { name: clubName.trim(), description: clubDescription.trim() || undefined },
      });
      toast(t.toastSaved, { variant: 'success' });
      setIsEditingInfo(false);
    } catch (err: unknown) {
      setClubFormError(errMsg(err, t.errSave));
    }
  };

  const invalidateClubQueries = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('cover', file);
    try {
      setCoverUploading(true);
      await uploadClubCover(clubId, formData);
      toast(t.toastCoverUploaded, { variant: 'success' });
      await invalidateClubQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errCoverUpload), { variant: 'error' });
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverDelete = async () => {
    setCoverDeleting(true);
    try {
      await deleteClubCover(clubId);
      toast(t.toastCoverRemoved, { variant: 'success' });
      await invalidateClubQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errCoverRemove), { variant: 'error' });
    } finally {
      setCoverDeleting(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      setLogoUploading(true);
      await uploadClubLogo(clubId, formData);
      toast(t.toastLogoUploaded, { variant: 'success' });
      await invalidateClubQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errLogoUpload), { variant: 'error' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    setLogoDeleting(true);
    try {
      await deleteClubLogo(clubId);
      toast(t.toastLogoRemoved, { variant: 'success' });
      await invalidateClubQueries();
    } catch (err: unknown) {
      toast(errMsg(err, t.errLogoRemove), { variant: 'error' });
    } finally {
      setLogoDeleting(false);
    }
  };

  const handleCreateEvent = () => {
    router.push(`/college/${slug}/manager/clubs/${clubId}/events/create`);
  };

  const memberCount = club?.members?.length ?? club?.memberCount ?? club?._count?.members ?? 0;

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

  const rawClubError = clubErrorObj as
    | { response?: { status?: number; data?: { message?: string } } }
    | null;
  const errorStatus = rawClubError?.response?.status;
  const clubErrorMessage =
    rawClubError?.response?.data?.message ||
    (errorStatus === 403
      ? 'You do not have permission to manage this club.'
      : errorStatus === 404
        ? 'Club not found.'
        : 'Failed to load club details.');

  const statusChip = (status?: Event['status']) => {
    switch (status) {
      case 'ONGOING':
        return <Chip variant="success" dot>{em.statusOngoing}</Chip>;
      case 'COMPLETED':
        return <Chip variant="neutral">{em.statusCompleted}</Chip>;
      case 'CANCELLED':
        return <Chip variant="danger" dot>{em.statusCancelled}</Chip>;
      default:
        return <Chip variant="brand" dot>{em.statusUpcoming}</Chip>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <SkeletonLines count={2} />
      </div>
    );
  }

  if (isError || !club) {
    return (
      <EmptyState
        icon={Building2}
        title={
          errorStatus === 403 ? 'Access restricted' : errorStatus === 404 ? 'Club not found' : t.loadFailedTitle
        }
        description={clubErrorMessage}
        actionLabel={actions.retry}
        onAction={() => void refetchClub()}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* Back */}
      <Link
        href={`/college/${slug}/manager/clubs`}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>

      <PageHeader
        role="eventManager"
        title={club.name}
        description={club.description || t.noDescription}
        actions={
          <>
            <DashboardButton variant="secondary" size="sm" onClick={() => void handleRefresh()} leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}>
              {em.refresh}
            </DashboardButton>
            <DashboardButton variant="secondary" size="sm" onClick={handleToggleEditInfo}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              {isEditingInfo ? t.cancelEdit : t.edit}
            </DashboardButton>
            <DashboardButton variant="primary" size="sm" onClick={handleCreateEvent}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t.createEvent}
            </DashboardButton>
          </>
        }
      />

      {/* Club media & branding */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <ImageIcon aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.mediaTitle}</h2>
        </div>

        {/* Cover banner */}
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
          {club.coverImageUrl || club.coverUrl || club.coverImage?.url ? (
            <img
              src={club.coverImageUrl || club.coverUrl || club.coverImage?.url || ''}
              alt={club.name}
              className="h-40 w-full object-cover sm:h-48"
            />
          ) : (
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[var(--primary-soft)] via-[var(--surface)] to-[var(--bg)] sm:h-48">
              <Building2 aria-hidden="true" className="h-10 w-10 text-[var(--ink-soft)]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
          <div className="absolute right-4 top-4 z-10 flex flex-wrap gap-2">
            <Chip variant="neutral">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Chip>
            <Chip variant="brand">{club.category || club.clubType || 'Student Club'}</Chip>
          </div>
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3">
            {club.logo?.url || club.logoUrl ? (
              <img
                src={club.logo?.url || club.logoUrl || ''}
                alt={`${club.name} logo`}
                className="h-14 w-14 rounded-2xl border-4 border-white/60 bg-[var(--surface)] object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-2xl border-4 border-white/60 bg-[var(--surface)] font-display text-base font-bold text-[var(--primary)]"
              >
                {club.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Cover + logo management */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Cover */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--ink)]">
              <ImageIcon aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.coverTitle}
            </h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--ink-soft)]">{t.coverHint}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DashboardButton
                variant="primary"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading || coverDeleting}
                leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}
              >
                {coverUploading ? 'Uploading…' : club.coverImageUrl || club.coverUrl ? t.replaceCover : t.uploadCover}
              </DashboardButton>
              {club.coverImageUrl || club.coverUrl ? (
                <DashboardButton
                  variant="danger"
                  size="sm"
                  onClick={() => setCoverConfirmOpen(true)}
                  disabled={coverUploading || coverDeleting}
                  leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                >
                  {t.removeCover}
                </DashboardButton>
              ) : null}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleCoverUpload(e);
                  e.target.value = '';
                }}
                disabled={coverUploading || coverDeleting}
              />
            </div>
          </div>

          {/* Logo */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--ink)]">
              <Building2 aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.logoTitle}
            </h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--ink-soft)]">{t.logoHint}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DashboardButton
                variant="primary"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading || logoDeleting}
                leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}
              >
                {logoUploading ? 'Uploading…' : club.logoUrl ? t.replaceLogo : t.uploadLogo}
              </DashboardButton>
              {club.logoUrl ? (
                <DashboardButton
                  variant="danger"
                  size="sm"
                  onClick={() => setLogoConfirmOpen(true)}
                  disabled={logoUploading || logoDeleting}
                  leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                >
                  {t.removeLogo}
                </DashboardButton>
              ) : null}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleLogoUpload(e);
                  e.target.value = '';
                }}
                disabled={logoUploading || logoDeleting}
              />
            </div>
          </div>
        </div>

        {/* Edit info form */}
        {isEditingInfo && (
          <form onSubmit={(e) => void handleUpdateClubInfo(e)} className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
            <h3 className="font-display text-base font-bold text-[var(--ink)]">{t.editTitle}</h3>

            {clubFormError && (
              <p role="alert" className="rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] px-4 py-3 text-xs font-medium text-[var(--secondary)]">
                {clubFormError}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="club-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  {t.formName}
                </label>
                <input
                  id="club-name"
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm text-[var(--ink)] focus-visible:outline-hidden focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="club-description" className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  {t.formDescription}
                </label>
                <textarea
                  id="club-description"
                  rows={4}
                  value={clubDescription}
                  onChange={(e) => setClubDescription(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] focus-visible:outline-hidden focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => setIsEditingInfo(false)}>
                {t.cancelEdit}
              </DashboardButton>
              <DashboardButton variant="primary" size="sm" type="submit" loading={updateClubMutation.isPending}>
                {t.save}
              </DashboardButton>
            </div>
          </form>
        )}
      </DashboardCard>

      {/* Members */}
      <DashboardCard className="mt-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <Users aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.membersTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.membersHint}</p>
          </div>
          <Chip variant="neutral">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Chip>
        </div>

        {club.members && club.members.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {club.members.map((member) => {
              const name = member.user?.name || 'Anonymous user';
              const email = member.user?.email || 'No email provided';
              const role = member.role || member.user?.role || 'MEMBER';
              const isManager = role === 'MANAGER' || role === 'ADMIN';
              return (
                <li
                  key={member.id || email}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] font-display text-xs font-bold text-[var(--primary)]"
                    >
                      {name
                        .trim()
                        .split(/\s+/)
                        .map((p) => p.charAt(0))
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">{name}</p>
                      <p className="truncate text-[11px] text-[var(--ink-soft)]">{email}</p>
                    </div>
                  </div>
                  <Chip variant={isManager ? 'brand' : 'neutral'}>{isManager ? t.memberManager : t.memberMember}</Chip>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
            {t.noMembersTitle} — {t.noMembersDescription}
          </p>
        )}
      </DashboardCard>

      {/* Events */}
      <DashboardCard className="mt-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <Calendar aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.eventsTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.eventsHint}</p>
          </div>
          <div className="sm:self-end">
            <Select
              aria-label="Filter events by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EventStatusFilter)}
              className="w-full sm:w-56"
            >
              <option value="ALL">{t.statusAll}</option>
              <option value="UPCOMING_ONGOING">{t.statusUpcoming}</option>
              <option value="COMPLETED">{t.statusCompleted}</option>
              <option value="CANCELLED">{t.statusCancelled}</option>
            </Select>
          </div>
        </div>

        {eventsLoading ? (
          <div className="mt-4">
            <SkeletonLines count={3} />
          </div>
        ) : eventsIsError ? (
          <div className="mt-4">
            <EmptyState
              icon={Calendar}
              title={emptyStates.loadingFailed.title}
              description={emptyStates.loadingFailed.description}
              actionLabel={actions.retry}
              onAction={() => void refetchEvents()}
            />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Calendar}
              title={t.noEventsTitle}
              description={t.noEventsDescription}
              actionLabel={t.createEvent}
              onAction={handleCreateEvent}
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((evt) => (
              <Link
                key={evt.id}
                href={`/college/${slug}/manager/clubs/${clubId}/events/${evt.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="relative h-40 w-full overflow-hidden">
                  {evt.coverImage?.url || evt.coverUrl ? (
                    <img
                      src={evt.coverImage?.url || evt.coverUrl || ''}
                      alt={evt.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--bg)] p-4">
                      <Calendar aria-hidden="true" className="h-8 w-8 text-[var(--ink-soft)]" />
                    </div>
                  )}
                  <div className="absolute right-3 top-3">{statusChip(evt.status)}</div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-1 font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
                    {evt.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">{evt.description}</p>
                  <div className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-soft)]">
                    <div className="flex items-center gap-2">
                      <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                      <span>
                        {formatEventDate(evt.startAt)}
                        {formatEventTime(evt.startAt) ? ` • ${formatEventTime(evt.startAt)}` : ''}
                      </span>
                    </div>
                    {evt.location && (
                      <div className="flex items-center gap-2">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--secondary)]" />
                        <span className="truncate">{evt.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardCard>

      {/* Delete confirmations (irreversible — name the object + consequence) */}
      <ConfirmDialog
        open={logoConfirmOpen}
        onClose={() => setLogoConfirmOpen(false)}
        onConfirm={() => void handleLogoDelete()}
        title={t.removeLogoTitle(club.name)}
        confirmLabel={t.removeLogo}
        variant="danger"
        loading={logoDeleting}
      >
        {t.removeLogoBody(club.name)}
      </ConfirmDialog>

      <ConfirmDialog
        open={coverConfirmOpen}
        onClose={() => setCoverConfirmOpen(false)}
        onConfirm={() => void handleCoverDelete()}
        title={t.removeCoverTitle(club.name)}
        confirmLabel={t.removeCover}
        variant="danger"
        loading={coverDeleting}
      >
        {t.removeCoverBody(club.name)}
      </ConfirmDialog>
    </div>
  );
}
