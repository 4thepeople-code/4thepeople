'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import {
  useManagerProfileQuery,
  useUpdateManagerProfileMutation,
  uploadManagerAvatar,
  deleteManagerAvatar,
} from '@/lib/api/manager';
import { queryKeys } from '@/lib/api/queryKeys';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import Chip from '@/components/dashboard/ui/Chip';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import Field, { Input } from '@/components/dashboard/ui/Field';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, eventManager, roleNames } from '@/lib/copy';

export interface ProfileClientProps {
  slug: string;
}

/**
 * Event Manager profile: avatar + personal info, password & security, account
 * overview. Styled to mirror the homepage's visual hierarchy, typography, and tokens.
 */
export default function ProfileClient({ slug }: ProfileClientProps) {
  const t = eventManager.managerProfile;
  const { toast } = useToast();
  const { user: authUser, refreshSession } = useAuth();
  const queryClient = useQueryClient();

  const { data: profileData } = useManagerProfileQuery(slug);
  const updateProfileMutation = useUpdateManagerProfileMutation(slug);

  const [customName, setCustomName] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);
  const [avatarConfirmOpen, setAvatarConfirmOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const name = customName ?? (profileData?.name || authUser?.name || '');
  const avatarUrl = profileData?.avatar?.url || (authUser?.avatar as { url?: string } | null | undefined)?.url;
  const displayName = profileData?.name || authUser?.name || 'Manager Profile';
  const displayEmail = profileData?.email || authUser?.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const managedClubs = profileData?.managedClubs || [];

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({ name: name.trim() });
      toast(t.toastNameSaved, { variant: 'success' });
      setCustomName(null);
      await refreshSession();
    } catch (err: unknown) {
      toast(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t.errNameUpdate,
        { variant: 'error' },
      );
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setAvatarUploading(true);
      await uploadManagerAvatar(formData);
      toast(t.toastAvatarUploaded, { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.profile() });
      await refreshSession();
    } catch (err: unknown) {
      toast(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t.errAvatarUpload,
        { variant: 'error' },
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarDeleting(true);
    try {
      await deleteManagerAvatar();
      toast(t.toastAvatarRemoved, { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.profile() });
      await refreshSession();
    } catch (err: unknown) {
      toast(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t.errAvatarRemove,
        { variant: 'error' },
      );
    } finally {
      setAvatarDeleting(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError(t.errCurrentRequired);
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError(t.errNewLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t.errMismatch);
      return;
    }

    setSavingPassword(true);
    try {
      await updateProfileMutation.mutateAsync({ currentPassword, newPassword });
      toast(t.toastPasswordUpdated, { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t.errPasswordUpdate,
        { variant: 'error' },
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
            {roleNames.eventManager}
          </span>
          {slug && (
            <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
              {slug.toUpperCase()}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-4xl">
          Manager <span className="italic font-bold text-[var(--primary)]">Profile</span>
        </h1>
        <p className="mt-1.5 text-xs text-[var(--ink-soft)] sm:text-sm">
          {displayEmail || 'Manage your account credentials, avatar, and assigned clubs.'}
        </p>
      </header>

      {/* Avatar + Info Banner Card */}
      <DashboardCard>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-24 w-24 rounded-3xl border-4 border-[var(--surface)] object-cover shadow-md"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-24 w-24 place-items-center rounded-3xl bg-[var(--primary)] font-display text-2xl font-bold text-[var(--on-primary)] shadow-md"
                >
                  {initials}
                </span>
              )}
              <label
                htmlFor="manager-avatar-input"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-3xl bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100"
                aria-label={t.uploadAvatar}
              >
                <Camera aria-hidden="true" className="h-6 w-6" />
              </label>
              <input
                id="manager-avatar-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleAvatarUpload(e);
                  e.target.value = '';
                }}
                disabled={avatarUploading}
              />
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/80 text-[var(--primary)]">
                  <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Chip variant="brand">{t.accountRole}</Chip>
                <Chip variant="neutral">{managedClubs.length} {managedClubs.length === 1 ? 'Club' : 'Clubs'}</Chip>
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
                {displayName}
              </h2>
              <p className="text-xs text-[var(--ink-soft)]">{displayEmail}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-end">
            <DashboardButton
              variant="primary"
              size="sm"
              onClick={() => document.getElementById('manager-avatar-input')?.click()}
              disabled={avatarUploading}
              leftIcon={<Camera aria-hidden="true" className="h-4 w-4" />}
            >
              {t.uploadAvatar}
            </DashboardButton>
            {avatarUrl && (
              <DashboardButton
                variant="danger"
                size="sm"
                onClick={() => setAvatarConfirmOpen(true)}
                disabled={avatarUploading}
                leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              >
                {t.removeAvatar}
              </DashboardButton>
            )}
          </div>
        </div>
      </DashboardCard>

      {/* Personal Information */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <UserIcon aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.personalInfo}</h2>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-soft)]">{t.personalInfoHint}</p>

        <form onSubmit={(e) => void handleUpdateName(e)} className="mt-5 max-w-xl space-y-4">
          <Field label={t.fullName} htmlFor="manager-name" required>
            <Input
              id="manager-name"
              type="text"
              value={name}
              onChange={(e) => setCustomName(e.target.value)}
              required
            />
          </Field>

          <Field label="Email Address" htmlFor="manager-email" hint="Contact your College Administrator to update your official login email.">
            <Input id="manager-email" type="email" value={displayEmail} disabled />
          </Field>

          <div className="flex justify-end pt-2">
            <DashboardButton type="submit" variant="primary" size="sm" loading={updateProfileMutation.isPending}>
              {t.saveChanges}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>

      {/* Security & Password */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <Lock aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.security}</h2>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-soft)]">{t.securityHint}</p>

        <form onSubmit={(e) => void handleUpdatePassword(e)} className="mt-5 max-w-xl space-y-4">
          <Field label={t.currentPassword} htmlFor="manager-current-password">
            <div className="relative">
              <Input
                id="manager-current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                aria-label={showCurrentPassword ? actions.hidePassword : actions.showPassword}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label={t.newPassword} htmlFor="manager-new-password" hint={t.newPasswordHint}>
            <div className="relative">
              <Input
                id="manager-new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                aria-label={showNewPassword ? actions.hidePassword : actions.showPassword}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label={t.confirmPassword} htmlFor="manager-confirm-password">
            <div className="relative">
              <Input
                id="manager-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                aria-label={showConfirmPassword ? actions.hidePassword : actions.showPassword}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {passwordError && (
            <p role="alert" className="rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] p-3 text-xs font-medium text-[var(--secondary)]">
              {passwordError}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <DashboardButton type="submit" variant="primary" size="sm" loading={savingPassword}>
              {t.updatePassword}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>

      {/* Account Overview & Assigned Clubs */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <Shield aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.accountOverview}</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.managedClubs}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">{managedClubs.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.accountRole}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">{authUser?.role || 'MANAGER'}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.joined}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">
              {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
            </p>
          </div>
        </div>

        {managedClubs.length > 0 && (
          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.assignedClubs}</h3>
            <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {managedClubs.map((club) => (
                <li key={club.id}>
                  <Link
                    href={`/college/${slug}/manager/clubs/${club.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/50 p-3.5 transition-colors hover:border-[var(--primary)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="h-4 w-4 text-[var(--primary)] shrink-0" />
                      <span className="truncate text-xs font-bold text-[var(--ink)]">{club.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--primary)]">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {managedClubs.length === 0 && (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-6 text-center text-xs text-[var(--ink-soft)]">
            {t.noAssignedClubs}
          </p>
        )}
      </DashboardCard>

      {/* Remove Avatar Confirmation */}
      <ConfirmDialog
        open={avatarConfirmOpen}
        onClose={() => setAvatarConfirmOpen(false)}
        onConfirm={() => void handleAvatarDelete()}
        title={t.removeAvatar}
        confirmLabel={t.removeAvatar}
        variant="danger"
        loading={avatarDeleting}
      >
        {t.avatarRemoveBody ?? t.errAvatarRemove}
      </ConfirmDialog>
    </div>
  );
}
