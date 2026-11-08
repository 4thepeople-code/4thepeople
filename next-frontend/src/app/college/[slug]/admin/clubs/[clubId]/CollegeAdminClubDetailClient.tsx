'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Edit2,
  Trash2,
  UserPlus,
  UserCheck,
  Shield,
  Send,
  CheckCircle,
  AlertCircle,
  Calendar,
  Loader2,
} from 'lucide-react';
import {
  useAdminClubDetailQuery,
  useClubManagersQuery,
  useResendInviteMutation,
  useDeleteMembershipMutation,
  useRequestClubDeletionCodeMutation,
  useDeleteClubMutation,
  type ClubManagerItem,
} from '@/lib/api/admin';
import AdminLayout from '@/components/admin/AdminLayout';
import LoadingSpinner from '@/components/admin/LoadingSpinner';
import ConfirmModal from '@/components/admin/ConfirmModal';
import DeleteOtpModal from '@/components/admin/DeleteOtpModal';
import EditClubModal from '@/components/admin/EditClubModal';
import InviteManagerModal from '@/components/admin/InviteManagerModal';
import AddExistingManagerModal from '@/components/admin/AddExistingManagerModal';

export interface CollegeAdminClubDetailClientProps {
  slug: string;
  clubId: string;
}

export function CollegeAdminClubDetailClient({
  slug,
  clubId,
}: CollegeAdminClubDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [editClubOpen, setEditClubOpen] = useState(false);
  const [inviteManagerOpen, setInviteManagerOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [deleteClubOpen, setDeleteClubOpen] = useState(false);

  const [membershipToRemove, setMembershipToRemove] = useState<ClubManagerItem | null>(null);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const { data: club, isLoading: clubLoading, isError: clubError, refetch: refetchClub } =
    useAdminClubDetailQuery(slug, clubId);

  const { data: managers = [], isLoading: managersLoading, refetch: refetchManagers } =
    useClubManagersQuery(slug, clubId);

  const resendInviteMutation = useResendInviteMutation();
  const deleteMembershipMutation = useDeleteMembershipMutation(slug);
  const requestCodeMutation = useRequestClubDeletionCodeMutation();
  const deleteClubMutation = useDeleteClubMutation(slug);

  const handleRequestDeletionCode = useCallback(async () => {
    return await requestCodeMutation.mutateAsync(clubId);
  }, [clubId, requestCodeMutation]);

  const handleConfirmClubDelete = useCallback(
    async (code: string) => {
      return await deleteClubMutation.mutateAsync({ clubId, code });
    },
    [clubId, deleteClubMutation]
  );

  const showSuccessNotice = (msg: string) => {
    setActionSuccess(msg);
    setActionError('');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleRefresh = () => {
    void refetchClub();
    void refetchManagers();
  };

  const handleResendInvite = async (userId: string) => {
    setResendingUserId(userId);
    setActionError('');
    try {
      await resendInviteMutation.mutateAsync(userId);
      showSuccessNotice('Invitation email resent successfully!');
      handleRefresh();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setActionError(errObj.response?.data?.message || 'Failed to resend invite email.');
    } finally {
      setResendingUserId(null);
    }
  };

  const handleRemoveMembershipConfirm = async () => {
    if (!membershipToRemove) return;
    try {
      await deleteMembershipMutation.mutateAsync(membershipToRemove.id);
      showSuccessNotice('Manager removed from club successfully.');
      setMembershipToRemove(null);
      handleRefresh();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setActionError(errObj.response?.data?.message || 'Failed to remove manager.');
      setMembershipToRemove(null);
    }
  };

  if (clubLoading || managersLoading) {
    return (
      <AdminLayout slug={slug}>
        <LoadingSpinner fullScreen label="Loading club details & manager roster..." />
      </AdminLayout>
    );
  }

  if (clubError || !club) {
    return (
      <AdminLayout slug={slug}>
        <div className="p-8 text-center space-y-4 font-sans">
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded max-w-md mx-auto text-xs">
            Failed to load club details. The record may have been deleted.
          </div>
          <Link
            href={getCanonicalPath('/admin/clubs')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30]"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Clubs List
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const existingManagerUserIds = managers.map((m) => m.user?.id || m.userId).filter(Boolean) as string[];

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-8 max-w-5xl mx-auto font-sans">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-5">
          <div className="flex items-center gap-4">
            <Link
              href={getCanonicalPath('/admin/clubs')}
              className="p-2 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] rounded transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            {club.logo?.url ? (
              <img
                src={club.logo.url}
                alt={club.name}
                className="w-12 h-12 rounded object-cover border border-[#E7E5E4] dark:border-[#2D2C30]"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif font-semibold text-lg">
                {club.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
                {club.name}
              </h1>
              <p className="text-xs text-[#8E8B85]">Club ID: {club.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => setEditClubOpen(true)}
              className="px-3.5 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
              <span>Edit Club</span>
            </button>
            <button
              onClick={() => setDeleteClubOpen(true)}
              className="px-3.5 py-1.5 bg-[#FDF2F2] dark:bg-rose-950/40 hover:bg-[#F9E2E2] text-[#8B3A3A] dark:text-rose-400 text-xs font-medium rounded border border-[#F3CECE] dark:border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Club</span>
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

        {/* Club Information Card */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-4">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#B08D57]" /> Club Information
            </h2>
            <span className="text-xs text-[#6B6966] dark:text-[#A8A5A0] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#8E8B85]" /> Created:{' '}
              {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0]">Affiliation</span>
            <div>
              {club.isCentral ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Central Club (Campus-wide / No department)
                </span>
              ) : Array.isArray(club.departments) && club.departments.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {club.departments.map((d) => (
                    <span
                      key={d.id || d.shortCode}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#FAF9F7] dark:bg-[#252429] text-[#B08D57] border border-[#E7E5E4] dark:border-[#2D2C30]"
                    >
                      {d.name} ({d.shortCode})
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[#8E8B85]">No department affiliation</span>
              )}
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <span className="font-medium text-[#6B6966] dark:text-[#A8A5A0]">Description</span>
            <p className="text-xs sm:text-sm text-[#1C1B1F] dark:text-[#F5F3EF] leading-relaxed">
              {club.description || 'No description available for this club.'}
            </p>
          </div>
        </div>

        {/* Club Managers Section */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#B08D57]" /> Assigned Managers ({managers.length})
              </h2>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Managers have full administrative control over this club</p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <button
                onClick={() => setAddExistingOpen(true)}
                className="px-3.5 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
                <span>Add Existing</span>
              </button>
              <button
                onClick={() => setInviteManagerOpen(true)}
                className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite New</span>
              </button>
            </div>
          </div>

          {managers.length === 0 ? (
            <div className="p-8 text-center bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded text-[#6B6966] dark:text-[#A8A5A0] text-xs">
              No managers assigned to this club yet. Use the actions above to assign one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {managers.map((m) => {
                const u = m.user;
                const uId = u?.id || m.userId;

                return (
                  <div
                    key={m.id}
                    className="bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] p-4 rounded space-y-3 transition-colors flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold shrink-0">
                          {u?.name?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] truncate">
                            {u?.name || 'Pending Invite'}
                          </p>
                          <p className="text-[11px] text-[#8E8B85] truncate">{u?.email || 'No email'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setMembershipToRemove(m)}
                        disabled={deleteMembershipMutation.isPending}
                        className="p-1 text-[#8B3A3A] dark:text-rose-400 hover:bg-[#FDF2F2] dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                        title="Remove Manager"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2D2C30] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#8E8B85]">Role: {m.role}</span>
                      {uId && (
                        <button
                          onClick={() => handleResendInvite(uId)}
                          disabled={resendingUserId === uId}
                          className="text-[11px] text-[#B08D57] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {resendingUserId === uId && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          <Send className="w-2.5 h-2.5" />
                          <span>Resend Invite</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <EditClubModal
          slug={slug}
          isOpen={editClubOpen}
          onClose={() => setEditClubOpen(false)}
          onSuccess={handleRefresh}
          club={club}
        />

        <InviteManagerModal
          slug={slug}
          isOpen={inviteManagerOpen}
          onClose={() => setInviteManagerOpen(false)}
          onSuccess={handleRefresh}
          clubId={clubId}
        />

        <AddExistingManagerModal
          slug={slug}
          isOpen={addExistingOpen}
          onClose={() => setAddExistingOpen(false)}
          onSuccess={handleRefresh}
          clubId={clubId}
          existingManagerIds={existingManagerUserIds}
        />

        <ConfirmModal
          isOpen={!!membershipToRemove}
          onClose={() => setMembershipToRemove(null)}
          onConfirm={handleRemoveMembershipConfirm}
          title="Remove Club Manager"
          message={`Are you sure you want to revoke manager access for ${
            membershipToRemove?.user?.name || 'this manager'
          }? They will no longer be able to manage events or attendees for ${club.name}.`}
          confirmText="Remove Manager"
          isDestructive={true}
          isLoading={deleteMembershipMutation.isPending}
        />

        <DeleteOtpModal
          isOpen={deleteClubOpen}
          onClose={() => setDeleteClubOpen(false)}
          onRequestCode={handleRequestDeletionCode}
          onConfirm={handleConfirmClubDelete}
          title="Delete Club"
          itemType="Club"
          itemName={club.name}
          warningText="This action cannot be undone. All club branding, events, and memberships will be deleted."
          confirmText="Confirm Delete Club"
          onSuccess={() => {
            router.push(getCanonicalPath('/admin/clubs'));
          }}
        />
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminClubDetailClient;
