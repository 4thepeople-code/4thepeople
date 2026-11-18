'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  History,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Check,
} from 'lucide-react';
import {
  useCollegePaymentConfigQuery,
  useUpdateCollegePaymentConfigMutation,
  useTestPaymentConnectionMutation,
  useCollegePaymentAuditsQuery,
} from '@/lib/api/platform';
import type { PlatformCollege } from '@/types/platform';
import type {
  PaymentGatewayProvider,
  CollegePaymentMode,
  PaymentConfigStatus,
  UpdatePaymentConfigPayload,
} from '@/types/payment';

export interface CollegePaymentConfigModalProps {
  isOpen: boolean;
  college: PlatformCollege | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export default function CollegePaymentConfigModal({
  isOpen,
  college,
  onClose,
  onSuccess,
}: CollegePaymentConfigModalProps) {
  const collegeId = college?.id || '';

  // Tab State
  const [activeTab, setActiveTab] = useState<'config' | 'audit'>('config');

  // Queries
  const {
    data: config,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useCollegePaymentConfigQuery(collegeId, isOpen && Boolean(collegeId));

  const {
    data: audits = [],
    isLoading: auditsLoading,
    refetch: refetchAudits,
  } = useCollegePaymentAuditsQuery(collegeId, isOpen && Boolean(collegeId) && activeTab === 'audit');

  // Mutations
  const updateConfigMutation = useUpdateCollegePaymentConfigMutation();
  const testConnectionMutation = useTestPaymentConnectionMutation();

  // Form State
  const [provider, setProvider] = useState<PaymentGatewayProvider>('RAZORPAY');
  const [mode, setMode] = useState<CollegePaymentMode>('COLLEGE_OWNED_GATEWAY');
  const [status, setStatus] = useState<PaymentConfigStatus>('NOT_CONFIGURED');
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [displayMerchantName, setDisplayMerchantName] = useState<string>('');

  // Credential Inputs (Empty by default — existing credentials remain unchanged unless entered)
  const [keyId, setKeyId] = useState<string>('');
  const [keySecret, setKeySecret] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [merchantAccountId, setMerchantAccountId] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');

  // UI Visibility & Confirmations
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showLiveModeConfirm, setShowLiveModeConfirm] = useState(false);

  // Status & Feedback banners
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync form state when config loads
  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'RAZORPAY');
      setMode(config.mode || 'COLLEGE_OWNED_GATEWAY');
      setStatus(config.status || 'NOT_CONFIGURED');
      setIsTestMode(config.isTestMode ?? true);
      setDisplayMerchantName(config.displayMerchantName || '');
      // Clear sensitive inputs
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      setMerchantAccountId('');
      setChangeReason('');
      setActionError(null);
      setActionSuccess(null);
      setTestResult(null);
    }
  }, [config, isOpen]);

  // Clean up state when closing
  const handleClose = () => {
    setKeyId('');
    setKeySecret('');
    setWebhookSecret('');
    setMerchantAccountId('');
    setChangeReason('');
    setActionError(null);
    setActionSuccess(null);
    setTestResult(null);
    setShowLiveModeConfirm(false);
    onClose();
  };

  if (!isOpen || !college) return null;

  // Handle Live Mode Toggle with confirmation
  const handleToggleEnvironment = (targetTestMode: boolean) => {
    if (!targetTestMode) {
      // Switching to LIVE mode: trigger confirmation modal
      setShowLiveModeConfirm(true);
    } else {
      setIsTestMode(true);
    }
  };

  const confirmSwitchToLive = () => {
    setIsTestMode(false);
    setShowLiveModeConfirm(false);
  };

  const cancelSwitchToLive = () => {
    setShowLiveModeConfirm(false);
  };

  // Test Gateway Connection
  const handleTestConnection = async () => {
    setActionError(null);
    setTestResult(null);

    try {
      const res = await testConnectionMutation.mutateAsync(collegeId);
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Gateway connection verified successfully!' : 'Gateway connection failed.'),
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Connection test failed');
      setTestResult({ success: false, message: msg });
    }
  };

  // Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setTestResult(null);

    // Validation: If setting status to ACTIVE, ensure credentials exist
    if (status === 'ACTIVE') {
      const hasKeyId = Boolean(config?.hasKeyId || keyId.trim());
      const hasKeySec = Boolean(config?.hasKeySecret || keySecret.trim());
      if (!hasKeyId || !hasKeySec) {
        setActionError('Cannot activate gateway configuration: Key ID and Key Secret are required.');
        return;
      }
    }

    const payload: UpdatePaymentConfigPayload = {
      collegeId,
      provider,
      mode,
      status,
      isTestMode,
      displayMerchantName: displayMerchantName.trim() || null,
      changeReason: changeReason.trim() || 'Super Admin configuration update',
    };

    // Only include secrets if user provided a new non-empty value
    if (keyId.trim()) payload.keyId = keyId.trim();
    if (keySecret.trim()) payload.keySecret = keySecret.trim();
    if (webhookSecret.trim()) payload.webhookSecret = webhookSecret.trim();
    if (merchantAccountId.trim()) payload.merchantAccountId = merchantAccountId.trim();

    try {
      await updateConfigMutation.mutateAsync(payload);
      setActionSuccess('Payment gateway configuration saved and verified successfully.');
      // Clear entered secrets from state
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      setMerchantAccountId('');
      setChangeReason('');
      void refetchConfig();
      if (onSuccess) {
        onSuccess(`Payment configuration updated for ${college.name}`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to update payment configuration.');
      setActionError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#0F1117] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-config-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="payment-config-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Payment Gateway Configuration
                </h2>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {college.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage per-college gateway routing, encrypted merchant secrets, and test/live modes for{' '}
                <strong className="text-slate-700 dark:text-slate-300">{college.name}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-4 px-6 pt-3 border-b border-slate-100 dark:border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Gateway Setup</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('audit');
              void refetchAudits();
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit History ({audits.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Notifications */}
          {actionSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccess(null)}
                className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-sm border ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span>
                  <strong>Gateway Test:</strong> {testResult.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="p-1 hover:opacity-80 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {configLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
              <span className="text-xs">Loading college payment credentials...</span>
            </div>
          ) : activeTab === 'config' ? (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Status Overview Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      status === 'ACTIVE'
                        ? 'bg-emerald-500 animate-pulse'
                        : status === 'SUSPENDED'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Current Gateway Status
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {status === 'ACTIVE'
                        ? 'Gateway is ACTIVE — students and external participants can checkout for paid events.'
                        : status === 'SUSPENDED'
                        ? 'Gateway is SUSPENDED — checkouts are halted until reactivated.'
                        : 'Gateway is NOT CONFIGURED — payments are disabled for this college.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      isTestMode
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {isTestMode ? 'TEST / SANDBOX' : 'PRODUCTION LIVE'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : status === 'SUSPENDED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Payment Gateway Provider *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('RAZORPAY')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      provider === 'RAZORPAY'
                        ? 'border-purple-600 bg-purple-500/10 dark:bg-purple-950/30 ring-1 ring-purple-500'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        provider === 'RAZORPAY'
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-300 dark:border-white/20'
                      }`}
                    >
                      {provider === 'RAZORPAY' && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Razorpay</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        UPI, Cards, NetBanking via standard Razorpay Checkout JS modal. Requires Key ID & Key Secret.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('CASHFREE')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      provider === 'CASHFREE'
                        ? 'border-purple-600 bg-purple-500/10 dark:bg-purple-950/30 ring-1 ring-purple-500'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        provider === 'CASHFREE'
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-300 dark:border-white/20'
                      }`}
                    >
                      {provider === 'CASHFREE' && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Cashfree Payments</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cashfree JS SDK v3 Drop-in. Requires App ID (Key ID), Secret Key, and Webhook Secret.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Environment (Test / Live) & Lifecycle Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Environment Mode */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Operating Environment *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleEnvironment(true)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isTestMode
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-1 ring-amber-500/40'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      TEST / SANDBOX
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleEnvironment(false)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        !isTestMode
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/40'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      PRODUCTION LIVE
                    </button>
                  </div>
                </div>

                {/* Configuration Lifecycle Status */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Lifecycle Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PaymentConfigStatus)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="NOT_CONFIGURED">NOT_CONFIGURED (Disabled)</option>
                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                    <option value="ACTIVE">ACTIVE (Accept Payments)</option>
                    <option value="SUSPENDED">SUSPENDED (Temporarily Blocked)</option>
                  </select>
                </div>
              </div>

              {/* Merchant Display Name & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Display Merchant Name
                  </label>
                  <input
                    type="text"
                    value={displayMerchantName}
                    onChange={(e) => setDisplayMerchantName(e.target.value)}
                    placeholder="e.g. LBRCE Student Council"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Rendered in Razorpay checkout header and transaction receipts.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Gateway Ownership Mode *
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as CollegePaymentMode)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="COLLEGE_OWNED_GATEWAY">COLLEGE_OWNED_GATEWAY (College Account)</option>
                    <option value="PLATFORM_MANAGED_GATEWAY">PLATFORM_MANAGED_GATEWAY (Platform Sub-merchant)</option>
                  </select>
                </div>
              </div>

              {/* Gateway Credentials Box */}
              <div className="p-4 rounded-xl bg-purple-500/[0.03] border border-purple-500/20 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Encrypted Gateway Credentials</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Credentials are encrypted client-side using authenticated AES-256-GCM under the tenant boundary.
                  Leave credential fields blank if you do not wish to rotate existing stored keys.
                </p>

                {/* Key ID / App ID */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {provider === 'RAZORPAY' ? 'Razorpay Key ID (rzp_test_... / rzp_live_...)' : 'Cashfree App ID'}
                    </label>
                    {config?.hasKeyId && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Stored: {config.keyIdPreview || '****'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    placeholder={config?.hasKeyId ? `Keep stored (${config.keyIdPreview || '****'}) or enter new key` : 'Enter Key ID / App ID'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoComplete="off"
                  />
                </div>

                {/* Key Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {provider === 'RAZORPAY' ? 'Razorpay Key Secret' : 'Cashfree Secret Key'}
                    </label>
                    {config?.hasKeySecret && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Stored Securely
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeySecret ? 'text' : 'password'}
                      value={keySecret}
                      onChange={(e) => setKeySecret(e.target.value)}
                      placeholder={config?.hasKeySecret ? '•••••••••••••••• (Leave blank to keep unchanged)' : 'Enter Secret Key'}
                      className="w-full px-3 py-2 pr-10 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeySecret(!showKeySecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      tabIndex={-1}
                    >
                      {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Webhook Secret (HMAC signature verification)
                    </label>
                    {config?.hasWebhookSecret && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Stored Securely
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder={config?.hasWebhookSecret ? '•••••••••••••••• (Leave blank to keep unchanged)' : 'Enter Webhook Secret'}
                      className="w-full px-3 py-2 pr-10 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      tabIndex={-1}
                    >
                      {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Optional Merchant Account ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Merchant Account ID / Sub-account ID (Optional)
                  </label>
                  <input
                    type="password"
                    value={merchantAccountId}
                    onChange={(e) => setMerchantAccountId(e.target.value)}
                    placeholder={config?.hasMerchantAccountId ? '•••••••• (Leave blank to keep unchanged)' : 'Optional'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Audit Reason */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Change Reason (Audit Trail)
                </label>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Initial test credentials setup or credential rotation"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending || (!config?.hasKeyId && !keyId.trim())}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-purple-500/30 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition disabled:opacity-50 cursor-pointer"
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Test Gateway Connection</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={updateConfigMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {updateConfigMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Tab 2: Audit History */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Configuration Change Audits
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Tamper-evident logs of all credential rotations, mode switches, and lifecycle status updates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchAudits()}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                  title="Refresh audit trail"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {auditsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                  <span className="text-xs">Loading audit entries...</span>
                </div>
              ) : audits.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <span>No audit history recorded for this college yet.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Provider / Env</th>
                        <th className="py-2.5 px-3">Credentials</th>
                        <th className="py-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-[11px]">
                      {audits.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.newStatus === 'ACTIVE'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : item.newStatus === 'SUSPENDED'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {item.previousStatus && item.previousStatus !== item.newStatus
                                ? `${item.previousStatus} → ${item.newStatus}`
                                : item.newStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {item.newProvider}
                            </span>{' '}
                            <span
                              className={`text-[10px] px-1 rounded ${
                                item.newIsTestMode
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {item.newIsTestMode ? 'TEST' : 'LIVE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.credentialsRotated ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Rotated ({item.keyIdPreview || '****'})
                              </span>
                            ) : (
                              <span className="text-slate-400">Preserved</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {item.changeReason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Switching to LIVE Mode */}
      {showLiveModeConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#151822] border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Switch to PRODUCTION LIVE Mode?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                You are about to switch payment gateway processing to <strong>PRODUCTION LIVE</strong> for{' '}
                <strong>{college.name}</strong>. Real monetary charges will be billed to participants through live
                gateway credentials.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
              Ensure you have input authoritative production API keys and webhook secrets before testing live checkout.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={cancelSwitchToLive}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Keep in TEST Mode
              </button>
              <button
                type="button"
                onClick={confirmSwitchToLive}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm cursor-pointer"
              >
                Confirm LIVE Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
