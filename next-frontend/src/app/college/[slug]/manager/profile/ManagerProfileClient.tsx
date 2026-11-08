'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import {
  useManagerProfileQuery,
  useUpdateManagerProfileMutation,
  uploadManagerAvatar,
  deleteManagerAvatar,
} from '@/lib/api/manager';
import ManagerLayout from '@/components/manager/ManagerLayout';
import {
  User,
  Mail,
  Shield,
  Key,
  Save,
  CheckCircle,
  AlertCircle,
  Building2,
  Camera,
  Trash2,
  Lock,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

export interface ManagerProfileClientProps {
  slug: string;
}

export function ManagerProfileClient({ slug }: ManagerProfileClientProps) {
  const { isDark } = useTheme();
  const { user: authUser, refreshSession } = useAuth();
  const queryClient = useQueryClient();

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  // Queries
  const { data: profileData } = useManagerProfileQuery(slug);

  // Mutations
  const updateProfileMutation = useUpdateManagerProfileMutation(slug);

  // State
  const [customName, setCustomName] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Avatar State
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const name = customName ?? (profileData?.name || authUser?.name || '');

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
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
      setCustomName(null);
      await refreshSession();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to update profile name.';
      setErrorMessage(message);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setErrorMessage('');
    setAvatarUploading(true);
    try {
      await uploadManagerAvatar(formData);
      showSuccess('Profile picture updated!');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.profile() });
      await refreshSession();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to upload profile picture.';
      setErrorMessage(message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

    setErrorMessage('');
    setAvatarDeleting(true);
    try {
      await deleteManagerAvatar();
      showSuccess('Profile picture removed.');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.profile() });
      await refreshSession();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to remove profile picture.';
      setErrorMessage(message);
    } finally {
      setAvatarDeleting(false);
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

    setSavingPassword(true);
    try {
      await updateProfileMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      showSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to update password.';
      setErrorMessage(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const avatarUrl =
    profileData?.avatar?.url ||
    (authUser?.avatar as { url?: string } | null | undefined)?.url;
  const displayName = profileData?.name || authUser?.name || 'Manager Profile';
  const displayEmail = profileData?.email || authUser?.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();

  const formattedJoinedDate = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Recently';

  const managedClubs = profileData?.managedClubs || [];

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300">
        {/* Header Banner */}
        <div
          className={`rounded-3xl p-6 sm:p-8 border shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 transition-colors ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
          }`}
        >
          {/* Avatar Container with Hover Upload Overlay */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-28 h-28 rounded-3xl object-cover border-4 border-[#FAF9F5] shadow-md group-hover:opacity-90 transition"
              />
            ) : (
              <div className="w-28 h-28 rounded-3xl bg-[#FF5733] flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-3xl shadow-md shadow-[#FF5733]/25">
                {initials}
              </div>
            )}

            {/* Upload Label / Overlay */}
            <label className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold cursor-pointer transition-opacity backdrop-blur-xs">
              <Camera className="w-6 h-6 mb-1" />
              <span>Change Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
                className="hidden"
              />
            </label>

            {avatarUploading && (
              <div className="absolute inset-0 bg-black/80 rounded-3xl flex items-center justify-center text-[#FF5733]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          {/* User Info Header */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Manager Profile Settings</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-3xl font-black uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              {displayName}
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{displayEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF5733]/10 text-[#FF5733] text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Club Manager Access</span>
              </div>
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md cursor-pointer transition">
                <Camera className="w-4 h-4" />
                <span>Upload New Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                  className="hidden"
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={avatarDeleting}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 border text-xs font-extrabold uppercase tracking-wider rounded-full transition cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-rose-500 hover:text-white border-slate-700 text-slate-300'
                      : 'bg-[#FAF9F5] hover:bg-rose-500 hover:text-white border-[#E2E0D5] text-[#64748B]'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove Picture</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Global Success / Error Banners */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Personal Information Form */}
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <div
                className={`flex items-center gap-3 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div className="p-2 bg-[#FF5733]/10 text-[#FF5733] rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    className={`font-['Syne',sans-serif] text-lg font-black uppercase tracking-tight ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Personal Information
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Update your display name
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateName} className="space-y-5">
                <div>
                  <label
                    className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${
                      isDark ? 'text-slate-300' : 'text-[#0F172A]'
                    }`}
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Enter your full name"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#FF5733] border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A] placeholder-slate-400'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${
                      isDark ? 'text-slate-300' : 'text-[#0F172A]'
                    }`}
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={displayEmail}
                      disabled
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-medium cursor-not-allowed border opacity-70 ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-400'
                          : 'bg-[#FAF9F5] border-[#E2E0D5] text-slate-500'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Email address is managed by the server system admin.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Profile Name</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Password & Security Form */}
            <div
              className={`rounded-3xl p-6 lg:p-8 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <div
                className={`flex items-center gap-3 border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-[#E8E6DF]'
                }`}
              >
                <div className="p-2 bg-[#2563EB]/10 text-[#2563EB] rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    className={`font-['Syne',sans-serif] text-lg font-black uppercase tracking-tight ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Security & Password
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Change account password
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#2563EB] border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A] placeholder-slate-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#2563EB] border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A] placeholder-slate-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${
                        isDark ? 'text-slate-300' : 'text-[#0F172A]'
                      }`}
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#2563EB] border ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A] placeholder-slate-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F172A] hover:bg-[#2563EB] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right 1 Column: Account Summary Card */}
          <div className="space-y-6">
            <div
              className={`rounded-3xl p-6 shadow-sm space-y-6 border ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-[#E2E0D5]'
              }`}
            >
              <h3
                className={`font-['Syne',sans-serif] text-base font-black uppercase border-b pb-3 ${
                  isDark ? 'text-white border-white/10' : 'text-[#0F172A] border-[#E8E6DF]'
                }`}
              >
                Account Overview
              </h3>

              <div className="space-y-4">
                <div
                  className={`flex items-center justify-between p-3 rounded-2xl border ${
                    isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <Building2 className="w-4 h-4 text-[#FF5733]" />
                    <span>Managed Clubs</span>
                  </div>
                  <span
                    className={`font-['Syne',sans-serif] text-base font-black ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {managedClubs.length}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-between p-3 rounded-2xl border ${
                    isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <Shield className="w-4 h-4 text-[#2563EB]" />
                    <span>Account Role</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-full">
                    {authUser?.role || 'MANAGER'}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-between p-3 rounded-2xl border ${
                    isDark ? 'bg-slate-900 border-white/10' : 'bg-[#FAF9F5] border-[#E2E0D5]'
                  }`}
                >
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>Joined</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {formattedJoinedDate}
                  </span>
                </div>
              </div>

              {managedClubs.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                    Assigned Clubs
                  </h4>
                  <div className="space-y-2">
                    {managedClubs.map((club) => (
                      <Link
                        key={club.id}
                        href={getPath(`/manager/clubs/${club.id}`)}
                        className={`block p-3 rounded-2xl border text-xs font-bold truncate transition hover:border-[#FF5733] ${
                          isDark
                            ? 'bg-slate-900 border-white/10 text-white'
                            : 'bg-[#FAF9F5] border-[#E2E0D5] text-[#0F172A]'
                        }`}
                      >
                        {club.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

export default ManagerProfileClient;
