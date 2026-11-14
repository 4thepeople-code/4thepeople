'use client';

import { useState } from 'react';
import { Building2, Network, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useDepartments, useDeleteDepartmentMutation } from '@/lib/api/departments';
import type { Department } from '@/types/models';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/DataTable';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import DepartmentFormModal from '@/components/collegeAdmin/DepartmentFormModal';
import AssignClubsModal from '@/components/collegeAdmin/AssignClubsModal';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin, emptyStates } from '@/lib/copy';

export interface DepartmentsClientProps {
  slug: string;
}

/**
 * College Admin departments: list, create/edit via DepartmentFormModal,
 * club assignment via AssignClubsModal, and delete with a confirmation that
 * names the consequence (clubs lose their mapping, clubs themselves stay).
 * Same hooks as before; presentation only.
 */
export default function DepartmentsClient({ slug }: DepartmentsClientProps) {
  const t = collegeAdmin.departments;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState<Department | null>(null);
  const [departmentToAssign, setDepartmentToAssign] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);

  const { data: departments = [], isLoading, isError, refetch } = useDepartments(slug);
  const deleteDepartmentMutation = useDeleteDepartmentMutation(slug);

  const openCreate = () => {
    setDepartmentToEdit(null);
    setFormModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!departmentToDelete || deleteDepartmentMutation.isPending) return;
    const deletedName = departmentToDelete.name;
    try {
      await deleteDepartmentMutation.mutateAsync(departmentToDelete.id);
      setDepartmentToDelete(null);
      void refetch();
      toast(t.toastDeleted(deletedName), { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setDepartmentToDelete(null);
      toast(serverMessage || t.errDelete, { variant: 'error' });
    }
  };

  const filteredDepartments = departments.filter((d) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      d.name?.toLowerCase().includes(term) ||
      d.shortCode?.toLowerCase().includes(term) ||
      d.code?.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term)
    );
  });

  const filtersActive = Boolean(search.trim());

  const columns: DataTableColumn<Department>[] = [
    {
      key: 'department',
      header: t.tableDepartment,
      render: (dept) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--primary)]"
          >
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 max-w-xs">
            <p className="truncate font-semibold text-[var(--ink)]">{dept.name}</p>
            <p className="truncate text-xs text-[var(--ink-soft)]">
              {dept.description || t.noDescription}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'shortCode',
      header: t.tableShortCode,
      render: (dept) => <Chip variant="brand">{dept.shortCode || dept.code}</Chip>,
    },
    {
      key: 'clubs',
      header: t.tableClubs,
      render: (dept) => {
        const count = dept.clubCount ?? dept.clubs?.length ?? 0;
        return (
          <Chip variant="neutral" dot>
            {t.clubs(count)}
          </Chip>
        );
      },
    },
    {
      key: 'actions',
      header: t.tableActions,
      render: (dept) => (
        <div className="flex flex-wrap justify-end gap-1.5 lg:justify-start">
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => setDepartmentToAssign(dept)}
            leftIcon={<Network aria-hidden="true" className="h-4 w-4" />}
          >
            {t.assign}
          </DashboardButton>
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setDepartmentToEdit(dept);
              setFormModalOpen(true);
            }}
            leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
          >
            {t.edit}
          </DashboardButton>
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => setDepartmentToDelete(dept)}
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
              onClick={openCreate}
              leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            >
              {t.create}
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
            rows={filteredDepartments}
            getRowKey={(dept) => dept.id}
            loading={isLoading}
            loadingLabel={t.loadingLabel}
            empty={
              <EmptyState
                icon={Building2}
                title={filtersActive ? t.emptySearchTitle : t.emptyTitle}
                description={filtersActive ? t.emptySearchFix : t.emptyDescription}
                actionLabel={filtersActive ? undefined : t.create}
                onAction={filtersActive ? undefined : openCreate}
              />
            }
          />
        )}
      </div>

      {/* Create / edit department */}
      <DepartmentFormModal
        slug={slug}
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setDepartmentToEdit(null);
        }}
        department={departmentToEdit}
        onSuccess={() => void refetch()}
      />

      {/* Assign clubs to a department */}
      <AssignClubsModal
        slug={slug}
        isOpen={!!departmentToAssign}
        onClose={() => setDepartmentToAssign(null)}
        department={departmentToAssign}
        onSuccess={() => void refetch()}
      />

      {/* Delete — names the consequence: mapping removed, clubs survive */}
      <ConfirmDialog
        open={!!departmentToDelete}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={() => void handleDeleteConfirm()}
        title={departmentToDelete ? t.deleteTitle(departmentToDelete.name) : t.delete}
        confirmLabel={t.confirmDelete}
        loading={deleteDepartmentMutation.isPending}
      >
        {t.deleteWarning}
      </ConfirmDialog>
    </div>
  );
}
