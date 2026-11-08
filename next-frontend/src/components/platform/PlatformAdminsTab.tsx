'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  usePlatformAdminsQuery,
  useCreatePlatformAdminMutation,
  useUpdatePlatformAdminMutation,
  useResetPlatformAdminTotpMutation,
  useEnrollOwnTotpMutation,
} from '@/lib/api/platform';
import type { PlatformAdminUser } from '@/types/platform';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  QrCode,
} from 'lucide-react';

export function PlatformAdminsTab() {
  const { user } = useAuth();
  const { data: admins = [], isLoading, error, refetch } = usePlatformAdminsQuery();

  const createMutation = useCreatePlatformAdminMutation();
  const updateMutation = useUpdatePlatformAdminMutation();
  const resetTotpMutation = useResetPlatformAdminTotpMutation();
  const enrollTotpMutation = useEnrollOwnTotpMutation();

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<PlatformAdminUser | null>(null);
  const [isSelfEnrollModalOpen, setIsSelfEnrollModalOpen] = useState(false);

  // Add Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // Self TOTP Enroll State
  const [totpData, setTotpData] = useState<{
    otpauthUrl?: string;
    secret?: string;
    liveCode?: string;
    secondsRemaining?: number;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleOpenAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormError(null);
    setCreateSuccessMsg(null);
    setIsAddModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formEmail.trim() || !formPassword) {
      setFormError('All fields are required.');
      return;
    }

    if (formPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await createMutation.mutateAsync({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
      });

      setCreateSuccessMsg(res.message || 'Super-Administrator created successfully.');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setCreateSuccessMsg(null);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create platform administrator';
      setFormError(msg);
    }
  };

  const handleToggleActive = async (admin: PlatformAdminUser) => {
    if (admin.id === user?.id) return; // Cannot toggle self
    try {
      await updateMutation.mutateAsync({
        id: admin.id,
        isActive: !admin.isActive,
      });
    } catch (err) {
      console.error('Failed to toggle admin status', err);
    }
  };

  const handleConfirmResetTotp = async () => {
    if (!resetTargetAdmin) return;
    try {
      await resetTotpMutation.mutateAsync(resetTargetAdmin.id);
      setResetTargetAdmin(null);
    } catch (err) {
      console.error('Failed to reset TOTP', err);
    }
  };

  const handleStartSelfEnroll = async () => {
    setEnrollError(null);
    setEnrollSuccess(false);
    setVerificationCode('');
    try {
      const res = await enrollTotpMutation.mutateAsync();
      setTotpData(res.data || null);
      setIsSelfEnrollModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize TOTP setup';
      setEnrollError(msg);
    }
  };

  const handleConfirmSelfEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);

    if (!verificationCode.trim()) {
      setEnrollError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    try {
      await enrollTotpMutation.mutateAsync({ verificationCode: verificationCode.trim() });
      setEnrollSuccess(true);
      setTimeout(() => {
        setIsSelfEnrollModalOpen(false);
        setTotpData(null);
        setEnrollSuccess(false);
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setEnrollError(msg);
    }
  };

  const handleCopySecret = (secretText: string) => {
    navigator.clipboard.writeText(secretText);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Platform Super-Administrators
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800">
                {admins.length} Total
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Privileged platform operators with root access across all institutional tenants. 
              Protected with per-account TOTP multi-factor authentication.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartSelfEnroll}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>My Authenticator (2FA)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Super-Admin</span>
          </button>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Administrator Accounts Roster
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Only active administrators with enrolled 2FA keys can authenticate to platform endpoints.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh roster"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
            <p className="text-xs">Loading administrators roster...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="text-xs font-semibold">Failed to load platform administrators.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1 text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-xs">No platform administrators registered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Administrator</th>
                  <th className="px-6 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5">2FA / TOTP Security</th>
                  <th className="px-6 py-3.5">Created Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {admins.map((adm) => {
                  const isCurrent = adm.id === user?.id;
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Name & Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                            {adm.name ? adm.name[0] : adm.email[0]}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {adm.name}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {adm.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              adm.isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                adm.isActive ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            {adm.isActive ? 'Active' : 'Disabled'}
                          </span>

                          {!isCurrent && (
                            <button
                              onClick={() => handleToggleActive(adm)}
                              disabled={updateMutation.isPending}
                              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1"
                            >
                              {adm.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* TOTP Status */}
                      <td className="px-6 py-4">
                        {adm.totpEnrolled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Enrolled & Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Pending Enrollment</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(adm.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {!isCurrent && adm.totpEnrolled && (
                          <button
                            onClick={() => setResetTargetAdmin(adm)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors"
                            title="Reset TOTP 2FA secret for lost device"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Reset 2FA</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New Super-Administrator */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-600" />
              <span>Provision Super-Administrator</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add a trusted platform administrator with full multi-tenant governance permissions.
            </p>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {createSuccessMsg && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{createSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Irfan Jan Khan"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. admin@platform.org"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                <span className="font-bold">Security Note:</span> The new administrator must set up two-factor authentication (TOTP) in Google Authenticator or 1Password during their initial login session.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset TOTP */}
      {resetTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Reset 2FA for {resetTargetAdmin.name}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              This will clear the current authenticator secret for <strong className="text-slate-700 dark:text-slate-300">{resetTargetAdmin.email}</strong>. 
              They will be locked out until they complete two-factor enrollment again.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setResetTargetAdmin(null)}
                disabled={resetTotpMutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetTotp}
                disabled={resetTotpMutation.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {resetTotpMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Self-Service TOTP Setup */}
      {isSelfEnrollModalOpen && totpData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-purple-600" />
              <span>Two-Factor Authenticator Setup</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add this key to Google Authenticator, 1Password, or Authy to receive 6-digit login codes.
            </p>

            {enrollError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{enrollError}</span>
              </div>
            )}

            {enrollSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Two-Factor Authentication enrolled and active!</span>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Manual Secret Key (Base32)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={totpData.secret || ''}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopySecret(totpData.secret || '')}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {totpData.liveCode && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold block">
                      Current Live Test Code
                    </span>
                    <span className="text-xl font-mono font-extrabold text-purple-700 dark:text-purple-300 tracking-wider">
                      {totpData.liveCode}
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-500 font-mono">
                    valid ~{totpData.secondsRemaining || 30}s
                  </span>
                </div>
              )}

              <form onSubmit={handleConfirmSelfEnroll} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enter 6-digit Code to Confirm Enrollment
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSelfEnrollModalOpen(false)}
                    disabled={enrollTotpMutation.isPending}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={enrollTotpMutation.isPending || !verificationCode}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {enrollTotpMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Activate 2FA</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformAdminsTab;

