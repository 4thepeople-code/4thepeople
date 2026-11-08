'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  User as UserIcon,
  Mail,
  Key,
  Save,
  CheckCircle,
  AlertCircle,
  Camera,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useAdminProfileQuery,
  useUpdateAdminProfileMutation,
  useUploadAdminAvatarMutation,
  useDeleteAdminAvatarMutation,
} from '@/lib/api/admin';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import LoadingSpinner from '@/components/admin/LoadingSpinner';

export interface CollegeAdminProfileClientProps {
  slug: string;
}

export function CollegeAdminProfileClient({ slug }: CollegeAdminProfileClientProps) {
  const { user: authUser, refreshSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: profile, isLoading } = useAdminProfileQuery(slug);
  const updateProfileMutation = useUpdateAdminProfileMutation(slug);
  const uploadAvatarMutation = useUploadAdminAvatarMutation(slug);
  const deleteAvatarMutation = useDeleteAdminAvatarMutation(slug);

  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    } else if (authUser?.name) {
      setName(authUser.name);
    }
  }, [profile, authUser]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ name: name.trim() });
      showSuccess('Profile name updated successfully!');
      void refreshSession();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to update profile name.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ currentPassword, newPassword });
      showSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to update password.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);
    setErrorMessage('');

    try {
      await uploadAvatarMutation.mutateAsync(formData);
      showSuccess('Profile picture updated successfully!');
      void refreshSession();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to upload profile picture.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    setErrorMessage('');

    try {
      await deleteAvatarMutation.mutateAsync();
      showSuccess('Profile picture removed successfully!');
      void refreshSession();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to remove profile picture.');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout slug={slug}>
        <LoadingSpinner fullScreen label="Loading administrator profile..." />
      </AdminLayout>
    );
  }

  const avatarUrl = profile?.avatar?.url || (authUser?.avatar as { url?: string })?.url;
  const initials = (profile?.name || authUser?.name || 'A').slice(0, 2).toUpperCase();

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-8 max-w-5xl mx-auto font-sans">
        {/* Header Profile Banner */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-6 sm:p-8 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.name || 'Admin'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#E7E5E4] dark:border-[#2D2C30]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#FAF9F7] dark:bg-[#252429] border-2 border-[#E7E5E4] dark:border-[#2D2C30] flex items-center justify-center text-[#B08D57] font-serif text-2xl font-normal">
                  {initials}
                </div>
              )}
              {uploadAvatarMutation.isPending && (
                <div className="absolute inset-0 rounded-full bg-white/80 dark:bg-black/80 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-[#B08D57] animate-spin" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
                  {profile?.name || authUser?.name || 'Administrator'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#FAF9F7] dark:bg-[#252429] text-[#B08D57] border border-[#E7E5E4] dark:border-[#2D2C30]">
                  {profile?.role || authUser?.role || 'COLLEGE_ADMIN'}
                </span>
              </div>
              <p className="text-xs text-[#8E8B85] mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{profile?.email || authUser?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatarMutation.isPending}
              className="px-3.5 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#6B6966] dark:text-[#A8A5A0]" />
              <span>Change Photo</span>
            </button>
            {avatarUrl && (
              <button
                onClick={handleAvatarDelete}
                disabled={deleteAvatarMutation.isPending}
                className="px-3.5 py-2 bg-[#FDF2F2] dark:bg-rose-950/40 hover:bg-[#F9E2E2] text-[#8B3A3A] dark:text-rose-400 text-xs font-medium rounded border border-[#F3CECE] dark:border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="p-4 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-300 rounded text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* General Information */}
          <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-3">
              <UserIcon className="w-4 h-4 text-[#B08D57]" /> General Information
            </h2>

            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Institutional Email
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || authUser?.email || ''}
                  className="w-full px-3 py-2 bg-[#F7F6F2] dark:bg-[#252429] border border-[#E2E0D8] dark:border-[#3D3C40] rounded text-[#8E8B85] text-sm cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-[#8E8B85]">
                  Institutional email address is bound to campus DNS identity and cannot be edited.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending || !name.trim()}
                  className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {updateProfileMutation.isPending ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Profile
                </button>
              </div>
            </form>
          </div>

          {/* Security & Password */}
          <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-3">
              <Key className="w-4 h-4 text-[#B08D57]" /> Password & Security
            </h2>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm focus:outline-none transition-colors"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending || !currentPassword || !newPassword}
                  className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {updateProfileMutation.isPending ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminProfileClient;
