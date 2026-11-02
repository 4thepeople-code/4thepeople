import React, { useState, useEffect } from 'react';
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
import { motion } from 'framer-motion';
import {
  useGetDepartmentsQuery,
  useDeleteDepartmentMutation,
} from '../../api/apiSlice';
import DataTable from '../../components/admin/DataTable';
import LoadingSpinner from '../../components/admin/LoadingSpinner';
import EmptyState from '../../components/admin/EmptyState';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DepartmentFormModal from '../../components/admin/DepartmentFormModal';
import AssignClubsModal from '../../components/admin/AssignClubsModal';
import { formatErrorMessage } from '../../utils/errorUtils';

const AdminDepartmentsPage = () => {
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState(null);
  const [selectedDeptForClubs, setSelectedDeptForClubs] = useState(null);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    data: rawData,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useGetDepartmentsQuery();

  const [deleteDepartment, { isLoading: isDeleting }] =
    useDeleteDepartmentMutation();

  useEffect(() => {
    document.title = 'Department Management | 4 THE PEOPLE';
  }, []);

  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setActionError('');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const showError = (msg) => {
    setActionError(msg);
    setTimeout(() => setActionError(''), 6000);
  };

  const departments = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data?.departments)
    ? rawData.data.departments
    : Array.isArray(rawData?.departments)
    ? rawData.departments
    : [];

  const filteredDepartments = departments.filter((d) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      d.name?.toLowerCase().includes(term) ||
      d.shortCode?.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term)
    );
  });

  const handleDeleteConfirm = async () => {
    if (!departmentToDelete || isDeleting) return;
    try {
      await deleteDepartment(departmentToDelete.id).unwrap();
      showSuccess(`Department "${departmentToDelete.name}" deleted successfully.`);
      setDepartmentToDelete(null);
    } catch (err) {
      showError(
        formatErrorMessage(
          err,
          'Failed to delete department. Please try again.'
        )
      );
    }
  };

  const columns = [
    {
      header: 'Department Name',
      render: (dept) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 max-w-sm">
            <p className="font-semibold text-[#1C1B1F] text-xs sm:text-sm truncate">
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
      render: (dept) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-[#FAF9F7] text-[#B08D57] border border-[#E7E5E4]">
          {dept.shortCode}
        </span>
      ),
    },
    {
      header: 'Club Count',
      render: (dept) => {
        const count = dept.clubCount ?? 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] text-[#4A4950] border border-[#D8D7DC]">
            <Users className="w-3 h-3 text-[#6B6966]" />
            <span>{count} {count === 1 ? 'club' : 'clubs'}</span>
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      render: (dept) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedDeptForClubs(dept)}
            className="p-1.5 text-[#6B6966] hover:text-[#B08D57] hover:bg-[#FAF9F7] rounded transition-colors"
            title="Assign Clubs"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDeptForEdit(dept);
              setFormModalOpen(true);
            }}
            className="p-1.5 text-[#6B6966] hover:text-[#1C1B1F] hover:bg-[#FAF9F7] rounded transition-colors"
            title="Edit Department"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDepartmentToDelete(dept)}
            className="p-1.5 text-[#8B3A3A] hover:bg-[#FDF2F2] rounded transition-colors"
            title="Delete Department"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 font-sans"
    >
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#1C1B1F] tracking-tight">
            Academic Departments
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6966]">
            Manage academic departments and their affiliated student clubs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-1.5 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#6B6966] ${
                isFetching ? 'animate-spin' : ''
              }`}
            />{' '}
            Refresh
          </button>
          <button
            onClick={() => {
              setSelectedDeptForEdit(null);
              setFormModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Create Department
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 bg-[#EBF3ED] border border-[#D1E3D7] text-[#2E5A44] rounded text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Error Notification */}
      {(actionError || loadError) && (
        <div className="p-4 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {actionError ||
              formatErrorMessage(loadError, 'Failed to load departments.')}
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search departments by name or short code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-xs placeholder-[#A8A5A0] focus:outline-none transition-colors"
        />
      </div>

      {/* Content Table / Loading / Empty */}
      {isLoading ? (
        <LoadingSpinner label="Loading departments..." />
      ) : filteredDepartments.length === 0 ? (
        <EmptyState
          title={search ? 'No matching departments' : 'No departments registered'}
          description={
            search
              ? `No departments found matching "${search}".`
              : 'Add academic departments to begin categorizing campus clubs.'
          }
          actionText={!search ? 'Create First Department' : undefined}
          onAction={
            !search
              ? () => {
                  setSelectedDeptForEdit(null);
                  setFormModalOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredDepartments} />
      )}

      {/* Department Form Modal (Create & Edit) */}
      <DepartmentFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setSelectedDeptForEdit(null);
        }}
        department={selectedDeptForEdit}
        onSuccess={() => {
          showSuccess(
            selectedDeptForEdit
              ? 'Department updated successfully.'
              : 'Department created successfully.'
          );
        }}
      />

      {/* Assign Clubs Modal */}
      <AssignClubsModal
        isOpen={Boolean(selectedDeptForClubs)}
        onClose={() => setSelectedDeptForClubs(null)}
        department={selectedDeptForClubs}
        onSuccess={() => {
          showSuccess(
            `Clubs assigned to ${selectedDeptForClubs?.name} successfully.`
          );
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(departmentToDelete)}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Academic Department"
        message={`Are you sure you want to delete "${departmentToDelete?.name}"? Only the department is removed, not its clubs.`}
        confirmText="Delete Department"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </motion.div>
  );
};

export default AdminDepartmentsPage;

