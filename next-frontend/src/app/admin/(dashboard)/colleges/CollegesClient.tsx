'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search } from 'lucide-react';
import {
  usePlatformCollegesQuery,
  useCreateCollegeMutation,
  useUpdateCollegeMutation,
  useToggleCollegeStatusMutation,
  useProvisionCollegeAdminMutation,
  useResendCollegeAdminInviteMutation,
  useToggleCollegeAdminStatusMutation,
} from '@/lib/api/platform';
import { queryKeys } from '@/lib/api/queryKeys';
import type { CollegeAdminStatus, PlatformCollege } from '@/types/platform';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import Chip from '@/components/dashboard/ui/Chip';
import Switch from '@/components/dashboard/ui/Switch';
import Modal from '@/components/dashboard/ui/Modal';
import Field, { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/DataTable';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, emptyStates, superAdmin } from '@/lib/copy';

const ADMIN_STATUS_OPTIONS: CollegeAdminStatus[] = [
  'ACTIVE',
  'PENDING_ACTIVATION',
  'INVITATION_EXPIRED',
  'SUSPENDED',
  'NOT_ASSIGNED',
];

const emptyAddForm = {
  name: '',
  code: '',
  officialEmail: '',
  address: '',
  city: '',
  state: '',
  contactNumber: '',
  assignAdminNow: false,
  adminName: '',
  adminEmail: '',
};

/**
 * Super Admin colleges screen. Every existing platform hook and endpoint is
 * reused as-is; presentation only. Reversible status changes are optimistic
 * toggles with an Undo toast; nothing here is destructive, so no confirm
 * dialogs are needed.
 */
export default function CollegesClient() {
  const t = superAdmin.colleges;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters (search is debounced so every keystroke doesn't hit the API)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [adminFilter, setAdminFilter] = useState<'all' | CollegeAdminStatus>('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    data: colleges = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = usePlatformCollegesQuery({
    search: debouncedSearch,
    status: statusFilter,
    adminStatus: adminFilter === 'all' ? undefined : adminFilter,
  });

  const createCollegeMutation = useCreateCollegeMutation();
  const updateCollegeMutation = useUpdateCollegeMutation();
  const toggleCollegeStatusMutation = useToggleCollegeStatusMutation();
  const provisionAdminMutation = useProvisionCollegeAdminMutation();
  const resendInviteMutation = useResendCollegeAdminInviteMutation();
  const toggleAdminStatusMutation = useToggleCollegeAdminStatusMutation();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<PlatformCollege | null>(null);

  // Forms
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    officialEmail: '',
    address: '',
    city: '',
    state: '',
    contactNumber: '',
  });
  const [assignForm, setAssignForm] = useState({ adminName: '', adminEmail: '' });

  const metrics = useMemo(
    () => ({
      total: colleges.length,
      active: colleges.filter((c) => c.isActive).length,
      unassigned: colleges.filter((c) => !c.admin).length,
      pendingOrExpired: colleges.filter(
        (c) =>
          c.admin &&
          (c.admin.status === 'PENDING_ACTIVATION' || c.admin.status === 'INVITATION_EXPIRED'),
      ).length,
    }),
    [colleges],
  );

  const filtersActive = Boolean(debouncedSearch) || statusFilter !== 'all' || adminFilter !== 'all';

  // ---- Optimistic toggles (rollback on failure, Undo reverses) ----

  const setCollegeActiveOptimistic = async (college: PlatformCollege, next: boolean) => {
    const snapshots = queryClient.getQueriesData<PlatformCollege[]>({
      queryKey: queryKeys.platform.colleges(),
    });
    queryClient.setQueriesData<PlatformCollege[]>({ queryKey: queryKeys.platform.colleges() }, (old) =>
      old ? old.map((c) => (c.id === college.id ? { ...c, isActive: next } : c)) : old,
    );
    try {
      await toggleCollegeStatusMutation.mutateAsync({ id: college.id, isActive: next });
      toast(next ? t.toastCollegeActivated(college.name) : t.toastCollegeDeactivated(college.name), {
        variant: 'success',
        durationMs: 7000,
        action: { label: actions.undo, onClick: () => void setCollegeActiveOptimistic(college, !next) },
      });
    } catch (err: unknown) {
      snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errToggle, { variant: 'error' });
    }
  };

  const setCollegeAdminActiveOptimistic = async (college: PlatformCollege, next: boolean) => {
    const admin = college.admin;
    if (!admin) return;
    const snapshots = queryClient.getQueriesData<PlatformCollege[]>({
      queryKey: queryKeys.platform.colleges(),
    });
    queryClient.setQueriesData<PlatformCollege[]>({ queryKey: queryKeys.platform.colleges() }, (old) =>
      old
        ? old.map((c) =>
            c.id === college.id && c.admin
              ? { ...c, admin: { ...c.admin, isActive: next, status: next ? 'ACTIVE' : 'SUSPENDED' } }
              : c,
          )
        : old,
    );
    try {
      await toggleAdminStatusMutation.mutateAsync({ adminId: admin.id, isActive: next });
      toast(next ? t.toastAdminReactivated(admin.name) : t.toastAdminSuspended(admin.name), {
        variant: 'success',
        durationMs: 7000,
        action: {
          label: actions.undo,
          onClick: () => void setCollegeAdminActiveOptimistic(college, !next),
        },
      });
    } catch (err: unknown) {
      snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errAdminToggle, { variant: 'error' });
    }
  };

  // ---- Form submissions ----

  const handleAddCollege = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddFormError(null);
    if (!addForm.name.trim() || !addForm.code.trim()) {
      setAddFormError(t.errNameCodeRequired);
      return;
    }
    if (addForm.assignAdminNow && (!addForm.adminName.trim() || !addForm.adminEmail.trim())) {
      setAddFormError(t.errAdminFieldsRequired);
      return;
    }
    try {
      await createCollegeMutation.mutateAsync({
        name: addForm.name.trim(),
        code: addForm.code.trim().toUpperCase(),
        officialEmail: addForm.officialEmail.trim() || undefined,
        address: addForm.address.trim() || undefined,
        city: addForm.city.trim() || undefined,
        state: addForm.state.trim() || undefined,
        contactNumber: addForm.contactNumber.trim() || undefined,
        admin: addForm.assignAdminNow
          ? { name: addForm.adminName.trim(), email: addForm.adminEmail.trim().toLowerCase() }
          : undefined,
      });
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      toast(t.toastCollegeCreated, { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errCreate, { variant: 'error' });
    }
  };

  const handleEditCollege = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCollege) return;
    if (!editForm.name.trim()) {
      toast(t.errNameCodeRequired, { variant: 'error' });
      return;
    }
    try {
      await updateCollegeMutation.mutateAsync({
        id: selectedCollege.id,
        name: editForm.name.trim(),
        officialEmail: editForm.officialEmail.trim() || undefined,
        address: editForm.address.trim() || undefined,
        city: editForm.city.trim() || undefined,
        state: editForm.state.trim() || undefined,
        contactNumber: editForm.contactNumber.trim() || undefined,
      });
      setShowEditModal(false);
      setSelectedCollege(null);
      toast(t.toastCollegeUpdated, { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errUpdate, { variant: 'error' });
    }
  };

  const handleAssignAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCollege) return;
    if (!assignForm.adminName.trim() || !assignForm.adminEmail.trim()) {
      toast(t.errAdminFieldsRequired, { variant: 'error' });
      return;
    }
    try {
      await provisionAdminMutation.mutateAsync({
        collegeId: selectedCollege.id,
        name: assignForm.adminName.trim(),
        email: assignForm.adminEmail.trim().toLowerCase(),
      });
      setShowAssignModal(false);
      setSelectedCollege(null);
      setAssignForm({ adminName: '', adminEmail: '' });
      toast(t.toastAdminProvisioned(selectedCollege.name), { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errProvision, { variant: 'error' });
    }
  };

  const handleResendInvite = async (college: PlatformCollege) => {
    if (!college.admin) return;
    try {
      await resendInviteMutation.mutateAsync({ adminId: college.admin.id });
      toast(t.toastInviteResent(college.name), { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(serverMessage || t.errResend, { variant: 'error' });
    }
  };

  const openEdit = (college: PlatformCollege) => {
    setSelectedCollege(college);
    setEditForm({
      name: college.name,
      officialEmail: college.officialEmail || '',
      address: college.address || '',
      city: college.city || '',
      state: college.state || '',
      contactNumber: college.contactNumber || '',
    });
    setShowEditModal(true);
  };

  const adminStatusChip = (status: CollegeAdminStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Chip variant="success" dot>
            {t.adminStatusLabel[status]}
          </Chip>
        );
      case 'PENDING_ACTIVATION':
        return (
          <Chip variant="warning" dot>
            {t.adminStatusLabel[status]}
          </Chip>
        );
      case 'INVITATION_EXPIRED':
        return (
          <Chip variant="danger" dot>
            {t.adminStatusLabel[status]}
          </Chip>
        );
      case 'SUSPENDED':
        return (
          <Chip variant="danger" dot>
            {t.adminStatusLabel[status]}
          </Chip>
        );
      default:
        return <Chip variant="neutral">{t.adminStatusLabel[status]}</Chip>;
    }
  };

  const columns: DataTableColumn<PlatformCollege>[] = [
    {
      key: 'college',
      header: t.tableCollege,
      render: (college) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--ink)]">{college.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <Chip variant="brand">{college.code}</Chip>
            <span className="truncate font-mono text-[11px] text-[var(--ink-soft)]">
              {college.slug}.4thepeople.in
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: t.tableLocation,
      render: (college) =>
        college.city || college.state ? (
          <span className="text-[var(--ink-soft)]">
            {[college.city, college.state].filter(Boolean).join(', ')}
          </span>
        ) : (
          <span className="text-[var(--ink-soft)] italic">{t.locationUnassigned}</span>
        ),
    },
    {
      key: 'status',
      header: t.tableStatus,
      render: (college) => (
        <div className="flex items-center gap-2.5">
          <Switch
            checked={college.isActive}
            onChange={(next) => void setCollegeActiveOptimistic(college, next)}
            label={college.isActive ? t.switchDeactivate(college.name) : t.switchActivate(college.name)}
            disabled={toggleCollegeStatusMutation.isPending}
          />
          {college.isActive ? (
            <Chip variant="success" dot>
              {t.statusActive}
            </Chip>
          ) : (
            <Chip variant="neutral" dot>
              {t.statusDeactivated}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'admin',
      header: t.tableAdmin,
      render: (college) =>
        college.admin ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{college.admin.name}</p>
            <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">{college.admin.email}</p>
          </div>
        ) : (
          <span className="text-[var(--ink-soft)] italic">{t.noAdminAssigned}</span>
        ),
    },
    {
      key: 'adminStatus',
      header: t.tableAdminStatus,
      render: (college) => adminStatusChip(college.admin ? college.admin.status : 'NOT_ASSIGNED'),
    },
    {
      key: 'actions',
      header: t.tableActions,
      render: (college) => {
        const admin = college.admin;
        const adminStatus: CollegeAdminStatus = admin ? admin.status : 'NOT_ASSIGNED';
        return (
          <div className="flex flex-wrap justify-end gap-1.5 lg:justify-start">
            <DashboardButton variant="ghost" size="sm" onClick={() => { setSelectedCollege(college); setShowViewModal(true); }}>
              {t.viewCollege}
            </DashboardButton>
            <DashboardButton variant="ghost" size="sm" onClick={() => openEdit(college)}>
              {t.editCollege}
            </DashboardButton>
            {!admin && (
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCollege(college);
                  setAssignForm({ adminName: '', adminEmail: '' });
                  setShowAssignModal(true);
                }}
              >
                {t.assignAdmin}
              </DashboardButton>
            )}
            {admin && (adminStatus === 'PENDING_ACTIVATION' || adminStatus === 'INVITATION_EXPIRED') && (
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={() => void handleResendInvite(college)}
                loading={resendInviteMutation.isPending}
                loadingLabel={t.resendInvite}
              >
                {t.resendInvite}
              </DashboardButton>
            )}
            {admin && (adminStatus === 'ACTIVE' || adminStatus === 'SUSPENDED') && (
              <DashboardButton
                variant="ghost"
                size="sm"
                onClick={() => void setCollegeAdminActiveOptimistic(college, !admin.isActive)}
                disabled={toggleAdminStatusMutation.isPending}
              >
                {admin.isActive ? t.suspendAdmin : t.reactivateAdmin}
              </DashboardButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        role="superAdmin"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton onClick={() => { setAddForm(emptyAddForm); setAddFormError(null); setShowAddModal(true); }} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            {t.addCollege}
          </DashboardButton>
        }
      />

      {/* Tally of the current list */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={superAdmin.overview.statColleges} value={metrics.total} loading={isLoading} tone="brand" />
        <StatCard
          label={superAdmin.overview.statActiveColleges}
          value={metrics.active}
          loading={isLoading}
          tone="success"
        />
        <StatCard label={superAdmin.overview.statAwaitingAdmin} value={metrics.unassigned} loading={isLoading} tone="neutral" />
        <StatCard
          label={superAdmin.overview.statPendingInvites}
          value={metrics.pendingOrExpired}
          loading={isLoading}
          tone="warning"
        />
      </div>

      {/* Search + filters */}
      <DashboardCard className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
            <Input
              type="search"
              aria-label={t.searchPlaceholder}
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Field label={t.filterCollegeStatus} htmlFor="college-status-filter">
            <select
              id="college-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
            >
              <option value="all">{t.filterAllCollegeStatuses}</option>
              <option value="active">{t.filterActiveOnly}</option>
              <option value="inactive">{t.filterInactiveOnly}</option>
            </select>
          </Field>
          <Field label={t.filterAdminStatus} htmlFor="admin-status-filter">
            <select
              id="admin-status-filter"
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value as 'all' | CollegeAdminStatus)}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
            >
              <option value="all">{t.filterAllAdminStatuses}</option>
              {ADMIN_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t.adminStatusLabel[status]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <DashboardButton variant="secondary" size="sm" onClick={() => refetch()} loading={isRefetching} loadingLabel={t.loadingLabel} leftIcon={isRefetching ? undefined : <RefreshCw aria-hidden="true" className="h-4 w-4" />}>
              {isRefetching ? t.loadingLabel : actions.retry}
            </DashboardButton>
          </div>
        </div>
      </DashboardCard>

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
            rows={colleges}
            getRowKey={(college) => college.id}
            loading={isLoading}
            loadingLabel={t.loadingLabel}
            empty={
              <EmptyState
                title={t.emptyTitle}
                description={filtersActive ? t.emptyFix : t.emptyDescription}
                actionLabel={filtersActive ? t.clearFilters : t.addCollege}
                onAction={() => {
                  if (filtersActive) {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setAdminFilter('all');
                  } else {
                    setAddForm(emptyAddForm);
                    setAddFormError(null);
                    setShowAddModal(true);
                  }
                }}
              />
            }
          />
        )}
      </div>

      {/* Modal: add college (optionally provision its College Admin) */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={t.addCollege} size="lg">
        <form onSubmit={handleAddCollege} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={t.formName} htmlFor="add-name" required>
                <Input
                  id="add-name"
                  placeholder={t.formNamePlaceholder}
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t.formCode} htmlFor="add-code" required hint={t.formCodeHint}>
              <Input
                id="add-code"
                placeholder={t.formCodePlaceholder}
                className="font-mono uppercase"
                value={addForm.code}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.formOfficialEmail} htmlFor="add-email">
              <Input
                id="add-email"
                type="email"
                placeholder={t.formOfficialEmailPlaceholder}
                value={addForm.officialEmail}
                onChange={(e) => setAddForm({ ...addForm, officialEmail: e.target.value })}
              />
            </Field>
            <Field label={t.formContactNumber} htmlFor="add-phone">
              <Input
                id="add-phone"
                type="tel"
                value={addForm.contactNumber}
                onChange={(e) => setAddForm({ ...addForm, contactNumber: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t.formAddress} htmlFor="add-address">
            <Input
              id="add-address"
              value={addForm.address}
              onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.formCity} htmlFor="add-city">
              <Input
                id="add-city"
                value={addForm.city}
                onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
              />
            </Field>
            <Field label={t.formState} htmlFor="add-state">
              <Input
                id="add-state"
                value={addForm.state}
                onChange={(e) => setAddForm({ ...addForm, state: e.target.value })}
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-bold text-[var(--ink)]">{t.formAdminSection}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{t.formAdminSectionHint}</span>
              </span>
              <Switch
                checked={addForm.assignAdminNow}
                onChange={(next) => setAddForm({ ...addForm, assignAdminNow: next })}
                label={t.formAdminSection}
              />
            </label>
            {addForm.assignAdminNow && (
              <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
                <Field label={t.formAdminName} htmlFor="add-admin-name" required>
                  <Input
                    id="add-admin-name"
                    value={addForm.adminName}
                    onChange={(e) => setAddForm({ ...addForm, adminName: e.target.value })}
                  />
                </Field>
                <Field label={t.formAdminEmail} htmlFor="add-admin-email" required hint={t.formAdminEmailHint}>
                  <Input
                    id="add-admin-email"
                    type="email"
                    value={addForm.adminEmail}
                    onChange={(e) => setAddForm({ ...addForm, adminEmail: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>

          {addFormError && (
            <p role="alert" className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]">
              {addFormError}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
            <DashboardButton variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
              {actions.cancel}
            </DashboardButton>
            <DashboardButton
              type="submit"
              size="sm"
              loading={createCollegeMutation.isPending}
              loadingLabel={addForm.assignAdminNow ? t.createCollegeAndInvite : t.createCollegeOnly}
            >
              {addForm.assignAdminNow ? t.createCollegeAndInvite : t.createCollegeOnly}
            </DashboardButton>
          </div>
        </form>
      </Modal>

      {/* Modal: assign a College Admin to an unassigned college */}
      <Modal
        open={showAssignModal && Boolean(selectedCollege)}
        onClose={() => { setShowAssignModal(false); setSelectedCollege(null); }}
        title={t.assignAdmin}
        size="md"
      >
        {selectedCollege && (
          <form onSubmit={handleAssignAdmin} className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.tableCollege}</p>
              <p className="mt-0.5 text-sm font-bold text-[var(--ink)]">
                {selectedCollege.name} ({selectedCollege.code})
              </p>
            </div>
            <Field label={t.formAdminName} htmlFor="assign-name" required>
              <Input
                id="assign-name"
                value={assignForm.adminName}
                onChange={(e) => setAssignForm({ ...assignForm, adminName: e.target.value })}
              />
            </Field>
            <Field label={t.formAdminEmail} htmlFor="assign-email" required hint={t.formAdminEmailHint}>
              <Input
                id="assign-email"
                type="email"
                value={assignForm.adminEmail}
                onChange={(e) => setAssignForm({ ...assignForm, adminEmail: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => { setShowAssignModal(false); setSelectedCollege(null); }}>
                {actions.cancel}
              </DashboardButton>
              <DashboardButton type="submit" size="sm" loading={provisionAdminMutation.isPending} loadingLabel={t.sendInvite}>
                {t.sendInvite}
              </DashboardButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: edit college details */}
      <Modal
        open={showEditModal && Boolean(selectedCollege)}
        onClose={() => { setShowEditModal(false); setSelectedCollege(null); }}
        title={t.editCollege}
        size="md"
      >
        {selectedCollege && (
          <form onSubmit={handleEditCollege} className="space-y-4">
            <Field label={t.formName} htmlFor="edit-name" required>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.formOfficialEmail} htmlFor="edit-email">
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.officialEmail}
                  onChange={(e) => setEditForm({ ...editForm, officialEmail: e.target.value })}
                />
              </Field>
              <Field label={t.formContactNumber} htmlFor="edit-phone">
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.contactNumber}
                  onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t.formAddress} htmlFor="edit-address">
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.formCity} htmlFor="edit-city">
                <Input
                  id="edit-city"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </Field>
              <Field label={t.formState} htmlFor="edit-state">
                <Input
                  id="edit-state"
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => { setShowEditModal(false); setSelectedCollege(null); }}>
                {actions.cancel}
              </DashboardButton>
              <DashboardButton type="submit" size="sm" loading={updateCollegeMutation.isPending} loadingLabel={actions.saveChanges}>
                {actions.saveChanges}
              </DashboardButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: view full college details (read-only) */}
      <Modal
        open={showViewModal && Boolean(selectedCollege)}
        onClose={() => { setShowViewModal(false); setSelectedCollege(null); }}
        title={t.viewTitle}
        size="md"
      >
        {selectedCollege && (
          <dl className="space-y-3 text-sm">
            {(
              [
                [t.viewCode, selectedCollege.code],
                [t.viewPortal, `${selectedCollege.slug}.4thepeople.in`],
                [t.viewEmail, selectedCollege.officialEmail],
                [t.viewPhone, selectedCollege.contactNumber],
                [t.viewAddress, selectedCollege.address],
                [t.viewCity, selectedCollege.city],
                [t.viewState, selectedCollege.state],
                [t.viewCreated, new Date(selectedCollege.createdAt).toLocaleDateString()],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-6 border-b border-[var(--line)] pb-2.5 last:border-0">
                <dt className="shrink-0 text-[var(--ink-soft)]">{label}</dt>
                <dd className="text-right font-medium text-[var(--ink)]">{value || '—'}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-6 border-b border-[var(--line)] pb-2.5">
              <dt className="shrink-0 text-[var(--ink-soft)]">{t.tableAdmin}</dt>
              <dd className="text-right font-medium text-[var(--ink)]">
                {selectedCollege.admin
                  ? `${selectedCollege.admin.name} · ${selectedCollege.admin.email}`
                  : t.noAdminAssigned}
              </dd>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <DashboardButton variant="secondary" size="sm" onClick={() => { setShowViewModal(false); setSelectedCollege(null); }}>
                {actions.close}
              </DashboardButton>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
