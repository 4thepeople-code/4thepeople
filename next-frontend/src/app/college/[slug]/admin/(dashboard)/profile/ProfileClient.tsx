'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, KeyRound, Loader2, Trash2, UserRound } from 'lucide-react';
import {
  useAdminProfileQuery,
  useUpdateAdminProfileMutation,
  useUploadAdminAvatarMutation,
  useDeleteAdminAvatarMutation,
} from '@/lib/api/admin';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import Field, { Input } from '@/components/dashboard/ui/Field';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { useToast } from '@/components/dashboard/ui/Toast';
import { collegeAdmin } from '@/lib/copy';

export interface ProfileClientProps {
  slug: string;
}

/**
 * College Admin profile: avatar (upload + ConfirmDialog-guarded removal),
 * display name and password forms. Same hooks as before; avatar/name changes
 * refresh the session exactly like the old client did.
 */
export default function ProfileClient({ slug }: ProfileClientProps) {
  const t = collegeAdmin.profile;
  const { toast } = useToast();
  const { user: authUser, refreshSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

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

  const handleError = (err: unknown, fallback: string) => {
    const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
    toast(serverMessage || fallback, { variant: 'error' });
  };

  const handleUpdateName = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast(t.errNameEmpty, { variant: 'error' });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ name: name.trim() });
      toast(t.toastProfileSaved, { variant: 'success' });
      void refreshSession();
    } catch (err: unknown) {
      handleError(err, t.errNameEmpty);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPassword) {
      toast(t.errCurrentRequired, { variant: 'error' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast(t.errNewLength, { variant: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t.errMismatch, { variant: 'error' });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ currentPassword, newPassword });
      toast(t.toastPasswordSaved, { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      handleError(err, t.errCurrentRequired);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await uploadAvatarMutation.mutateAsync(formData);
      toast(t.toastAvatarUploaded, { variant: 'success' });
      void refreshSession();
    } catch (err: unknown) {
      handleError(err, t.toastAvatarUploaded);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    setConfirmRemoveOpen(false);
    try {
      await deleteAvatarMutation.mutateAsync();
      toast(t.toastAvatarRemoved, { variant: 'success' });
      void refreshSession();
    } catch (err: unknown) {
      handleError(err, t.toastAvatarRemoved);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6" role="status" aria-label={t.loadingLabel}>
        <SkeletonLines count={3} />
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonLines count={5} />
          <SkeletonLines count={5} />
        </div>
      </div>
    );
  }

  const avatarUrl = profile?.avatar?.url || (authUser?.avatar as { url?: string })?.url;
  const initials = (profile?.name || authUser?.name || 'A').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader role="collegeAdmin" title={t.title} />

      {/* Identity banner */}
      <DashboardCard>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={profile?.name || 'College Admin'}
                  className="h-16 w-16 rounded-full border-2 border-[var(--line)] object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--line)] bg-[var(--bg)] font-display text-xl font-bold text-[var(--primary)]"
                >
                  {initials}
                </span>
              )}
              {uploadAvatarMutation.isPending && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-[var(--surface)]/80">
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-[var(--primary)] motion-reduce:animate-none" />
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-[var(--ink)]">
                  {profile?.name || authUser?.name}
                </h2>
                <Chip variant="brand">
                  {profile?.role || authUser?.role || 'COLLEGE_ADMIN'}
                </Chip>
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--ink-soft)]">
                {profile?.email || authUser?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatarMutation.isPending}
              leftIcon={<Camera aria-hidden="true" className="h-4 w-4" />}
            >
              {t.changePhoto}
            </DashboardButton>
            {avatarUrl && (
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setConfirmRemoveOpen(true)}
                loading={deleteAvatarMutation.isPending}
                loadingLabel={t.removePhoto}
                leftIcon={deleteAvatarMutation.isPending ? undefined : <Trash2 aria-hidden="true" className="h-4 w-4" />}
              >
                {t.removePhoto}
              </DashboardButton>
            )}
          </div>
        </div>
      </DashboardCard>

      {/* Forms */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* General information */}
        <DashboardCard>
          <h2 className="flex items-center gap-2 border-b border-[var(--line)] pb-3 font-display text-base font-bold text-[var(--ink)]">
            <UserRound aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
            {t.generalInfo}
          </h2>

          <form onSubmit={handleUpdateName} className="mt-5 space-y-4">
            <Field label={t.formName} htmlFor="profile-name" required>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updateProfileMutation.isPending}
              />
            </Field>

            <Field label={t.formEmail} htmlFor="profile-email" hint={t.formEmailHint}>
              <Input
                id="profile-email"
                type="email"
                disabled
                value={profile?.email || authUser?.email || ''}
                className="cursor-not-allowed bg-[var(--bg)] text-[var(--ink-soft)]"
              />
            </Field>

            <div className="flex justify-end border-t border-[var(--line)] pt-4">
              <DashboardButton
                type="submit"
                size="sm"
                loading={updateProfileMutation.isPending}
                loadingLabel={t.saveProfile}
                disabled={!name.trim()}
              >
                {t.saveProfile}
              </DashboardButton>
            </div>
          </form>
        </DashboardCard>

        {/* Password */}
        <DashboardCard>
          <h2 className="flex items-center gap-2 border-b border-[var(--line)] pb-3 font-display text-base font-bold text-[var(--ink)]">
            <KeyRound aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
            {t.security}
          </h2>

          <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
            <Field label={t.currentPassword} htmlFor="profile-current-password" required>
              <Input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={updateProfileMutation.isPending}
              />
            </Field>

            <Field
              label={t.newPassword}
              htmlFor="profile-new-password"
              required
              hint={t.newPasswordHint}
            >
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={updateProfileMutation.isPending}
              />
            </Field>

            <Field label={t.confirmPassword} htmlFor="profile-confirm-password" required>
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={updateProfileMutation.isPending}
              />
            </Field>

            <div className="flex justify-end border-t border-[var(--line)] pt-4">
              <DashboardButton
                type="submit"
                size="sm"
                loading={updateProfileMutation.isPending}
                loadingLabel={t.updatePassword}
                disabled={!currentPassword || !newPassword}
              >
                {t.updatePassword}
              </DashboardButton>
            </div>
          </form>
        </DashboardCard>
      </div>

      {/* Avatar removal — names the object and consequence */}
      <ConfirmDialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={() => void handleAvatarRemove()}
        title={t.confirmRemoveTitle}
        confirmLabel={t.removePhoto}
        loading={deleteAvatarMutation.isPending}
      >
        {t.confirmRemoveBody}
      </ConfirmDialog>
    </div>
  );
}
