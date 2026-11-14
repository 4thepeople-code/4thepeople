'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, KeyRound, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  usePlatformAdminsQuery,
  useCreatePlatformAdminMutation,
  useUpdatePlatformAdminMutation,
  useResetPlatformAdminTotpMutation,
  useEnrollOwnTotpMutation,
} from '@/lib/api/platform';
import { queryKeys } from '@/lib/api/queryKeys';
import type { PlatformAdminUser } from '@/types/platform';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import Switch from '@/components/dashboard/ui/Switch';
import Modal from '@/components/dashboard/ui/Modal';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import Field, { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/dashboard/ui/DataTable';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, emptyStates, superAdmin } from '@/lib/copy';

/**
 * Super Admin roster: CRUD + TOTP reset + self-service enrollment, all through
 * the existing platform hooks. Resetting 2FA is the one irreversible action —
 * it gets a ConfirmDialog naming the admin and the consequence; account
 * activation is a reversible toggle with Undo.
 */
export default function AdminsClient() {
  const t = superAdmin.admins;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: admins = [], isLoading, isError, refetch } = usePlatformAdminsQuery();

  const createMutation = useCreatePlatformAdminMutation();
  const updateMutation = useUpdatePlatformAdminMutation();
  const resetTotpMutation = useResetPlatformAdminTotpMutation();
  const enrollTotpMutation = useEnrollOwnTotpMutation();

  // Add-admin form
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // TOTP reset confirm
  const [resetTarget, setResetTarget] = useState<PlatformAdminUser | null>(null);

  // Self-service TOTP enrollment
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [totpData, setTotpData] = useState<{
    otpauthUrl?: string;
    secret?: string;
    liveCode?: string;
    secondsRemaining?: number;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleToggleActive = async (admin: PlatformAdminUser) => {
    if (admin.id === user?.id) return;
    const next = !admin.isActive;
    const snapshots = queryClient.getQueriesData<PlatformAdminUser[]>({
      queryKey: queryKeys.platform.admins(),
    });
    queryClient.setQueriesData<PlatformAdminUser[]>({ queryKey: queryKeys.platform.admins() }, (old) =>
      old ? old.map((a) => (a.id === admin.id ? { ...a, isActive: next } : a)) : old,
    );
    try {
      await updateMutation.mutateAsync({ id: admin.id, isActive: next });
      toast(next ? t.toastAdminActivated(admin.name) : t.toastAdminDeactivated(admin.name), {
        variant: 'success',
        durationMs: 7000,
        action: { label: actions.undo, onClick: () => void handleToggleActive(admin) },
      });
    } catch {
      snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast(t.errToggle, { variant: 'error' });
    }
  };

  const openAddModal = () => {
    setForm({ name: '', email: '', password: '' });
    setFormError(null);
    setShowPassword(false);
    setShowAddModal(true);
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError(t.errAllFieldsRequired);
      return;
    }
    if (form.password.length < 8) {
      setFormError(t.errPasswordLength);
      return;
    }
    try {
      const res = await createMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setShowAddModal(false);
      toast(res.message || t.toastAdminCreated, { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(serverMessage || t.errAllFieldsRequired);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    try {
      await resetTotpMutation.mutateAsync(resetTarget.id);
      setResetTarget(null);
      toast(t.toastTotpReset(resetTarget.name), { variant: 'success' });
    } catch {
      toast(t.errTotpReset, { variant: 'error' });
    }
  };

  const handleStartEnroll = async () => {
    setEnrollError(null);
    setVerificationCode('');
    try {
      const res = await enrollTotpMutation.mutateAsync();
      setTotpData(res.data || null);
      setShowEnrollModal(true);
    } catch {
      toast(t.errEnrollStart, { variant: 'error' });
    }
  };

  const handleConfirmEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnrollError(null);
    if (!verificationCode.trim()) {
      setEnrollError(t.errEnrollCode);
      return;
    }
    try {
      await enrollTotpMutation.mutateAsync({ verificationCode: verificationCode.trim() });
      setShowEnrollModal(false);
      setTotpData(null);
      toast(t.toastEnrolled, { variant: 'success' });
    } catch {
      setEnrollError(t.errEnrollInvalid);
    }
  };

  const handleCopySecret = (secret: string) => {
    void navigator.clipboard.writeText(secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const columns: DataTableColumn<PlatformAdminUser>[] = [
    {
      key: 'admin',
      header: t.tableAdmin,
      render: (admin) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] font-display text-sm font-bold text-[var(--on-primary)]"
          >
            {(admin.name || admin.email).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold text-[var(--ink)]">
              {admin.name}
              {admin.id === user?.id && <Chip variant="brand">{t.selfBadge}</Chip>}
            </p>
            <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">{admin.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t.tableStatus,
      render: (admin) => (
        <div className="flex flex-wrap items-center gap-2.5">
          <Switch
            checked={admin.isActive}
            onChange={() => void handleToggleActive(admin)}
            label={admin.isActive ? t.switchDeactivate(admin.name) : t.switchActivate(admin.name)}
            disabled={admin.id === user?.id || updateMutation.isPending}
          />
          {admin.isActive ? (
            <Chip variant="success" dot>
              {t.statusActive}
            </Chip>
          ) : (
            <Chip variant="neutral" dot>
              {t.statusDisabled}
            </Chip>
          )}
          {admin.id === user?.id && (
            <span className="text-[11px] text-[var(--ink-soft)]">{t.selfToggleHint}</span>
          )}
        </div>
      ),
    },
    {
      key: 'totp',
      header: t.tableTotp,
      render: (admin) =>
        admin.totpEnrolled ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            {t.totpEnrolled}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            {t.totpPending}
          </span>
        ),
    },
    {
      key: 'created',
      header: t.tableCreated,
      render: (admin) => (
        <span className="font-mono text-xs text-[var(--ink-soft)]">
          {new Date(admin.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (admin) =>
        admin.id !== user?.id && admin.totpEnrolled ? (
          <DashboardButton
            variant="ghost"
            size="sm"
            onClick={() => setResetTarget(admin)}
            leftIcon={<KeyRound aria-hidden="true" className="h-4 w-4" />}
          >
            {t.reset2fa}
          </DashboardButton>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        role="superAdmin"
        title={t.title}
        description={t.description}
        actions={
          <>
            <DashboardButton
              variant="secondary"
              size="sm"
              onClick={() => void handleStartEnroll()}
              leftIcon={<KeyRound aria-hidden="true" className="h-4 w-4" />}
            >
              {t.myAuthenticator}
            </DashboardButton>
            <DashboardButton size="sm" onClick={openAddModal} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              {t.addAdmin}
            </DashboardButton>
          </>
        }
      />

      <DashboardCard>
        {isError ? (
          <EmptyState
            title={emptyStates.loadingFailed.title}
            description={emptyStates.loadingFailed.description}
          >
            <div className="mt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => refetch()}>
                {actions.retry}
              </DashboardButton>
            </div>
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            rows={admins}
            getRowKey={(admin) => admin.id}
            loading={isLoading}
            loadingLabel={t.title}
            empty={
              <EmptyState
                title={t.emptyTitle}
                description={t.emptyDescription}
                actionLabel={t.addAdmin}
                onAction={openAddModal}
              />
            }
          />
        )}
      </DashboardCard>

      {/* Modal: add a platform admin */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={t.addTitle} description={t.addDescription} size="md">
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <Field label={t.formName} htmlFor="platform-admin-name" required>
            <Input
              id="platform-admin-name"
              placeholder={t.formNamePlaceholder}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t.formEmail} htmlFor="platform-admin-email" required>
            <Input
              id="platform-admin-email"
              type="email"
              placeholder={t.formEmailPlaceholder}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={t.formPassword} htmlFor="platform-admin-password" required hint={t.formPasswordHint}>
            <div className="relative">
              <Input
                id="platform-admin-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? actions.hidePassword : actions.showPassword}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            {t.addDescription}
          </p>
          {formError && (
            <p role="alert" className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
            <DashboardButton variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
              {actions.cancel}
            </DashboardButton>
            <DashboardButton type="submit" size="sm" loading={createMutation.isPending} loadingLabel={t.createAccount}>
              {t.createAccount}
            </DashboardButton>
          </div>
        </form>
      </Modal>

      {/* Confirm: reset 2FA (irreversible — names the admin and the consequence) */}
      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={() => void handleConfirmReset()}
        title={resetTarget ? t.resetTitle(resetTarget.name) : ''}
        confirmLabel={t.reset2fa}
        variant="danger"
        loading={resetTotpMutation.isPending}
      >
        {resetTarget ? t.resetBody(resetTarget.email) : null}
      </ConfirmDialog>

      {/* Modal: self-service 2FA enrollment */}
      <Modal
        open={showEnrollModal && Boolean(totpData)}
        onClose={() => { setShowEnrollModal(false); setTotpData(null); }}
        title={t.enrollTitle}
        description={t.enrollDescription}
        size="md"
      >
        {totpData && (
          <form onSubmit={handleConfirmEnroll} className="space-y-4">
            <Field label={t.enrollSecretLabel} htmlFor="totp-secret">
              <div className="flex gap-2">
                <Input
                  id="totp-secret"
                  readOnly
                  value={totpData.secret || ''}
                  className="select-all font-mono"
                />
                <DashboardButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopySecret(totpData.secret || '')}
                  leftIcon={copiedKey ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                >
                  {copiedKey ? t.copied : t.copy}
                </DashboardButton>
              </div>
            </Field>

            {totpData.liveCode && (
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                    {t.liveCodeLabel}
                  </span>
                  <span className="font-mono text-xl font-bold tracking-widest text-[var(--ink)]">
                    {totpData.liveCode}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-soft)]">
                  {t.liveCodeValid(totpData.secondsRemaining || 30)}
                </span>
              </div>
            )}

            <Field label={t.enrollCodeLabel} htmlFor="totp-code" required error={enrollError ?? undefined}>
              <Input
                id="totp-code"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center font-mono text-lg tracking-widest"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => { setShowEnrollModal(false); setTotpData(null); }}>
                {actions.close}
              </DashboardButton>
              <DashboardButton type="submit" size="sm" loading={enrollTotpMutation.isPending} loadingLabel={t.confirmEnroll}>
                {t.confirmEnroll}
              </DashboardButton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
