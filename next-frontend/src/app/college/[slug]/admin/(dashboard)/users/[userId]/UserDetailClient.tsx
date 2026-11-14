'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Mail,
  Send,
  Shield,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  useUserDetailQuery,
  useResendInviteMutation,
  useRequestUserDeletionCodeMutation,
  useDeleteUserMutation,
} from '@/lib/api/admin';
import type { Club } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import DeleteOtpModal from '@/components/collegeAdmin/DeleteOtpModal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { collegeAdmin } from '@/lib/copy';

export interface UserDetailClientProps {
  slug: string;
  userId: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * College Admin account detail: profile facts, club memberships, resend
 * invite, and the two-step OTP account deletion. Same hooks as before.
 */
export default function UserDetailClient({ slug, userId }: UserDetailClientProps) {
  const t = collegeAdmin.userDetail;
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: user, isLoading, isError, refetch } = useUserDetailQuery(slug, userId);
  const resendInviteMutation = useResendInviteMutation();
  const requestCodeMutation = useRequestUserDeletionCodeMutation();
  const deleteUserMutation = useDeleteUserMutation(slug);

  const handleRequestDeletionCode = async () => {
    return await requestCodeMutation.mutateAsync(userId);
  };

  const handleConfirmUserDelete = async (code: string) => {
    return await deleteUserMutation.mutateAsync({ userId, code });
  };

  const handleResendInvite = async () => {
    try {
      await resendInviteMutation.mutateAsync(userId);
      toast(t.toastInviteResent, { variant: 'success' });
      void refetch();
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast(serverMessage || t.errResendInvite, { variant: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <SkeletonLines count={5} />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <EmptyState
        icon={Building2}
        title={t.loadFailedTitle}
        description={t.loadFailedDescription}
        actionLabel={t.back}
        actionHref={adminPath(slug, '/users')}
      />
    );
  }

  const memberships = user.memberships || [];
  const managerMemberships = memberships.filter((m) => m.role === 'MANAGER');

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={adminPath(slug, '/users')}
        className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>

      <PageHeader
        role="collegeAdmin"
        title={user.name}
        description={`${t.accountId}: ${user.id}`}
        actions={
          <DashboardButton
            variant="danger"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          >
            {t.delete}
          </DashboardButton>
        }
      />

      {/* Account profile */}
      <DashboardCard>
        <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.profileTitle}</h2>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.fullName}
            </dt>
            <dd className="mt-1 font-semibold text-[var(--ink)]">{user.name}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              {t.email}
            </dt>
            <dd className="mt-1 font-mono text-[13px] text-[var(--ink)]">{user.email}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              <Shield aria-hidden="true" className="h-3.5 w-3.5" />
              {t.role}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <Chip variant="neutral">{user.role}</Chip>
              {managerMemberships.length > 0 && (
                <Chip variant="success" dot>
                  {t.managerBadge(managerMemberships.length)}
                </Chip>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {t.status}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2.5">
              {user.isActive ? (
                <Chip variant="success" dot>
                  {t.statusActive}
                </Chip>
              ) : (
                <Chip variant="warning" dot>
                  {t.statusPending}
                </Chip>
              )}
              {!user.isActive && (
                <DashboardButton
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleResendInvite()}
                  loading={resendInviteMutation.isPending}
                  loadingLabel={t.resendInvite}
                  leftIcon={resendInviteMutation.isPending ? undefined : <Send aria-hidden="true" className="h-4 w-4" />}
                >
                  {t.resendInvite}
                </DashboardButton>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              {t.registered}
            </dt>
            <dd className="mt-1 text-[var(--ink)]">
              {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      {/* Club memberships */}
      <DashboardCard className="mt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--ink)]">
              {t.associatedClubs(memberships.length)}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.clubsHint}</p>
          </div>
        </div>

        {memberships.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
            {t.noClubs}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {memberships.map((m) => {
              const club = (m.club || {}) as Partial<Club>;
              const isManager = m.role === 'MANAGER';
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
                        {club.name?.charAt(0).toUpperCase() || 'C'}
                      </span>
                      <h3 className="min-w-0 truncate text-sm font-bold text-[var(--ink)]">
                        {club.name}
                      </h3>
                    </div>
                    <Chip variant={isManager ? 'brand' : 'neutral'}>
                      {isManager && <UserCheck aria-hidden="true" className="mr-1 inline h-3 w-3" />}
                      {m.role}
                    </Chip>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">
                    {club.description || t.noClubDescription}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
                    <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
                      {user.isActive ? (
                        <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {t.joined}: {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                    </span>
                    {club.id && (
                      <Link
                        href={adminPath(slug, `/clubs/${club.id}`)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 font-semibold text-[var(--primary)] underline-offset-2 transition-colors hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                      >
                        {t.viewClub}
                        <ArrowRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>

      {/* Two-step OTP account deletion (irreversible — names the account) */}
      <DeleteOtpModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onRequestCode={handleRequestDeletionCode}
        onConfirm={handleConfirmUserDelete}
        title={t.deleteTitle(user.name)}
        itemName={`${user.name} (${user.email})`}
        warningText={t.deleteWarning}
        confirmText={t.confirmDelete}
        onSuccess={() => {
          setConfirmDeleteOpen(false);
          router.push(adminPath(slug, '/users'));
          toast(t.toastDeleted, { variant: 'success' });
        }}
      />
    </div>
  );
}
