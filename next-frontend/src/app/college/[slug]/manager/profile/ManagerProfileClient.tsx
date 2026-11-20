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
  CheckCircle2,
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
  ChevronRight,
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
        {/* Header Navigation & Title */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)] border border-[var(--primary)]/20">
                {slug ? slug.toUpperCase() : 'CAMPUS'}
              </span>
              <span className="text-xs font-semibold text-[var(--ink-soft)]">Manager Account</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
              Profile & Security Settings
            </h1>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
              Manage your personal details, manager credentials, password security, and active club assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={getPath('/manager')}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 cursor-pointer shadow-xs"
            >
              <Building2 className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </div>
        </header>

        {/* Global Success / Error Alerts */}
        {successMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Profile Hero Card */}
        <section
          aria-label="Profile Banner"
          className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center md:items-start gap-6 transition-colors"
        >
          {/* Avatar Container with Hover Upload Overlay */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-[var(--line)] shadow-xs group-hover:opacity-90 transition"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] font-display font-bold text-3xl flex items-center justify-center border border-[var(--primary)]/20 shadow-xs">
                {initials}
              </div>
            )}

            {/* Upload Label / Overlay */}
            <label className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold cursor-pointer transition-opacity backdrop-blur-xs">
              <Camera className="w-6 h-6 mb-1 text-white" />
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
              <div className="absolute inset-0 bg-black/80 rounded-2xl flex items-center justify-center text-[var(--primary)]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          {/* User Info Header */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-[10px] font-bold uppercase tracking-wider border border-[var(--primary)]/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Event & Club Manager Workspace</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
              {displayName}
            </h2>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-[var(--ink-soft)] pt-1">
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[var(--ink-soft)]" />
                <span>{displayEmail}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[var(--ink-soft)]" />
                <span>Manager since {formattedJoinedDate}</span>
              </div>
            </div>

            {/* Photo Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-3">
              <label className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--primary-strong)] shadow-xs cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>{avatarUrl ? 'Update Picture' : 'Upload Picture'}</span>
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
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{avatarDeleting ? 'Removing...' : 'Remove Picture'}</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Personal Information Form */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="p-2.5 bg-[var(--primary-soft)] text-[var(--primary)] rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                    Personal Information
                  </h3>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Update your display name visible across your managed clubs and events
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateName} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                    <input
                      type="email"
                      value={displayEmail}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 text-xs font-medium text-[var(--ink-soft)] opacity-80 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ink-soft)] mt-1.5">
                    Email address is managed by your institutional administrator.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--primary-strong)] shadow-xs disabled:opacity-50 cursor-pointer"
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
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
                <div className="p-2.5 bg-[var(--secondary-soft)] text-[var(--secondary)] rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
                    Security & Password
                  </h3>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Change your manager account login password
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs font-medium text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
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
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--primary)] hover:text-white px-5 py-2.5 text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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

          {/* Right 1 Column: Account Overview */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs space-y-6">
              <div className="border-b border-[var(--line)] pb-3">
                <h3 className="font-display text-base font-bold tracking-tight text-[var(--ink)]">
                  Account Overview
                </h3>
                <p className="text-xs text-[var(--ink-soft)] mt-0.5">Summary & permissions</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
                  <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--ink-soft)]">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span>Managed Clubs</span>
                  </div>
                  <span className="font-display text-base font-bold text-[var(--ink)]">
                    {managedClubs.length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
                  <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--ink-soft)]">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--secondary-soft)] text-[var(--secondary)]">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span>Account Role</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[var(--primary)] bg-[var(--primary-soft)] px-2.5 py-0.5 rounded-full border border-[var(--primary)]/20">
                    {authUser?.role || 'MANAGER'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
                  <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--ink-soft)]">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span>Member Since</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {formattedJoinedDate}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--line)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                    Assigned Clubs ({managedClubs.length})
                  </h4>
                  <Link
                    href={getPath('/manager/clubs')}
                    className="text-xs font-bold text-[var(--primary)] hover:underline"
                  >
                    View all
                  </Link>
                </div>

                {managedClubs.length > 0 ? (
                  <div className="space-y-2">
                    {managedClubs.map((club) => (
                      <Link
                        key={club.id}
                        href={getPath(`/manager/clubs/${club.id}`)}
                        className="group flex items-center justify-between p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary-soft)]/20 transition-all text-xs font-bold text-[var(--ink)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--primary)]">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate group-hover:text-[var(--primary)] transition-colors">
                            {club.name}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--ink-soft)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] text-center text-xs text-[var(--ink-soft)]">
                    No managed clubs assigned yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

export default ManagerProfileClient;
