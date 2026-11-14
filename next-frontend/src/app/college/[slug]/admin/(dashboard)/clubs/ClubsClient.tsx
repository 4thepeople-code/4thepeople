'use client';

import { useState } from 'react';
import { Building2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  useAdminClubsQuery,
  useDeleteClubMutation,
  useRequestClubDeletionCodeMutation,
} from '@/lib/api/admin';
import type { Club } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/DataTable';
import EditClubModal from '@/components/collegeAdmin/EditClubModal';
import DeleteOtpModal from '@/components/collegeAdmin/DeleteOtpModal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin, emptyStates } from '@/lib/copy';

export interface ClubsClientProps {
  slug: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * College Admin clubs list. Same hooks as before (useAdminClubsQuery, OTP
 * club deletion) plus the kit EditClubModal; presentation only.
 */
export default function ClubsClient({ slug }: ClubsClientProps) {
  const t = collegeAdmin.clubs;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [clubToEdit, setClubToEdit] = useState<Club | null>(null);
  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);

  const { data: clubs = [], isLoading, isError, refetch } = useAdminClubsQuery(slug);
  const requestCodeMutation = useRequestClubDeletionCodeMutation();
  const deleteClubMutation = useDeleteClubMutation(slug);

  const handleRequestDeletionCode = async () => {
    if (!clubToDelete?.id) return;
    return await requestCodeMutation.mutateAsync(clubToDelete.id);
  };

  const handleConfirmClubDelete = async (code: string) => {
    if (!clubToDelete?.id) return;
    return await deleteClubMutation.mutateAsync({ clubId: clubToDelete.id, code });
  };

  const filteredClubs = clubs.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const filtersActive = Boolean(search.trim());

  const columns: DataTableColumn<Club>[] = [
    {
      key: 'club',
      header: t.tableClub,
      render: (club) => (
        <div className="flex items-center gap-3">
          {club.logo?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.logo.url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border border-[var(--line)] object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] font-display text-sm font-bold text-[var(--primary)]"
            >
              {club.name?.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-[var(--ink)]">{club.name}</p>
              {club.isCentral && <Chip variant="warning">{t.chipCentral}</Chip>}
              {Array.isArray(club.departments) &&
                club.departments.map((d) => (
                  <Chip key={d.id || d.shortCode} variant="brand">
                    {d.shortCode || d.name}
                  </Chip>
                ))}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
              {club.description || collegeAdmin.dashboard.noDescription}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'members',
      header: t.tableMembers,
      render: (club) => {
        const memberCount = club._count?.members || club.members?.length || club.memberCount || 0;
        return (
          <Chip variant="neutral" dot>
            {t.members(memberCount)}
          </Chip>
        );
      },
    },
    {
      key: 'created',
      header: t.tableCreated,
      render: (club) => (
        <span className="text-xs text-[var(--ink-soft)]">
          {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: collegeAdmin.departments.tableActions,
      render: (club) => (
        <div className="flex flex-wrap justify-end gap-1.5 lg:justify-start">
          <DashboardButton
            variant="ghost"
            size="sm"
            href={adminPath(slug, `/clubs/${club.id}`)}
          >
            {t.manage}
          </DashboardButton>
          <DashboardButton variant="ghost" size="sm" onClick={() => setClubToEdit(club)}>
            {t.edit}
          </DashboardButton>
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => setClubToDelete(club)}
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          >
            {t.delete}
          </DashboardButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        role="collegeAdmin"
        title={t.title}
        description={t.description}
        actions={
          <>
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              {t.refresh}
            </DashboardButton>
            <DashboardButton
              size="sm"
              href={adminPath(slug, '/clubs/create')}
              leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            >
              {t.createClub}
            </DashboardButton>
          </>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
        />
        <Input
          type="search"
          aria-label={t.searchPlaceholder}
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mt-6">
        {isError ? (
          <EmptyState
            title={emptyStates.loadingFailed.title}
            description={emptyStates.loadingFailed.description}
          >
            <div className="mt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => refetch()}>
                {actions.retry}
              </DashboardButton>
            </div>
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredClubs}
            getRowKey={(club) => club.id}
            loading={isLoading}
            loadingLabel={t.loadingLabel}
            empty={
              <EmptyState
                icon={Building2}
                title={filtersActive ? t.emptySearchTitle : t.emptyTitle}
                description={filtersActive ? t.emptySearchFix : t.emptyDescription}
                actionLabel={filtersActive ? undefined : t.createClub}
                actionHref={filtersActive ? undefined : adminPath(slug, '/clubs/create')}
              />
            }
          />
        )}
      </div>

      {/* Edit club */}
      <EditClubModal
        slug={slug}
        isOpen={!!clubToEdit}
        onClose={() => setClubToEdit(null)}
        onSuccess={() => void refetch()}
        club={clubToEdit}
      />

      {/* Two-step OTP club deletion (irreversible — names the club) */}
      <DeleteOtpModal
        isOpen={!!clubToDelete}
        onClose={() => setClubToDelete(null)}
        onRequestCode={handleRequestDeletionCode}
        onConfirm={handleConfirmClubDelete}
        title={clubToDelete ? t.deleteTitle(clubToDelete.name) : t.delete}
        itemName={clubToDelete?.name}
        warningText={t.deleteWarning}
        confirmText={t.confirmDelete}
        onSuccess={() => {
          setClubToDelete(null);
          void refetch();
          toast(t.toastDeleted, { variant: 'success' });
        }}
      />
    </div>
  );
}
