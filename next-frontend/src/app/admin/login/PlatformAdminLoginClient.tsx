'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  usePlatformAdminLoginMutation,
  usePlatformSetupStatusQuery,
  useInitialPlatformSetupMutation,
} from '@/lib/api/auth';
import QRCodeDisplay from '@/components/platform/QRCodeDisplay';
import {
  AuthShell,
  AuthAlert,
  AuthPasswordInput,
  authInputBaseClass,
  authInputWithIconClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
} from '@/components/auth/AuthShell';
import {
  Shield,
  KeyRound,
  Mail,
  User,
  Loader2,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

type LoginStep = 'CREDENTIALS' | 'TOTP_VERIFY' | 'TOTP_SETUP' | 'INITIAL_SETUP_FORM' | 'INITIAL_SETUP_TOTP';

export function PlatformAdminLoginClient() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  // Queries & Mutations
  const { data: setupStatus, isLoading: statusLoading } = usePlatformSetupStatusQuery();
  const loginMutation = usePlatformAdminLoginMutation();
  const initialSetupMutation = useInitialPlatformSetupMutation();

  // Form State
  const [step, setStep] = useState<LoginStep>('CREDENTIALS');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Setup / QR Data from server
  const [setupData, setSetupData] = useState<{
    secret?: string;
    otpauthUrl?: string;
    liveCode?: string;
    secondsRemaining?: number;
  } | null>(null);

  // If already authenticated, redirect to platform dashboard
  useEffect(() => {
    if (!authLoading && user && (user.role === 'PLATFORM_SUPER_ADMIN' || user.isPlatformAdmin)) {
      router.replace('/admin');
    }
  }, [user, authLoading, router]);

  // If setup status returns not initialized, switch to INITIAL_SETUP_FORM
  useEffect(() => {
    if (setupStatus && !setupStatus.isInitialized) {
      setStep('INITIAL_SETUP_FORM');
    }
  }, [setupStatus]);

  const handleTotpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(clean);
  };

  const handleCopyKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // =========================================================================
  // Initial Setup Handlers (First-Run when count === 0)
  // =========================================================================
  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim() || !email.trim() || !password) {
      setValidationError('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    try {
      const response = await initialSetupMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (response && response.success) {
        const totp = response.data?.totp;
        if (totp) {
          setSetupData({
            secret: totp.secret,
            otpauthUrl: totp.otpauthUrl,
            liveCode: totp.liveCode,
            secondsRemaining: totp.secondsRemaining,
          });
          setStep('INITIAL_SETUP_TOTP');
        } else {
          router.push('/admin');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initial setup failed';
      setValidationError(msg);
    }
  };

  const handleInitialSetupTotpConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setValidationError('Please enter the 6-digit code to confirm.');
      return;
    }
    // Already authenticated with cookie set during setup-initial; navigate to admin
    login(
      {
        id: 'platform-root-admin',
        userId: 'platform-root-admin',
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role: 'PLATFORM_SUPER_ADMIN',
        isPlatformAdmin: true,
      },
      null
    );
    router.push('/admin');
  };

  // =========================================================================
  // Standard 2-Step Login Handlers
  // =========================================================================
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setValidationError('Please enter your administrator email.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setValidationError('Please enter a valid administrator email address.');
      return;
    }

    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({
        email: cleanEmail,
        password,
      });

      if (response && response.success) {
        const data = response.data;

        // Case 1: Requires TOTP Verification code
        if (data?.requiresTotp) {
          setStep('TOTP_VERIFY');
          return;
        }

        // Case 2: Requires TOTP Setup (first time login, QR code)
        if (data?.requiresTotpSetup && data.setup) {
          setSetupData({
            secret: data.setup.secret,
            otpauthUrl: data.setup.otpauthUrl,
            liveCode: data.setup.liveCode,
            secondsRemaining: data.setup.secondsRemaining,
          });
          setStep('TOTP_SETUP');
          return;
        }

        // Case 3: Already authenticated in 1 step
        const adminData = data?.admin;
        if (adminData) {
          login(
            {
              id: adminData.id || 'platform-admin',
              userId: adminData.id || 'platform-admin',
              email: adminData.email || cleanEmail,
              name: adminData.name || 'Platform Super-Admin',
              role: 'PLATFORM_SUPER_ADMIN',
              isPlatformAdmin: true,
            },
            null
          );
          router.push('/admin');
        }
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handleTotpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!totpCode || totpCode.length !== 6) {
      setValidationError('Please enter the complete 6-digit authenticator code.');
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        totpCode,
        totp: totpCode,
        setupSecret: step === 'TOTP_SETUP' ? setupData?.secret : undefined,
      });

      if (response && response.success) {
        const data = response.data;
        const adminData = data?.admin;

        if (adminData) {
          login(
            {
              id: adminData.id || 'platform-admin',
              userId: adminData.id || 'platform-admin',
              email: adminData.email || email,
              name: adminData.name || 'Platform Super-Admin',
              role: 'PLATFORM_SUPER_ADMIN',
              isPlatformAdmin: true,
            },
            null
          );
        }

        router.push('/admin');
      }
    } catch {
      setTotpCode('');
    }
  };

  const errorMessage =
    validationError ||
    (loginMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (initialSetupMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (loginMutation.error instanceof Error ? loginMutation.error.message : null);

  const shellMeta = (() => {
    switch (step) {
      case 'INITIAL_SETUP_FORM':
        return {
          badgeLabel: 'FIRST-TIME SETUP',
          title: 'Initialize Platform Owner',
          subtitle: 'Create the primary Platform Admin account to initialize 4thepeople.',
        };
      case 'INITIAL_SETUP_TOTP':
      case 'TOTP_SETUP':
        return {
          badgeLabel: 'PLATFORM ADMIN 2FA',
          title: 'Set up two-factor auth',
          subtitle: 'Scan the QR code with Google Authenticator, 1Password, or Authy.',
        };
      case 'TOTP_VERIFY':
        return {
          badgeLabel: 'PLATFORM ADMIN 2FA',
          title: 'Two-factor verification',
          subtitle: `Enter the 6-digit authenticator code for ${email}.`,
        };
      default:
        return {
          badgeLabel: 'PLATFORM ADMIN',
          title: (
            <>
              Platform{' '}
              <span className="font-serif italic font-normal text-[#4f46e8] dark:text-[#8183ff]">
                Admin.
              </span>
            </>
          ),
          subtitle: 'Sign in with your master administrator credentials.',
        };
    }
  })();

  return (
    <AuthShell
      sectionIndex="04"
      sectionLabel="PLATFORM OPERATIONS"
      workspaceLabel="admin.4thepeople.in"
      backHref="/"
      backLabel="Back to Public Directory"
      badgeLabel={shellMeta.badgeLabel}
      heroTitle={
        <>
          Multi-tenant command{' '}
          <span className="font-serif italic font-normal text-[#8183ff]">
            center.
          </span>
        </>
      }
      heroDescription="Cryptographically isolated platform administration for institution onboarding, security policies, and global operations."
      title={shellMeta.title}
      subtitle={shellMeta.subtitle}
      footer={
        <div className="text-[11px] text-[#4b5060] dark:text-[#a7acbb] text-center flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 border-t border-[#16181d]/10 dark:border-white/10">
          <span className="inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#4f46e8] dark:text-[#8183ff]" />
            <span>Host-Only Cookie</span>
          </span>
          <span>&bull;</span>
          <span>Anti-Replay Cache Active</span>
          <span>&bull;</span>
          <span>IP Throttled</span>
        </div>
      }
    >
      {statusLoading ? (
        <div className="py-10 text-center text-[#4b5060] dark:text-[#a7acbb]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#4f46e8] dark:text-[#8183ff] mb-2.5" />
          <p className="text-xs font-medium">Checking platform initialization status...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {errorMessage && <AuthAlert variant="error">{errorMessage}</AuthAlert>}

          {/* 1. INITIAL SETUP WIZARD (When 0 Admins Exist) */}
          {step === 'INITIAL_SETUP_FORM' && (
            <form onSubmit={handleInitialSetupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="setupName"
                  className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                  <input
                    id="setupName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Irfan Jan Khan"
                    required
                    className={authInputWithIconClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="setupEmail"
                  className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                  <input
                    id="setupEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@4thepeople.in"
                    required
                    className={authInputWithIconClass}
                  />
                </div>
              </div>

              <AuthPasswordInput
                id="setupPassword"
                label="Master Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={initialSetupMutation.isPending}
                  className={authPrimaryButtonClass}
                >
                  {initialSetupMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing Platform...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Initialize Super-Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 2. INITIAL SETUP TOTP (Show QR Code on Screen) */}
          {step === 'INITIAL_SETUP_TOTP' && setupData && (
            <div className="space-y-5 text-center">
              {setupData.otpauthUrl && (
                <div className="flex justify-center py-1">
                  <QRCodeDisplay value={setupData.otpauthUrl} size={184} />
                </div>
              )}

              <div className="text-left bg-[#faf7f2] dark:bg-[#0d0f14] p-3 rounded-xl border border-[#16181d]/10 dark:border-white/10">
                <span className="text-[11px] font-semibold text-[#4b5060] dark:text-[#a7acbb] block mb-1">
                  Manual Entry Secret Key:
                </span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono font-bold text-[#4f46e8] dark:text-[#8183ff] flex-1 break-all select-all">
                    {setupData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyKey(setupData.secret || '')}
                    className="px-2.5 py-1 bg-white dark:bg-[#14171f] rounded-lg text-[11px] font-semibold border border-[#16181d]/12 dark:border-white/12 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {setupData.liveCode && (
                <div className="p-3 bg-[#ececfd]/70 dark:bg-[#6366f1]/15 border border-[#4f46e8]/20 dark:border-[#8183ff]/25 rounded-xl flex items-center justify-between text-left">
                  <div>
                    <span className="text-[10px] text-[#4f46e8] dark:text-[#8183ff] font-semibold block uppercase tracking-wider">
                      Current Test Code
                    </span>
                    <span className="text-lg font-mono font-extrabold text-[#4338ca] dark:text-[#a5b4fc]">
                      {setupData.liveCode}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#4f46e8] dark:text-[#8183ff] font-mono">
                    valid ~{setupData.secondsRemaining || 30}s
                  </span>
                </div>
              )}

              <form onSubmit={handleInitialSetupTotpConfirm} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="initTotp"
                    className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                  >
                    Enter 6-digit Code to Confirm Setup
                  </label>
                  <input
                    id="initTotp"
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    value={totpCode}
                    onChange={handleTotpChange}
                    placeholder="000000"
                    className={`${authInputBaseClass} py-2.5 text-center font-mono text-xl tracking-[0.4em] font-bold`}
                    required
                  />
                </div>

                <button type="submit" className={authPrimaryButtonClass}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Enter Platform Dashboard</span>
                </button>
              </form>
            </div>
          )}

          {/* 3. STEP 1: CREDENTIALS (Email & Password Only) */}
          {step === 'CREDENTIALS' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="adminEmail"
                  className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                >
                  Platform Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                  <input
                    id="adminEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@4thepeople.in"
                    autoComplete="email"
                    disabled={loginMutation.isPending}
                    required
                    className={authInputWithIconClass}
                  />
                </div>
              </div>

              <AuthPasswordInput
                id="adminPassword"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
                autoComplete="current-password"
              />

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className={authPrimaryButtonClass}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <KeyRound className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 4. STEP 2A: TOTP VERIFY (When 2FA is Enrolled) */}
          {step === 'TOTP_VERIFY' && (
            <form onSubmit={handleTotpVerifySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="verifyTotp"
                  className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                >
                  6-Digit Authenticator Code
                </label>
                <input
                  id="verifyTotp"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={totpCode}
                  onChange={handleTotpChange}
                  placeholder="000000"
                  autoFocus
                  className={`${authInputBaseClass} py-3 text-center font-mono text-2xl tracking-[0.4em] font-bold`}
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setTotpCode('');
                  }}
                  className={`flex-1 ${authSecondaryButtonClass}`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loginMutation.isPending || totpCode.length !== 6}
                  className={`flex-1 ${authPrimaryButtonClass}`}
                >
                  {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Verify & Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* 5. STEP 2B: TOTP SETUP (First Login for Invited Admin) */}
          {step === 'TOTP_SETUP' && setupData && (
            <div className="space-y-5 text-center">
              {setupData.otpauthUrl && (
                <div className="flex justify-center py-1">
                  <QRCodeDisplay value={setupData.otpauthUrl} size={180} />
                </div>
              )}

              <div className="text-left bg-[#faf7f2] dark:bg-[#0d0f14] p-3 rounded-xl border border-[#16181d]/10 dark:border-white/10">
                <span className="text-[11px] font-semibold text-[#4b5060] dark:text-[#a7acbb] block mb-1">
                  Manual Key:
                </span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono font-bold text-[#4f46e8] dark:text-[#8183ff] flex-1 break-all select-all">
                    {setupData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyKey(setupData.secret || '')}
                    className="px-2.5 py-1 bg-white dark:bg-[#14171f] rounded-lg text-[11px] font-semibold border border-[#16181d]/12 dark:border-white/12 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleTotpVerifySubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="setupTotpVerify"
                    className="block text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]"
                  >
                    Enter 6-digit Code from Authenticator
                  </label>
                  <input
                    id="setupTotpVerify"
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    value={totpCode}
                    onChange={handleTotpChange}
                    placeholder="000000"
                    className={`${authInputBaseClass} py-2.5 text-center font-mono text-xl tracking-[0.4em] font-bold`}
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('CREDENTIALS');
                      setTotpCode('');
                    }}
                    className={`flex-1 ${authSecondaryButtonClass}`}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loginMutation.isPending || totpCode.length !== 6}
                    className={`flex-1 ${authPrimaryButtonClass}`}
                  >
                    {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm & Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}

export default PlatformAdminLoginClient;
