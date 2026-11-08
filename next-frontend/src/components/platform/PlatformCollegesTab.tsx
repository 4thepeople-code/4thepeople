'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Users,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Send,
  Eye,
  Edit2,
  UserPlus,
  UserCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  Shield,
  Loader2,
  X,
  ExternalLink,
  Power,
} from 'lucide-react';
import {
  usePlatformCollegesQuery,
  useCreateCollegeMutation,
  useUpdateCollegeMutation,
  useToggleCollegeStatusMutation,
  useProvisionCollegeAdminMutation,
  useResendCollegeAdminInviteMutation,
  useToggleCollegeAdminStatusMutation,
} from '@/lib/api/platform';
import type { PlatformCollege, CollegeAdminStatus } from '@/types/platform';

export default function PlatformCollegesTab() {
  // Query state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');

  // API Hooks
  const { data: colleges = [], isLoading, isRefetching, refetch } = usePlatformCollegesQuery({
    search: searchTerm,
    status: statusFilter,
    adminStatus: adminFilter,
  });

  const createCollegeMutation = useCreateCollegeMutation();
  const updateCollegeMutation = useUpdateCollegeMutation();
  const toggleCollegeStatusMutation = useToggleCollegeStatusMutation();
  const provisionAdminMutation = useProvisionCollegeAdminMutation();
  const resendInviteMutation = useResendCollegeAdminInviteMutation();
  const toggleAdminStatusMutation = useToggleCollegeAdminStatusMutation();

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignAdminModal, setShowAssignAdminModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<PlatformCollege | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
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
  });

  const [editForm, setEditForm] = useState({
    name: '',
    officialEmail: '',
    address: '',
    city: '',
    state: '',
    contactNumber: '',
  });

  const [assignAdminForm, setAssignAdminForm] = useState({
    adminName: '',
    adminEmail: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 6000);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = colleges.length;
    const active = colleges.filter((c) => c.isActive).length;
    const unassigned = colleges.filter((c) => !c.admin).length;
    const pendingOrExpired = colleges.filter(
      (c) => c.admin && (c.admin.status === 'PENDING_ACTIVATION' || c.admin.status === 'INVITATION_EXPIRED')
    ).length;
    return { total, active, unassigned, pendingOrExpired };
  }, [colleges]);

  // Handlers
  const handleAddCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!addForm.name.trim() || !addForm.code.trim()) {
      setActionError('College name and code are required.');
      return;
    }

    if (addForm.assignAdminNow && (!addForm.adminName.trim() || !addForm.adminEmail.trim())) {
      setActionError('Administrator full name and official email are required when assigning an admin.');
      return;
    }

    try {
      const payload = {
        name: addForm.name.trim(),
        code: addForm.code.trim().toUpperCase(),
        officialEmail: addForm.officialEmail.trim() || undefined,
        address: addForm.address.trim() || undefined,
        city: addForm.city.trim() || undefined,
        state: addForm.state.trim() || undefined,
        contactNumber: addForm.contactNumber.trim() || undefined,
        admin: addForm.assignAdminNow
          ? {
              name: addForm.adminName.trim(),
              email: addForm.adminEmail.trim().toLowerCase(),
            }
          : undefined,
      };

      const res = await createCollegeMutation.mutateAsync(payload);
      setShowAddModal(false);
      setAddForm({
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
      });
      showNotification(res.message || 'College created successfully!');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setActionError(errObj.response?.data?.message || 'Failed to create college.');
    }
  };

  const handleEditCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollege) return;
    setActionError(null);

    if (!editForm.name.trim()) {
      setActionError('College name is required.');
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
      showNotification('College details updated successfully!');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setActionError(errObj.response?.data?.message || 'Failed to update college details.');
    }
  };

  const handleAssignAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollege) return;
    setActionError(null);

    if (!assignAdminForm.adminName.trim() || !assignAdminForm.adminEmail.trim()) {
      setActionError('Administrator name and email are required.');
      return;
    }

    try {
      const res = await provisionAdminMutation.mutateAsync({
        collegeId: selectedCollege.id,
        name: assignAdminForm.adminName.trim(),
        email: assignAdminForm.adminEmail.trim().toLowerCase(),
      });

      setShowAssignAdminModal(false);
      setSelectedCollege(null);
      setAssignAdminForm({ adminName: '', adminEmail: '' });
      showNotification(res.message || 'College administrator provisioned and invitation dispatched!');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setActionError(errObj.response?.data?.message || 'Failed to provision administrator.');
    }
  };

  const handleToggleCollegeStatus = async (college: PlatformCollege) => {
    const next = !college.isActive;
    const confirmMsg = next
      ? `Activate ${college.name}? College portal access will be enabled.`
      : `Deactivate ${college.name}? College portal public browsing will be suspended. (Admin account status is preserved independently).`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await toggleCollegeStatusMutation.mutateAsync({ id: college.id, isActive: next });
      showNotification(`College ${next ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      showNotification(errObj.response?.data?.message || 'Failed to update college status.', true);
    }
  };

  const handleResendInvite = async (adminId: string, collegeName: string) => {
    try {
      await resendInviteMutation.mutateAsync({ adminId });
      showNotification(`Invitation email resent for ${collegeName} with a refreshed 48-hour expiration!`);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      showNotification(errObj.response?.data?.message || 'Failed to resend invitation.', true);
    }
  };

  const handleToggleAdminStatus = async (adminId: string, currentActive: boolean, adminName: string) => {
    const next = !currentActive;
    const confirmMsg = next
      ? `Reactivate ${adminName}? They will be able to log in to the college admin portal.`
      : `Suspend ${adminName}? They will be immediately blocked from logging in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await toggleAdminStatusMutation.mutateAsync({ adminId, isActive: next });
      showNotification(`Administrator ${adminName} has been ${next ? 'reactivated' : 'suspended'}.`);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      showNotification(errObj.response?.data?.message || 'Failed to toggle administrator status.', true);
    }
  };

  const openEditModal = (college: PlatformCollege) => {
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

  const openAssignAdminModal = (college: PlatformCollege) => {
    setSelectedCollege(college);
    setAssignAdminForm({ adminName: '', adminEmail: '' });
    setShowAssignAdminModal(true);
  };

  const openViewModal = (college: PlatformCollege) => {
    setSelectedCollege(college);
    setShowViewModal(true);
  };

  // Helper for admin badge styling
  const renderAdminBadge = (status: CollegeAdminStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
          </span>
        );
      case 'PENDING_ACTIVATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-500" /> Pending Activation
          </span>
        );
      case 'INVITATION_EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 text-rose-500" /> Invitation Expired
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
            <Ban className="w-3 h-3 text-red-500" /> Suspended
          </span>
        );
      case 'NOT_ASSIGNED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Not Assigned
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Colleges</span>
            <Building2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Colleges</span>
            <Globe className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.active}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Unassigned</span>
            <UserPlus className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.unassigned}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Invites</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.pendingOrExpired}</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        {/* Top Controls: Title, Search, Filters, Add Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Multi-Tenant Institution Management</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Provision colleges independently, manage administrators, and maintain PostgreSQL RLS tenant boundaries.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition-colors disabled:opacity-50"
              title="Refresh college records"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add College</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by college name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All College Statuses</option>
              <option value="active">Active Colleges Only</option>
              <option value="inactive">Deactivated Colleges Only</option>
            </select>
          </div>

          <div>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Admin Statuses</option>
              <option value="ACTIVE">Admin: Active</option>
              <option value="PENDING_ACTIVATION">Admin: Pending Activation</option>
              <option value="INVITATION_EXPIRED">Admin: Invitation Expired</option>
              <option value="SUSPENDED">Admin: Suspended</option>
              <option value="NOT_ASSIGNED">Admin: Not Assigned</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">College & Code</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">College Status</th>
                <th className="px-4 py-3">College Administrator</th>
                <th className="px-4 py-3">Admin Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                    <span>Loading registered institutions...</span>
                  </td>
                </tr>
              ) : colleges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No colleges found matching the selected filters.</span>
                  </td>
                </tr>
              ) : (
                colleges.map((college) => {
                  const admin = college.admin;
                  const adminStatus: CollegeAdminStatus = admin ? admin.status : 'NOT_ASSIGNED';

                  return (
                    <tr
                      key={college.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Code */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {college.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {college.code}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {college.slug}.4thepeople.in
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {college.city || college.state ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{[college.city, college.state].filter(Boolean).join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Location unassigned</span>
                        )}
                      </td>

                      {/* College Status */}
                      <td className="px-4 py-3.5">
                        {college.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Administrator Info */}
                      <td className="px-4 py-3.5">
                        {admin ? (
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-purple-500" />
                              <span>{admin.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {admin.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No admin assigned</span>
                        )}
                      </td>

                      {/* Admin Account Status */}
                      <td className="px-4 py-3.5">{renderAdminBadge(adminStatus)}</td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* View */}
                          <button
                            onClick={() => openViewModal(college)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="View college details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(college)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit college information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Assign Admin (if unassigned) */}
                          {!admin && (
                            <button
                              onClick={() => openAssignAdminModal(college)}
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                              title="Assign College Administrator"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Resend Invite (if pending or expired) */}
                          {admin && (adminStatus === 'PENDING_ACTIVATION' || adminStatus === 'INVITATION_EXPIRED') && (
                            <button
                              onClick={() => handleResendInvite(admin.id, college.name)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                              title="Resend Activation Invitation"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Suspend / Reactivate Admin */}
                          {admin && (adminStatus === 'ACTIVE' || adminStatus === 'SUSPENDED') && (
                            <button
                              onClick={() => handleToggleAdminStatus(admin.id, admin.isActive, admin.name)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                admin.isActive
                                  ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={admin.isActive ? 'Suspend Administrator' : 'Reactivate Administrator'}
                            >
                              {admin.isActive ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Activate / Deactivate College */}
                          <button
                            onClick={() => handleToggleCollegeStatus(college)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              college.isActive
                                ? 'text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={college.isActive ? 'Deactivate College' : 'Activate College'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Modal 1: Add College (with optional administrator provisioning) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add New Institution
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCollegeSubmit} className="space-y-4">
              {/* College Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    College Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lakireddy Bali Reddy College of Engineering"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    College Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LBRCE"
                    value={addForm.code}
                    onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Official Email & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Official College Email
                  </label>
                  <input
                    type="email"
                    placeholder="contact@institution.ac.in"
                    value={addForm.officialEmail}
                    onChange={(e) => setAddForm({ ...addForm, officialEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={addForm.contactNumber}
                    onChange={(e) => setAddForm({ ...addForm, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Campus Address
                </label>
                <input
                  type="text"
                  placeholder="Mylavaram, Krishna District"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* City & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Vijayawada"
                    value={addForm.city}
                    onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="Andhra Pradesh"
                    value={addForm.state}
                    onChange={(e) => setAddForm({ ...addForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Optional Section: Assign Admin Now */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                  <div>
                    <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Assign College Administrator Now (Optional)
                    </div>
                    <div className="text-[11px] text-purple-700 dark:text-purple-400 mt-0.5">
                      If disabled, only the college is created. You can assign an admin later.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={addForm.assignAdminNow}
                    onChange={(e) => setAddForm({ ...addForm, assignAdminNow: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                </div>

                {addForm.assignAdminNow && (
                  <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 animate-in fade-in">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Administrator Full Name *
                      </label>
                      <input
                        type="text"
                        required={addForm.assignAdminNow}
                        placeholder="Dr. Admin Full Name"
                        value={addForm.adminName}
                        onChange={(e) => setAddForm({ ...addForm, adminName: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Administrator Official Email *
                      </label>
                      <input
                        type="email"
                        required={addForm.assignAdminNow}
                        placeholder="admin@institution.ac.in"
                        value={addForm.adminEmail}
                        onChange={(e) => setAddForm({ ...addForm, adminEmail: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        A secure, single-use activation invitation will be dispatched via Brevo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCollegeMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {createCollegeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{addForm.assignAdminNow ? 'Create College & Send Invite' : 'Create College Only'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 2: Assign College Administrator (Standalone) */}
      {/* ========================================================================= */}
      {showAssignAdminModal && selectedCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign College Administrator
                </h3>
              </div>
              <button
                onClick={() => setShowAssignAdminModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Target Institution
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedCollege.name} ({selectedCollege.code})
              </div>
            </div>

            <form onSubmit={handleAssignAdminSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Administrator Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Admin Full Name"
                  value={assignAdminForm.adminName}
                  onChange={(e) => setAssignAdminForm({ ...assignAdminForm, adminName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Administrator Official Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@institution.ac.in"
                  value={assignAdminForm.adminEmail}
                  onChange={(e) => setAssignAdminForm({ ...assignAdminForm, adminEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  A cryptographically secure activation invitation will be dispatched via Brevo. The account status will be set to <strong>Pending Activation</strong> until the administrator sets their password.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignAdminModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionAdminMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {provisionAdminMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Dispatch Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 3: Edit College Details */}
      {/* ========================================================================= */}
      {showEditModal && selectedCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit College Details
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCollegeSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  College Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={editForm.officialEmail}
                    onChange={(e) => setEditForm({ ...editForm, officialEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={editForm.contactNumber}
                    onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Campus Address
                </label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State
                  </label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCollegeMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {updateCollegeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 4: View Full College Details */}
      {/* ========================================================================= */}
      {showViewModal && selectedCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {selectedCollege.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedCollege.name}
                </h3>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tenant Slug</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{selectedCollege.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">College Status</span>
                  <span>{selectedCollege.isActive ? 'Active' : 'Deactivated'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Official Email</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedCollege.officialEmail || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Contact Phone</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedCollege.contactNumber || 'Not set'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-900 dark:text-white">Assigned College Administrator</div>
                {selectedCollege.admin ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedCollege.admin.name}</span>
                      {renderAdminBadge(selectedCollege.admin.status)}
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">{selectedCollege.admin.email}</div>
                    {selectedCollege.admin.inviteExpiresAt && (
                      <div className="text-[10px] text-slate-400">
                        Invite Expiration: {new Date(selectedCollege.admin.inviteExpiresAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No administrator assigned yet.</div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-[11px] space-y-1 text-purple-900 dark:text-purple-300">
                <div className="font-bold">Domain & Tenancy Endpoints</div>
                <div className="font-mono">Production: https://{selectedCollege.slug}.4thepeople.in</div>
                <div className="font-mono">Local Dev: http://{selectedCollege.slug}.localhost:3000</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

