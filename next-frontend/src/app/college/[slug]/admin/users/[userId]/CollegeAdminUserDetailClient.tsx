'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  Trash2,
  Send,
  CheckCircle,
  Clock,
  Building2,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  useUserDetailQuery,
  useResendInviteMutation,
  useRequestUserDeletionCodeMutation,
  useDeleteUserMutation,
} from '@/lib/api/admin';
import type { Club } from '@/types/models';
import AdminLayout from '@/components/admin/AdminLayout';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import DeleteOtpModal from '@/components/admin/DeleteOtpModal';

export interface CollegeAdminUserDetailClientProps {
  slug: string;
  userId: string;
}

export function CollegeAdminUserDetailClient({
  slug,
  userId,
}: CollegeAdminUserDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const { data: user, isLoading, isError, refetch } = useUserDetailQuery(slug, userId);
  const resendInviteMutation = useResendInviteMutation();
  const requestCodeMutation = useRequestUserDeletionCodeMutation();
  const deleteUserMutation = useDeleteUserMutation(slug);

  const handleResendInvite = async () => {
    setResendSuccess('');
    setErrorMessage('');
    try {
      await resendInviteMutation.mutateAsync(userId);
      setResendSuccess('Invitation email resent successfully!');
      setTimeout(() => setResendSuccess(''), 4000);
      void refetch();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to resend invitation email.');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout slug={slug}>
        <LoadingSpinner fullScreen label="Loading user details..." />
      </AdminLayout>
    );
  }

  if (isError || !user) {
    return (
      <AdminLayout slug={slug}>
        <div className="p-8 text-center space-y-4 font-sans">
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded max-w-md mx-auto text-xs">
            Failed to load user details. The record may have been deleted.
          </div>
          <Link
            href={getCanonicalPath('/admin/users')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30]"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Users List
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const memberships = user.memberships || [];
  const managerMemberships = memberships.filter((m) => m.role === 'MANAGER');

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-8 max-w-5xl mx-auto font-sans">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-5">
          <div className="flex items-center gap-4">
            <Link
              href={getCanonicalPath('/admin/users')}
              className="p-2 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] rounded transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
                  {user.name}
                </h1>
                {managerMemberships.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-300">
                    Club Manager ({managerMemberships.length})
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E8B85]">User ID: {user.id}</p>
            </div>
          </div>

          <button
            onClick={() => setConfirmDeleteOpen(true)}
            className="px-3.5 py-2 bg-[#FDF2F2] dark:bg-rose-950/40 hover:bg-[#F9E2E2] text-[#8B3A3A] dark:text-rose-400 border border-[#F3CECE] dark:border-rose-900/60 text-xs font-medium rounded transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>

        {resendSuccess && (
          <div className="p-4 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-300 rounded text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{resendSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* User Information Card */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-3">
            <UserIcon className="w-4 h-4 text-[#B08D57]" /> Account Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0]">Full Name</span>
              <p className="text-sm font-medium text-[#1C1B1F] dark:text-[#F5F3EF]">{user.name}</p>
            </div>

            <div className="space-y-1">
              <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0] flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#8E8B85]" /> Email Address
              </span>
              <p className="text-sm font-medium text-[#1C1B1F] dark:text-[#F5F3EF]">{user.email}</p>
            </div>

            <div className="space-y-1">
              <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0] flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#8E8B85]" /> System Role
              </span>
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] dark:bg-[#252429] border border-[#D8D7DC] dark:border-[#3D3C40] text-[#4A4950] dark:text-[#D4D1CB]">
                  {user.role}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0]">Status</span>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive
                      ? 'bg-[#EBF3ED] dark:bg-emerald-950/40 text-[#2E5A44] dark:text-emerald-300 border border-[#D1E3D7] dark:border-emerald-900/60'
                      : 'bg-[#FAF4E8] dark:bg-amber-950/40 text-[#8A6421] dark:text-amber-300 border border-[#EEDFA8] dark:border-amber-900/60'
                  }`}
                >
                  {user.isActive ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" /> Active Account
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" /> Invitation Pending
                    </>
                  )}
                </span>

                {!user.isActive && (
                  <button
                    onClick={handleResendInvite}
                    disabled={resendInviteMutation.isPending}
                    className="px-3 py-1 bg-[#B08D57] hover:bg-[#997847] text-white rounded text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {resendInviteMutation.isPending && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    <Send className="w-3 h-3" />
                    <span>Resend Invite</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#8E8B85]" /> Registration Date
              </span>
              <p className="text-xs font-medium text-[#1C1B1F] dark:text-[#F5F3EF]">
                {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Associated Clubs Card */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-3">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#B08D57]" /> Associated Clubs ({memberships.length})
            </h2>
            <span className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Clubs this user is managing or enrolled in</span>
          </div>

          {memberships.length === 0 ? (
            <div className="p-8 text-center bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-[#6B6966] dark:text-[#A8A5A0] text-xs">
              This user is not currently associated with any clubs.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {memberships.map((m) => {
                const club = (m.club || {}) as Partial<Club>;
                const isManager = m.role === 'MANAGER';

                return (
                  <div
                    key={m.id}
                    className="bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] p-4 rounded space-y-3 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif font-semibold text-xs">
                            {club.name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <h3 className="font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] text-xs sm:text-sm">
                            {club.name}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                            isManager
                              ? 'bg-[#F0EFEF] dark:bg-[#1C1B1F] text-[#4A4950] dark:text-[#D4D1CB] border border-[#D8D7DC] dark:border-[#3D3C40]'
                              : 'bg-[#F9F8F6] dark:bg-[#1C1B1F] text-[#6B6966] dark:text-[#A8A5A0] border border-[#E7E5E4] dark:border-[#2D2C30]'
                          }`}
                        >
                          {isManager && <UserCheck className="w-3 h-3 text-[#B08D57]" />}
                          {m.role}
                        </span>
                      </div>

                      <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] line-clamp-2 leading-relaxed">
                        {club.description || 'No description provided for this club.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E7E5E4] dark:border-[#2D2C30] flex items-center justify-between text-xs">
                      <span className="text-[#8E8B85] text-[11px]">
                        Joined: {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                      {club.id && (
                        <Link
                          href={getCanonicalPath(`/admin/clubs/${club.id}`)}
                          className="inline-flex items-center gap-1 font-medium text-[#B08D57] hover:text-[#997847] text-xs transition-colors"
                        >
                          <span>View Club</span> <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Two-Step OTP Delete User Modal */}
        <DeleteOtpModal
          isOpen={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onRequestCode={() => requestCodeMutation.mutateAsync(userId)}
          onConfirm={(code) => deleteUserMutation.mutateAsync({ userId, code })}
          title="Delete User Account"
          itemName={user ? `${user.name} (${user.email})` : ''}
          warningText="This action cannot be undone. All associated memberships will be permanently removed."
          confirmText="Confirm Delete User"
          onSuccess={() => {
            router.push(getCanonicalPath('/admin/users'));
          }}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminUserDetailClient;
