'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  useAdminClubDetailQuery,
  useClubManagersQuery,
  useResendInviteMutation,
  useDeleteMembershipMutation,
  useRequestClubDeletionCodeMutation,
  useDeleteClubMutation,
  type ClubManagerItem,
} from '@/lib/api/admin';
import type { Club } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import EditClubModal from '@/components/collegeAdmin/EditClubModal';
import InviteManagerModal from '@/components/collegeAdmin/InviteManagerModal';
import AddExistingManagerModal from '@/components/collegeAdmin/AddExistingManagerModal';
import DeleteOtpModal from '@/components/collegeAdmin/DeleteOtpModal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface ClubDetailClientProps {
  slug: string;
  clubId: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * College Admin club detail: info card, Event Manager roster with add
 * existing / invite new / remove / resend invite, plus club editing and the
 * two-step OTP club deletion. Same hooks as before; presentation only.
 */
export default function ClubDetailClient({ slug, clubId }: ClubDetailClientProps) {
  const t = collegeAdmin.clubDetail;
  const { toast } = useToast();
  const router = useRouter();

  const [editClubOpen, setEditClubOpen] = useState(false);
  const [inviteManagerOpen, setInviteManagerOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [deleteClubOpen, setDeleteClubOpen] = useState(false);
  const [membershipToRemove, setMembershipToRemove] = useState<ClubManagerItem | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    refetch: refetchClub,
  } = useAdminClubDetailQuery(slug, clubId);

  const {
    data: managers = [],
    isLoading: managersLoading,
    refetch: refetchManagers,
  } = useClubManagersQuery(slug, clubId);

  const resendInviteMutation = useResendInviteMutation();
  const deleteMembershipMutation = useDeleteMembershipMutation(slug);
  const requestCodeMutation = useRequestClubDeletionCodeMutation();
  const deleteClubMutation = useDeleteClubMutation(slug);

  const handleRefresh = () => {
    void refetchClub();
    void refetchManagers();
  };

  const handleResendInvite = async (userId: string) => {
    setResendingId(userId);
    try {
      await resendInviteMutation.mutateAsync(userId);
      toast(t.toastInviteResent, { variant: 'success' });
      handleRefresh();
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast(serverMessage || t.errResendInvite, { variant: 'error' });
    } finally {
      setResendingId(null);
    }
  };

  const handleRemoveMembership = async () => {
    if (!membershipToRemove) return;
    const removedName = membershipToRemove.user?.name;
    try {
      await deleteMembershipMutation.mutateAsync(membershipToRemove.id);
      setMembershipToRemove(null);
      handleRefresh();
      toast(removedName ? t.toastManagerRemoved(removedName) : t.toastManagerRemoved(''), {
        variant: 'success',
      });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setMembershipToRemove(null);
      toast(serverMessage || t.errRemoveManager, { variant: 'error' });
    }
  };

  const handleRequestDeletionCode = async () => {
    return await requestCodeMutation.mutateAsync(clubId);
  };

  const handleConfirmClubDelete = async (code: string) => {
    return await deleteClubMutation.mutateAsync({ clubId, code });
  };

  if (clubLoading || managersLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <SkeletonLines count={5} />
      </div>
    );
  }

  if (clubError || !club) {
    return (
      <EmptyState
        icon={Building2}
        title={t.loadFailedTitle}
        description={t.loadFailedDescription}
        actionLabel={t.back}
        actionHref={adminPath(slug, '/clubs')}
      />
    );
  }

  const existingManagerUserIds = managers
    .map((m) => m.user?.id || m.userId)
    .filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={adminPath(slug, '/clubs')}
        className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>

      <PageHeader
        role="collegeAdmin"
        title={club.name}
        description={`${collegeAdmin.clubs.title} · ${club.id}`}
        actions={
          <>
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              {actions.retry}
            </DashboardButton>
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => setEditClubOpen(true)}
              leftIcon={<Building2 aria-hidden="true" className="h-4 w-4" />}
            >
              {t.edit}
            </DashboardButton>
            <DashboardButton
              variant="danger"
              size="sm"
              onClick={() => setDeleteClubOpen(true)}
              leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            >
              {t.delete}
            </DashboardButton>
          </>
        }
      />

      {/* Club information */}
      <DashboardCard>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
            <Building2 aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
            {t.infoTitle}
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
            <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
            {t.created}: {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '—'}
          </span>
        </div>

        <dl className="mt-5 space-y-5 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.affiliation}
            </dt>
            <dd className="mt-1.5">
              {club.isCentral || club.clubType === 'CENTRAL' ? (
                <Chip variant="warning">{t.centralAffiliation}</Chip>
              ) : Array.isArray(club.departments) && club.departments.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {club.departments.map((d) => (
                    <Chip key={d.id || d.shortCode} variant="brand">
                      {d.name} ({d.shortCode})
                    </Chip>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-[var(--ink-soft)]">{t.noAffiliation}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.description}
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              {club.description || t.noDescription}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      {/* Event Managers */}
      <DashboardCard className="mt-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <Shield aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.managersTitle(managers.length)}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.managersHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => setAddExistingOpen(true)}
              leftIcon={<UserCheck aria-hidden="true" className="h-4 w-4" />}
            >
              {t.addExisting}
            </DashboardButton>
            <DashboardButton
              size="sm"
              onClick={() => setInviteManagerOpen(true)}
              leftIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
            >
              {t.inviteNew}
            </DashboardButton>
          </div>
        </div>

        {managers.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
            {t.noManagers}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {managers.map((m) => {
              const u = m.user;
              const uId = u?.id || m.userId;
              const resending = resendInviteMutation.isPending && resendingId === uId;
              return (
                <li
                  key={m.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] font-display text-xs font-bold text-[var(--primary)]"
                      >
                        {u?.name?.charAt(0).toUpperCase() || 'M'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--ink)]">
                          {u?.name || t.pendingInvite}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">
                          {u?.email || t.noEmail}
                        </p>
                      </div>
                    </div>
                    <DashboardButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setMembershipToRemove(m)}
                      disabled={deleteMembershipMutation.isPending}
                      leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                    >
                      {t.remove}
                    </DashboardButton>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
                    <Chip variant="neutral">{t.roleLabel}: {m.role}</Chip>
                    {uId && (
                      <button
                        type="button"
                        onClick={() => void handleResendInvite(uId)}
                        disabled={resending}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 font-semibold text-[var(--primary)] underline-offset-2 transition-colors hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <Send aria-hidden="true" className="h-3.5 w-3.5" />
                        {t.resendInvite}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>

      {/* Edit club (details, logo, department links) */}
      <EditClubModal
        slug={slug}
        isOpen={editClubOpen}
        onClose={() => setEditClubOpen(false)}
        onSuccess={handleRefresh}
        club={club as Club}
      />

      {/* Invite a brand-new Event Manager into this club */}
      <InviteManagerModal
        slug={slug}
        isOpen={inviteManagerOpen}
        onClose={() => setInviteManagerOpen(false)}
        onSuccess={handleRefresh}
        clubId={clubId}
      />

      {/* Assign an existing active account as Event Manager */}
      <AddExistingManagerModal
        slug={slug}
        isOpen={addExistingOpen}
        onClose={() => setAddExistingOpen(false)}
        onSuccess={handleRefresh}
        clubId={clubId}
        existingManagerIds={existingManagerUserIds}
      />

      {/* Remove manager — reversible via re-invite, but still named + confirmed */}
      <ConfirmDialog
        open={!!membershipToRemove}
        onClose={() => setMembershipToRemove(null)}
        onConfirm={() => void handleRemoveMembership()}
        title={t.removeTitle(membershipToRemove?.user?.name || '')}
        confirmLabel={t.confirmRemove}
        loading={deleteMembershipMutation.isPending}
      >
        {t.removeBody(club.name)}
      </ConfirmDialog>

      {/* Two-step OTP club deletion (irreversible — names the club) */}
      <DeleteOtpModal
        isOpen={deleteClubOpen}
        onClose={() => setDeleteClubOpen(false)}
        onRequestCode={handleRequestDeletionCode}
        onConfirm={handleConfirmClubDelete}
        title={t.deleteTitle(club.name)}
        itemName={club.name}
        warningText={t.deleteWarning}
        confirmText={t.confirmDelete}
        onSuccess={() => {
          setDeleteClubOpen(false);
          router.push(adminPath(slug, '/clubs'));
          toast(t.toastDeleted, { variant: 'success' });
        }}
      />
    </div>
  );
}
