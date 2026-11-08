'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Users,
  Building2,
  UserCheck,
  PlusCircle,
  UserPlus,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAllUsersQuery, useAdminClubsQuery } from '@/lib/api/admin';
import AdminLayout from '@/components/admin/AdminLayout';
import StatCard from '@/components/admin/StatCard';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import InviteManagerModal from '@/components/admin/InviteManagerModal';

export interface CollegeAdminDashboardClientProps {
  slug: string;
}

export function CollegeAdminDashboardClient({ slug }: CollegeAdminDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useAllUsersQuery(slug);

  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsError,
    refetch: refetchClubs,
  } = useAdminClubsQuery(slug);

  const loading = usersLoading || clubsLoading;
  const hasError = usersError || clubsError;

  // Deriving metrics
  const totalUsers = users.length;
  const totalClubs = clubs.length;

  const uniqueManagerIds = new Set<string>();
  users.forEach((u) => {
    if (!u.isActive && u.role !== 'COLLEGE_ADMIN') {
      uniqueManagerIds.add(u.id);
    }
    if (u.memberships) {
      u.memberships.forEach((m) => {
        if (m.role === 'MANAGER') uniqueManagerIds.add(u.id);
      });
    }
  });

  const totalManagers = uniqueManagerIds.size;

  const sortedClubs = [...clubs]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const handleRefresh = () => {
    void refetchUsers();
    void refetchClubs();
  };

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-8 font-sans">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-6 sm:p-8 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF] tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6966] dark:text-[#A8A5A0] mt-1">
              Overview of registered students, academic departments, clubs, and manager accounts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
              <span>Invite Manager</span>
            </button>
            <Link
              href={getCanonicalPath('/admin/clubs/create')}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Club</span>
            </Link>
          </div>
        </div>

        {hasError && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Unable to load dashboard data. Please try again.</span>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-[#F9E2E2] dark:bg-rose-900/40 hover:bg-[#F3CECE] rounded text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            title="Total Users & Students"
            value={loading ? '...' : totalUsers}
            icon={Users}
            description="Registered and provisioned campus accounts"
          />
          <StatCard
            title="Total Clubs"
            value={loading ? '...' : totalClubs}
            icon={Building2}
            description="Active recognized student organizations"
          />
          <StatCard
            title="Managers"
            value={loading ? '...' : totalManagers}
            icon={UserCheck}
            description="Assigned and pending club managers"
          />
        </div>

        {/* Recent Clubs & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Clubs List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">
                Recent Clubs
              </h2>
              <Link
                href={getCanonicalPath('/admin/clubs')}
                className="text-xs font-medium text-[#B08D57] hover:text-[#997847] flex items-center gap-1 transition-colors"
              >
                <span>View All</span> <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <LoadingSpinner label="Loading recent clubs..." />
            ) : sortedClubs.length === 0 ? (
              <div className="p-8 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg text-center text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                No clubs created yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left text-sm text-[#1C1B1F] dark:text-[#F5F3EF]">
                  <thead className="bg-[#FAF9F7] dark:bg-[#252429] text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] border-b border-[#E7E5E4] dark:border-[#2D2C30]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Club Name</th>
                      <th className="px-6 py-3 font-medium">Affiliation</th>
                      <th className="px-6 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EFEF] dark:divide-[#2D2C30]">
                    {sortedClubs.map((club) => (
                      <tr key={club.id} className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#252429]/50 transition-colors">
                        <td className="px-6 py-3.5 font-medium flex items-center gap-3">
                          {club.logo?.url ? (
                            <img
                              src={club.logo.url}
                              alt=""
                              className="w-7 h-7 rounded object-cover border border-[#E7E5E4] dark:border-[#2D2C30] shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold shrink-0">
                              {club.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] truncate max-w-xs">
                              {club.name}
                            </div>
                            <div className="text-[11px] font-normal text-[#8E8B85] truncate max-w-xs">
                              {club.description || 'No description provided'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                          {club.isCentral ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Central
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Departmental
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href={getCanonicalPath(`/admin/clubs/${club.id}`)}
                            className="inline-flex items-center text-xs font-medium px-3 py-1 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">
              Quick Actions
            </h2>
            <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-6 rounded-lg space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <button
                onClick={() => router.push(getCanonicalPath('/admin/clubs/create'))}
                className="w-full p-3.5 bg-[#FAF9F7] dark:bg-[#252429] hover:bg-[#F2F0EC] dark:hover:bg-[#2D2C30] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Create New Club
                  </div>
                  <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0] mt-0.5">
                    Establish a new student organization entity.
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8B85]" />
              </button>

              <button
                onClick={() => setInviteModalOpen(true)}
                className="w-full p-3.5 bg-[#FAF9F7] dark:bg-[#252429] hover:bg-[#F2F0EC] dark:hover:bg-[#2D2C30] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Invite Manager
                  </div>
                  <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0] mt-0.5">
                    Send an email invite link for manager setup.
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8B85]" />
              </button>

              <button
                onClick={() => router.push(getCanonicalPath('/admin/roster'))}
                className="w-full p-3.5 bg-[#FAF9F7] dark:bg-[#252429] hover:bg-[#F2F0EC] dark:hover:bg-[#2D2C30] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Upload Student Roster
                  </div>
                  <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0] mt-0.5">
                    Batch-import student accounts via CSV for institutional activation.
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8B85]" />
              </button>

              <button
                onClick={() => router.push(getCanonicalPath('/admin/users'))}
                className="w-full p-3.5 bg-[#FAF9F7] dark:bg-[#252429] hover:bg-[#F2F0EC] dark:hover:bg-[#2D2C30] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Manage All Users
                  </div>
                  <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0] mt-0.5">
                    Search, inspect, or remove system accounts.
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8B85]" />
              </button>
            </div>
          </div>
        </div>

        <InviteManagerModal
          slug={slug}
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSuccess={handleRefresh}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminDashboardClient;
