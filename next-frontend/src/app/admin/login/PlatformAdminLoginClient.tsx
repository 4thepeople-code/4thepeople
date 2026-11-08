'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  usePlatformAdminLoginMutation,
  usePlatformSetupStatusQuery,
  useInitialPlatformSetupMutation,
} from '@/lib/api/auth';
import { useTheme } from '@/context/ThemeContext';
import QRCodeDisplay from '@/components/platform/QRCodeDisplay';
import {
  Shield,
  KeyRound,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Moon,
  Sun,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  QrCode,
  CheckCircle2,
} from 'lucide-react';

type LoginStep = 'CREDENTIALS' | 'TOTP_VERIFY' | 'TOTP_SETUP' | 'INITIAL_SETUP_FORM' | 'INITIAL_SETUP_TOTP';

export function PlatformAdminLoginClient() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const { isDark, toggleTheme } = useTheme();

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
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-[11px] font-mono border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span>Platform Host Target:</span>
          <span className="text-white font-semibold">admin.4thepeople.in</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Directory</span>
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Loading Indicator */}
            {statusLoading && (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                <p className="text-xs">Checking platform initialization status...</p>
              </div>
            )}

            {!statusLoading && (
              <>
                {/* ========================================================================= */}
                {/* 1. INITIAL SETUP WIZARD (When 0 Admins Exist) */}
                {/* ========================================================================= */}
                {step === 'INITIAL_SETUP_FORM' && (
                  <div>
                    <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-purple-600/20">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-2">
                        <span>First-Time Setup</span>
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Initialize Platform Owner
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        No platform administrators exist yet. Create the primary Super-Administrator account to initialize 4thepeople.
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-xs leading-relaxed font-medium">{errorMessage}</div>
                      </div>
                    )}

                    <form onSubmit={handleInitialSetupSubmit} className="p-6 sm:p-8 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Full Name
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Irfan Jan Khan"
                            required
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. irfanjankhan7860@gmail.com"
                            required
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Master Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            required
                            className="w-full pl-9 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={initialSetupMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition-all disabled:opacity-50"
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
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 2. INITIAL SETUP TOTP (Show QR Code on Screen) */}
                {/* ========================================================================= */}
                {step === 'INITIAL_SETUP_TOTP' && setupData && (
                  <div className="p-6 sm:p-8 text-center space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Scan Authenticator QR Code
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        Open Google Authenticator, 1Password, or Authy on your phone and scan the code below.
                      </p>
                    </div>

                    {/* QR Code Display */}
                    {setupData.otpauthUrl && (
                      <div className="flex justify-center py-2">
                        <QRCodeDisplay value={setupData.otpauthUrl} size={190} />
                      </div>
                    )}

                    {/* Manual Secret Key */}
                    <div className="text-left bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Manual Entry Secret Key:
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-purple-600 dark:text-purple-300 flex-1 break-all select-all">
                          {setupData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(setupData.secret || '')}
                          className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-600 flex items-center gap-1 shrink-0"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Live code preview */}
                    {setupData.liveCode && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl flex items-center justify-between text-left">
                        <div>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block uppercase tracking-wider">
                            Current Test Code
                          </span>
                          <span className="text-lg font-mono font-extrabold text-purple-700 dark:text-purple-300">
                            {setupData.liveCode}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-500 font-mono">
                          valid ~{setupData.secondsRemaining || 30}s
                        </span>
                      </div>
                    )}

                    <form onSubmit={handleInitialSetupTotpConfirm} className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 text-left">
                          Enter 6-digit Code to Confirm Setup
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          inputMode="numeric"
                          value={totpCode}
                          onChange={handleTotpChange}
                          placeholder="000000"
                          className="w-full py-2.5 text-center font-mono text-xl tracking-[0.4em] font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Enter Platform Dashboard</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 3. STEP 1: CREDENTIALS (Email & Password Only) */}
                {/* ========================================================================= */}
                {step === 'CREDENTIALS' && (
                  <div>
                    <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-purple-600/20">
                        <Shield className="w-7 h-7" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-2">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Privileged Operations</span>
                      </div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Platform Super-Admin
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        Sign in with your master administrator credentials.
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-xs leading-relaxed font-medium">{errorMessage}</div>
                      </div>
                    )}

                    <form onSubmit={handleCredentialsSubmit} className="p-6 sm:p-8 space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Platform Admin Email
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="irfanjankhan7860@gmail.com"
                            autoComplete="email"
                            required
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            autoComplete="current-password"
                            required
                            className="w-full pl-9 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={loginMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition-all disabled:opacity-50"
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
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 4. STEP 2A: TOTP VERIFY (When 2FA is Enrolled) */}
                {/* ========================================================================= */}
                {step === 'TOTP_VERIFY' && (
                  <div className="p-6 sm:p-8 space-y-5">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto mb-3">
                        <KeyRound className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Two-Factor Authentication
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Enter the rotating 6-digit code from Google Authenticator or 1Password for <strong className="text-slate-800 dark:text-slate-200">{email}</strong>.
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <form onSubmit={handleTotpVerifySubmit} className="space-y-4">
                      <div>
                        <input
                          type="text"
                          maxLength={6}
                          inputMode="numeric"
                          value={totpCode}
                          onChange={handleTotpChange}
                          placeholder="000000"
                          autoFocus
                          className="w-full py-3 text-center font-mono text-2xl tracking-[0.4em] font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStep('CREDENTIALS');
                            setTotpCode('');
                          }}
                          className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loginMutation.isPending || totpCode.length !== 6}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-md transition-all disabled:opacity-50"
                        >
                          {loginMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Verify & Sign In</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* 5. STEP 2B: TOTP SETUP (First Login for Invited Admin) */}
                {/* ========================================================================= */}
                {step === 'TOTP_SETUP' && setupData && (
                  <div className="p-6 sm:p-8 text-center space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        First-Time 2FA Setup
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        Two-factor authentication is required for platform administrators. Scan this code with Google Authenticator or 1Password.
                      </p>
                    </div>

                    {/* QR Code Display */}
                    {setupData.otpauthUrl && (
                      <div className="flex justify-center py-1">
                        <QRCodeDisplay value={setupData.otpauthUrl} size={180} />
                      </div>
                    )}

                    {/* Manual Secret Key */}
                    <div className="text-left bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Manual Key:
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-purple-600 dark:text-purple-300 flex-1 break-all select-all">
                          {setupData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(setupData.secret || '')}
                          className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-600 flex items-center gap-1 shrink-0"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleTotpVerifySubmit} className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 text-left">
                          Enter 6-digit Code from Authenticator
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          inputMode="numeric"
                          value={totpCode}
                          onChange={handleTotpChange}
                          placeholder="000000"
                          className="w-full py-2.5 text-center font-mono text-xl tracking-[0.4em] font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loginMutation.isPending || totpCode.length !== 6}
                          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {loginMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Confirm & Sign In</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* Footer Notice */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              <span>Security Policy: Host-Only Cookie</span>
              <span className="mx-2">&bull;</span>
              <span>Anti-Replay Cache Active</span>
              <span className="mx-2">&bull;</span>
              <span>IP Throttled</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PlatformAdminLoginClient;
