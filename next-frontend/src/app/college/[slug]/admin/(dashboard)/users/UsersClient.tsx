'use client';

import { useState } from 'react';
import { Eye, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  useAllUsersQuery,
  useDeleteUserMutation,
  useRequestUserDeletionCodeMutation,
} from '@/lib/api/admin';
import type { User } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/DataTable';
import DeleteOtpModal from '@/components/collegeAdmin/DeleteOtpModal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin, emptyStates } from '@/lib/copy';

export interface UsersClientProps {
  slug: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * College Admin accounts list. Same hooks as before (useAllUsersQuery,
 * OTP-code deletion); presentation only. Search filters client-side.
 */
export default function UsersClient({ slug }: UsersClientProps) {
  const t = collegeAdmin.users;
  const td = collegeAdmin.deleteOtp;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users = [], isLoading, isError, refetch } = useAllUsersQuery(slug);
  const requestCodeMutation = useRequestUserDeletionCodeMutation();
  const deleteUserMutation = useDeleteUserMutation(slug);

  const handleRequestDeletionCode = async () => {
    if (!userToDelete?.id) return;
    return await requestCodeMutation.mutateAsync(userToDelete.id);
  };

  const handleConfirmUserDelete = async (code: string) => {
    if (!userToDelete?.id) return;
    return await deleteUserMutation.mutateAsync({ userId: userToDelete.id, code });
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.role && u.role.toLowerCase().includes(term)) ||
      (u.rollNumber && u.rollNumber.toLowerCase().includes(term))
    );
  });

  const filtersActive = Boolean(search.trim());

  const columns: DataTableColumn<User>[] = [
    {
      key: 'user',
      header: t.tableUser,
      render: (user) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] font-display text-sm font-bold text-[var(--primary)]"
          >
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--ink)]">{user.name}</p>
            <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t.tableRole,
      render: (user) => <Chip variant="neutral">{user.role}</Chip>,
    },
    {
      key: 'status',
      header: t.tableStatus,
      render: (user) =>
        user.isActive ? (
          <Chip variant="success" dot>
            {t.statusActive}
          </Chip>
        ) : (
          <Chip variant="warning" dot>
            {t.statusPending}
          </Chip>
        ),
    },
    {
      key: 'created',
      header: t.tableCreated,
      render: (user) => (
        <span className="text-xs text-[var(--ink-soft)]">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.tableActions,
      render: (user) => (
        <div className="flex flex-wrap justify-end gap-1.5 lg:justify-start">
          <DashboardButton
            variant="ghost"
            size="sm"
            href={adminPath(slug, `/users/${user.id}`)}
            leftIcon={<Eye aria-hidden="true" className="h-4 w-4" />}
          >
            {t.viewDetails}
          </DashboardButton>
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => setUserToDelete(user)}
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
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            loading={false}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.refresh}
          </DashboardButton>
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
            rows={filteredUsers}
            getRowKey={(user) => user.id}
            loading={isLoading}
            loadingLabel={t.loadingLabel}
            empty={
              <EmptyState
                title={filtersActive ? t.emptySearchTitle : t.emptyTitle}
                description={filtersActive ? t.emptySearchFix : t.emptyDescription}
                actionLabel={filtersActive ? undefined : t.emptyAction}
                actionHref={filtersActive ? undefined : adminPath(slug, '/roster')}
              />
            }
          />
        )}
      </div>

      {/* Two-step OTP account deletion (irreversible — names the account) */}
      <DeleteOtpModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onRequestCode={handleRequestDeletionCode}
        onConfirm={handleConfirmUserDelete}
        title={userToDelete ? collegeAdmin.userDetail.deleteTitle(userToDelete.name) : td.codeLabel}
        itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : ''}
        warningText={collegeAdmin.userDetail.deleteWarning}
        confirmText={collegeAdmin.userDetail.confirmDelete}
        onSuccess={() => {
          setUserToDelete(null);
          void refetch();
          toast(collegeAdmin.userDetail.toastDeleted, { variant: 'success' });
        }}
      />
    </div>
  );
}
