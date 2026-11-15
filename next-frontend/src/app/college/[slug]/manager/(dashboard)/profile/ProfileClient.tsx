'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useManagerProfileQuery, useUpdateManagerProfileMutation, uploadManagerAvatar, deleteManagerAvatar } from '@/lib/api/manager';
import { queryKeys } from '@/lib/api/queryKeys';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import Chip from '@/components/dashboard/ui/Chip';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import Field, { Input } from '@/components/dashboard/ui/Field';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, eventManager } from '@/lib/copy';

export interface ProfileClientProps {
  slug: string;
}

/**
 * Event Manager profile: avatar + personal info, password & security, account
 * overview. Same manager API hooks as before; presentation moved to the new
 * UI system.
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
      <PageHeader role="eventManager" title={displayName} description={displayEmail || undefined} />

      {/* Avatar + info banner */}
      <DashboardCard>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-28 w-28 rounded-3xl border-4 border-[var(--surface)] object-cover shadow-md" />
              ) : (
                <span aria-hidden="true" className="grid h-28 w-28 place-items-center rounded-3xl bg-[var(--primary)] font-display text-3xl font-black text-white shadow-md shadow-[var(--primary)]/25">
                  {initials}
                </span>
              )}
              <label
                htmlFor="manager-avatar-input"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-3xl bg-black/60 text-xs font-bold text-white transition-opacity hover:opacity-100"
              >
                <Camera aria-hidden="true" className="h-6 w-6" />
              </label>
              <input
                id="manager-avatar-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void handleAvatarUpload(e); e.target.value = ''; }}
                disabled={avatarUploading}
              />
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/80 text-[var(--primary)]">
                  <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <Chip variant="brand">{t.accountRole}</Chip>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)]">{displayName}</h2>
              <p className="text-sm text-[var(--ink-soft)]">{displayEmail}</p>
              <p className="text-xs text-[var(--ink-soft)]">
                {t.managedClubs}: {managedClubs.length}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
            <DashboardButton variant="primary" size="sm" onClick={() => document.getElementById('manager-avatar-input')?.click()} disabled={avatarUploading}>
              <Camera aria-hidden="true" className="h-4 w-4" />
              {t.uploadAvatar}
            </DashboardButton>
            {avatarUrl && (
              <DashboardButton variant="danger" size="sm" onClick={() => setAvatarConfirmOpen(true)} disabled={avatarUploading}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {t.removeAvatar}
              </DashboardButton>
            )}
          </div>
        </div>
      </DashboardCard>

      {/* Personal information */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <span className="font-display text-base font-bold text-[var(--ink)]">{t.personalInfo}</span>
        </div>
        <p className="mt-4 text-xs text-[var(--ink-soft)]">{t.personalInfoHint}</p>
        <form onSubmit={(e) => void handleUpdateName(e)} className="mt-5 max-w-xl space-y-4">
          <Field label={t.fullName} htmlFor="manager-name" required>
            <Input id="manager-name" type="text" value={name} onChange={(e) => setCustomName(e.target.value)} required />
          </Field>
          <Field label="Email Address" htmlFor="manager-email">
            <Input id="manager-email" type="email" value={displayEmail} disabled />
          </Field>
          <div className="flex justify-end">
            <DashboardButton type="submit" variant="primary" loading={updateProfileMutation.isPending}>
              {t.saveChanges}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>

      {/* Security & password */}
      <DashboardCard>
        <div className="flex items-center gap-2 border-b border-[var(--line)] pb-4">
          <span className="font-display text-base font-bold text-[var(--ink)]">{t.security}</span>
        </div>
        <p className="mt-4 text-xs text-[var(--ink-soft)]">{t.securityHint}</p>
        <form onSubmit={(e) => void handleUpdatePassword(e)} className="mt-5 max-w-xl space-y-4">
          <Field label={t.currentPassword} htmlFor="manager-current-password">
            <Input id="manager-current-password" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowCurrentPassword((v) => !v)} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
              {showCurrentPassword ? actions.hidePassword : actions.showPassword}
            </button>
          </div>
          <Field label={t.newPassword} htmlFor="manager-new-password" hint={t.newPasswordHint}>
            <Input id="manager-new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
              {showNewPassword ? actions.hidePassword : actions.showPassword}
            </button>
          </div>
          <Field label={t.confirmPassword} htmlFor="manager-confirm-password">
            <Input id="manager-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
              {showConfirmPassword ? actions.hidePassword : actions.showPassword}
            </button>
          </div>
          {passwordError && (
            <p role="alert" className="rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary-soft)] px-4 py-3 text-xs font-medium text-[var(--secondary)]">
              {passwordError}
            </p>
          )}
          <div className="flex justify-end">
            <DashboardButton type="submit" variant="primary" loading={savingPassword}>
              {t.updatePassword}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>

      {/* Account overview */}
      <DashboardCard>
        <h3 className="font-display text-base font-bold text-[var(--ink)]">{t.accountOverview}</h3>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.managedClubs}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">{managedClubs.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.accountRole}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">{authUser?.role || 'MANAGER'}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{t.joined}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">
              {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
            </p>
          </div>
        </div>

        {managedClubs.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink-soft)]">{t.assignedClubs}</h4>
            <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {managedClubs.map((club) => (
                <li key={club.id}>
                  <Link
                    href={`/college/${slug}/manager/clubs/${club.id}`}
                    className="block truncate rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {club.name}
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
