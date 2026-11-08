'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, User as UserIcon, Trash2, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import {
  useAllUsersQuery,
  useRequestUserDeletionCodeMutation,
  useDeleteUserMutation,
} from '@/lib/api/admin';
import type { User } from '@/types/models';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable, { type Column } from '@/components/admin/DataTable';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import EmptyState from '@/components/admin/EmptyState';
import DeleteOtpModal from '@/components/admin/DeleteOtpModal';

export interface CollegeAdminUsersClientProps {
  slug: string;
}

export function CollegeAdminUsersClient({ slug }: CollegeAdminUsersClientProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const { data: users = [], isLoading, isError, refetch } = useAllUsersQuery(slug);
  const requestCodeMutation = useRequestUserDeletionCodeMutation();
  const deleteUserMutation = useDeleteUserMutation(slug);

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

  const columns: Column<User>[] = [
    {
      header: 'User Name',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold shrink-0">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm">
              {user.name}
            </p>
            <p className="text-xs text-[#8E8B85] font-normal">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      render: (user: User) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN'
              ? 'bg-[#F0EFEF] dark:bg-[#252429] text-[#4A4950] dark:text-[#D4D1CB] border border-[#D8D7DC] dark:border-[#3D3C40]'
              : 'bg-[#F9F8F6] dark:bg-[#252429] text-[#6B6966] dark:text-[#A8A5A0] border border-[#E7E5E4] dark:border-[#2D2C30]'
          }`}
        >
          {user.role}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (user: User) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.isActive
              ? 'bg-[#EBF3ED] dark:bg-emerald-950/40 text-[#2E5A44] dark:text-emerald-300 border border-[#D1E3D7] dark:border-emerald-900/60'
              : 'bg-[#FAF4E8] dark:bg-amber-950/40 text-[#8A6421] dark:text-amber-300 border border-[#EEDFA8] dark:border-amber-900/60'
          }`}
        >
          {user.isActive ? 'Active' : 'Pending Invite / Claim'}
        </span>
      ),
    },
    {
      header: 'Created Date',
      render: (user: User) => (
        <span className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (user: User) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={getCanonicalPath(`/admin/users/${user.id}`)}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] rounded transition-colors"
            title="View User Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setUserToDelete(user)}
            className="p-1.5 text-[#8B3A3A] dark:text-rose-400 hover:bg-[#FDF2F2] dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
            title="Delete User"
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
              User Management
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6966] dark:text-[#A8A5A0]">
              View and manage registered accounts, club managers, and student profiles.
            </p>
          </div>
          <button
            onClick={() => void refetch()}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
            <span>Refresh List</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, roll number, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm placeholder-[#A8A5A0] focus:outline-none focus:border-[#B08D57] transition-colors"
          />
        </div>

        {isError && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Unable to load users. Please try again.</span>
            </div>
            <button
              onClick={() => void refetch()}
              className="px-3 py-1 bg-[#F9E2E2] dark:bg-rose-900/40 hover:bg-[#F3CECE] rounded text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner fullScreen label="Loading users..." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={UserIcon}
            title="No users found"
            description={
              search
                ? `No user records matching "${search}".`
                : 'There are currently no registered users in this institution.'
            }
          />
        ) : (
          <DataTable<User> columns={columns} data={filteredUsers} keyField="id" />
        )}

        {/* Two-Step OTP Delete User Modal */}
        <DeleteOtpModal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onRequestCode={() => requestCodeMutation.mutateAsync(userToDelete?.id || '')}
          onConfirm={(code) =>
            deleteUserMutation.mutateAsync({ userId: userToDelete?.id || '', code })
          }
          title="Delete User Account"
          itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : ''}
          warningText="This action cannot be undone. All user data, student activation links, and club memberships will be permanently removed."
          confirmText="Confirm Delete User"
          onSuccess={() => {
            setUserToDelete(null);
            void refetch();
          }}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminUsersClient;
