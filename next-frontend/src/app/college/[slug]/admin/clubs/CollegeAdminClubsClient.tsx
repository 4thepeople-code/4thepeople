'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  Building2,
  PlusCircle,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  useAdminClubsQuery,
  useRequestClubDeletionCodeMutation,
  useDeleteClubMutation,
} from '@/lib/api/admin';
import type { Club } from '@/types/models';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable, { type Column } from '@/components/admin/DataTable';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import EmptyState from '@/components/admin/EmptyState';
import EditClubModal from '@/components/admin/EditClubModal';
import DeleteOtpModal from '@/components/admin/DeleteOtpModal';

export interface CollegeAdminClubsClientProps {
  slug: string;
}

export function CollegeAdminClubsClient({ slug }: CollegeAdminClubsClientProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
  const [clubToEdit, setClubToEdit] = useState<Club | null>(null);

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const { data: clubs = [], isLoading, isError, refetch } = useAdminClubsQuery(slug);
  const requestCodeMutation = useRequestClubDeletionCodeMutation();
  const deleteClubMutation = useDeleteClubMutation(slug);

  const filteredClubs = clubs.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const columns: Column<Club>[] = [
    {
      header: 'Club Name',
      render: (club: Club) => (
        <div className="flex items-center gap-3">
          {club.logo?.url ? (
            <img
              src={club.logo.url}
              alt={club.name}
              className="w-8 h-8 rounded object-cover border border-[#E7E5E4] dark:border-[#2D2C30] shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] font-serif font-semibold text-xs flex items-center justify-center shrink-0">
              {club.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm">
                {club.name}
              </p>
              {club.isCentral && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  Central
                </span>
              )}
              {Array.isArray(club.departments) &&
                club.departments.map((d) => (
                  <span
                    key={d.id || d.shortCode}
                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FAF9F7] dark:bg-[#252429] text-[#B08D57] border border-[#E7E5E4] dark:border-[#2D2C30] uppercase tracking-wider"
                  >
                    {d.shortCode || d.name}
                  </span>
                ))}
            </div>
            <p className="text-xs text-[#8E8B85] font-normal truncate max-w-xs">
              {club.description || 'No description provided'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Members',
      render: (club: Club) => {
        const memberCount = club._count?.members || club.members?.length || club.memberCount || 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] dark:bg-[#252429] text-[#4A4950] dark:text-[#D4D1CB] border border-[#D8D7DC] dark:border-[#3D3C40]">
            <Users className="w-3 h-3 text-[#6B6966]" />
            <span>{memberCount}</span>
          </span>
        );
      },
    },
    {
      header: 'Created',
      render: (club: Club) => (
        <span className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
          {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (club: Club) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={getCanonicalPath(`/admin/clubs/${club.id}`)}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] rounded transition-colors"
            title="Manage Club Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setClubToEdit(club)}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] rounded transition-colors cursor-pointer"
            title="Edit Club Info"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setClubToDelete(club)}
            className="p-1.5 text-[#8B3A3A] dark:text-rose-400 hover:bg-[#FDF2F2] dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
            title="Delete Club"
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF] tracking-tight">
              Clubs Directory
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6966] dark:text-[#A8A5A0]">
              Overview of all active clubs, department affiliations, and managerial assignments.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => void refetch()}
              className="px-3.5 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
              <span>Refresh</span>
            </button>
            <Link
              href={getCanonicalPath('/admin/clubs/create')}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Club</span>
            </Link>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by club name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm placeholder-[#A8A5A0] focus:outline-none focus:border-[#B08D57] transition-colors"
          />
        </div>

        {isError && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Unable to load clubs list. Please try again.</span>
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
          <LoadingSpinner fullScreen label="Loading clubs..." />
        ) : filteredClubs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clubs found"
            description={
              search
                ? `No clubs matching "${search}".`
                : 'No clubs created yet. Get started by establishing a new club.'
            }
            actionLabel={!search ? 'Create Club' : undefined}
            onAction={() => (window.location.href = getCanonicalPath('/admin/clubs/create'))}
          />
        ) : (
          <DataTable<Club> columns={columns} data={filteredClubs} keyField="id" />
        )}

        {/* Edit Club Modal */}
        <EditClubModal
          slug={slug}
          isOpen={!!clubToEdit}
          onClose={() => setClubToEdit(null)}
          onSuccess={() => void refetch()}
          club={clubToEdit}
        />

        {/* Delete Club OTP Confirmation Modal */}
        <DeleteOtpModal
          isOpen={!!clubToDelete}
          onClose={() => setClubToDelete(null)}
          onRequestCode={() => requestCodeMutation.mutateAsync(clubToDelete?.id || '')}
          onConfirm={(code) =>
            deleteClubMutation.mutateAsync({ clubId: clubToDelete?.id || '', code })
          }
          title="Delete Club"
          itemType="Club"
          itemName={clubToDelete?.name}
          warningText="This action cannot be undone. All club branding, events, and memberships will be deleted or verified according to college policy."
          confirmText="Confirm Delete Club"
          onSuccess={() => {
            setClubToDelete(null);
            void refetch();
          }}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminClubsClient;
