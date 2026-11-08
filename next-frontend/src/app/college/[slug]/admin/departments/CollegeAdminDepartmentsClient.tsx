'use client';

import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  Edit2,
  Trash2,
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  useDepartments,
  useDeleteDepartmentMutation,
} from '@/lib/api/departments';
import type { Department } from '@/types/models';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable, { type Column } from '@/components/admin/DataTable';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import EmptyState from '@/components/admin/EmptyState';
import ConfirmModal from '@/components/admin/ConfirmModal';
import DepartmentFormModal from '@/components/admin/DepartmentFormModal';
import AssignClubsModal from '@/components/admin/AssignClubsModal';

export interface CollegeAdminDepartmentsClientProps {
  slug: string;
}

export function CollegeAdminDepartmentsClient({ slug }: CollegeAdminDepartmentsClientProps) {
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState<Department | null>(null);
  const [selectedDeptForClubs, setSelectedDeptForClubs] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    data: departments = [],
    isLoading,
    isFetching,
    refetch,
  } = useDepartments(slug);

  const deleteDepartmentMutation = useDeleteDepartmentMutation(slug);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError('');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(''), 6000);
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

  const handleDeleteConfirm = async () => {
    if (!departmentToDelete || deleteDepartmentMutation.isPending) return;
    try {
      await deleteDepartmentMutation.mutateAsync(departmentToDelete.id);
      showSuccess(`Department "${departmentToDelete.name}" deleted successfully.`);
      setDepartmentToDelete(null);
      void refetch();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      showError(errObj.response?.data?.message || 'Failed to delete department. Please try again.');
    }
  };

  const columns: Column<Department>[] = [
    {
      header: 'Department Name',
      render: (dept: Department) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 max-w-sm">
            <p className="font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm truncate">
              {dept.name}
            </p>
            <p className="text-xs text-[#8E8B85] font-normal truncate">
              {dept.description || 'No description provided'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Short Code',
      render: (dept: Department) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-[#FAF9F7] dark:bg-[#252429] text-[#B08D57] border border-[#E7E5E4] dark:border-[#2D2C30]">
          {dept.shortCode || dept.code}
        </span>
      ),
    },
    {
      header: 'Club Count',
      render: (dept: Department) => {
        const count = dept.clubCount ?? dept.clubs?.length ?? 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] dark:bg-[#252429] text-[#4A4950] dark:text-[#D4D1CB] border border-[#D8D7DC] dark:border-[#3D3C40]">
            <Users className="w-3 h-3 text-[#6B6966]" />
            <span>
              {count} {count === 1 ? 'club' : 'clubs'}
            </span>
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      render: (dept: Department) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedDeptForClubs(dept)}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#B08D57] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] rounded transition-colors cursor-pointer"
            title="Assign Clubs"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDeptForEdit(dept);
              setFormModalOpen(true);
            }}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] rounded transition-colors cursor-pointer"
            title="Edit Department"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDepartmentToDelete(dept)}
            className="p-1.5 text-[#8B3A3A] dark:text-rose-400 hover:bg-[#FDF2F2] dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
            title="Delete Department"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-6 font-sans">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF] tracking-tight">
              Academic Departments
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6966] dark:text-[#A8A5A0]">
              Manage academic departments, acronyms, and affiliated student clubs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="px-3.5 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0] ${
                  isFetching ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                setSelectedDeptForEdit(null);
                setFormModalOpen(true);
              }}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Department</span>
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-4 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-300 rounded text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search departments by name, acronym, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm placeholder-[#A8A5A0] focus:outline-none focus:border-[#B08D57] transition-colors"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner fullScreen label="Loading departments..." />
        ) : filteredDepartments.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No departments found"
            description={
              search
                ? `No departments matching "${search}".`
                : 'No academic departments created yet. Establish the first department to affiliate clubs.'
            }
            actionLabel={!search ? 'Create Department' : undefined}
            onAction={() => {
              setSelectedDeptForEdit(null);
              setFormModalOpen(true);
            }}
          />
        ) : (
          <DataTable<Department>
            columns={columns}
            data={filteredDepartments}
            keyField="id"
          />
        )}

        {/* Create / Edit Department Modal */}
        <DepartmentFormModal
          slug={slug}
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setSelectedDeptForEdit(null);
          }}
          department={selectedDeptForEdit}
          onSuccess={() => void refetch()}
        />

        {/* Assign Clubs Modal */}
        <AssignClubsModal
          slug={slug}
          isOpen={!!selectedDeptForClubs}
          onClose={() => setSelectedDeptForClubs(null)}
          department={selectedDeptForClubs}
          onSuccess={() => void refetch()}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!departmentToDelete}
          onClose={() => setDepartmentToDelete(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Department"
          message={`Are you sure you want to delete "${departmentToDelete?.name}"? All affiliated clubs will have their department mapping removed.`}
          confirmText="Delete Department"
          isDestructive={true}
          isLoading={deleteDepartmentMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminDepartmentsClient;
