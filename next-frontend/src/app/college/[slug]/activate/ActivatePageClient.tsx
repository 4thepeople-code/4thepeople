'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import {
  useStudentActivationRequestMutation,
  useStudentActivationConfirmMutation,
} from '@/lib/api/auth';
import PublicLayout from '@/components/public/PublicLayout';
import {
  Sparkles,
  KeyRound,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';

export interface ActivatePageClientProps {
  slug: string;
  initialRollNumber?: string;
}

export function ActivatePageClient({ slug, initialRollNumber = '' }: ActivatePageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const collegeDisplay = slug.toUpperCase();

  // Wizard state: 1 = Request Code, 2 = Verify & Set Password
  const [step, setStep] = useState<1 | 2>(1);

  // Form inputs
  const [rollNumber, setRollNumber] = useState(initialRollNumber);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & feedback
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const requestMutation = useStudentActivationRequestMutation();
  const confirmMutation = useStudentActivationConfirmMutation(slug);

  // Password Policy Checks (OWASP/S1 Backend aligned)
  const passwordCriteria = {
    length: password.length >= 8 && password.length <= 128,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>_~-]/.test(password),
    noRoll:
      !rollNumber.trim() ||
      rollNumber.trim().length < 3 ||
      !password.toLowerCase().includes(rollNumber.trim().toLowerCase()),
    matches: password.length > 0 && password === confirmPassword,
  };

  const isPasswordValid =
    passwordCriteria.length &&
    passwordCriteria.upper &&
    passwordCriteria.lower &&
    passwordCriteria.number &&
    passwordCriteria.special &&
    passwordCriteria.noRoll;

  // Handle Step 1: Request Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRequestNotice(null);

    const cleanRoll = rollNumber.trim().toUpperCase();
    if (!cleanRoll) {
      setErrorMessage('Please enter your institutional Roll Number.');
      return;
    }

    try {
      const res = await requestMutation.mutateAsync({ rollNumber: cleanRoll });
      const msg =
        res?.message ||
        'If this roll number is registered, an activation code has been sent to your institutional email.';
      setRequestNotice(msg);
      setStep(2);

      // Start 60s cooldown timer
      setCooldownSeconds(60);
      const interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Unable to dispatch activation code. Please try again.');
      setErrorMessage(msg);
    }
  };

  // Handle Step 2: Confirm Code & Activate
  const handleConfirmActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanRoll = rollNumber.trim().toUpperCase();
    const cleanCode = code.trim();

    if (!cleanRoll) {
      setErrorMessage('Roll number is missing.');
      return;
    }
    if (!cleanCode) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage('Please satisfy all password security requirements below.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        rollNumber: cleanRoll,
        code: cleanCode,
        password,
      });

      // Redirect to login with prefilled roll number and success banner
      router.push(`/college/${slug}/login?activated=true&rollNumber=${encodeURIComponent(cleanRoll)}`);
    } catch (err: unknown) {
      const resData = (
        err as {
          response?: { data?: { message?: string; attemptsRemaining?: number; code?: string } };
        }
      )?.response?.data;
      const msg = resData?.message || (err instanceof Error ? err.message : 'Activation failed.');
      setErrorMessage(msg);
      if (typeof resData?.attemptsRemaining === 'number') {
        setAttemptsRemaining(resData.attemptsRemaining);
      }
    }
  };

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope min-h-[calc(100vh-200px)] bg-[var(--surface-page)] text-[var(--text-primary)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)] shadow-brutal-xs mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Activation</span>
            </div>
            <h1 className="font-campus text-4xl sm:text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)]">
              ACTIVATE YOUR <span className="text-[var(--accent-strong)]">ACCOUNT.</span>
            </h1>
            <p className="text-xs max-w-md mx-auto text-[var(--text-secondary)] font-medium">
              First-time setup for enrolled students at {collegeDisplay}. Verify your identity and configure your account password.
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-wider">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-[var(--border-strong)] transition-all ${
                step === 1
                  ? 'bg-[var(--accent-strong)] text-[var(--surface-page)] dark:text-black shadow-brutal-xs font-extrabold'
                  : 'bg-[var(--surface-tile)] text-[var(--text-secondary)] opacity-80'
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/20 font-mono">1</span>
              <span>Request Code</span>
            </div>
            <div className="w-6 h-[2px] bg-[var(--border-strong)]" />
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-[var(--border-strong)] transition-all ${
                step === 2
                  ? 'bg-[var(--accent-strong)] text-[var(--surface-page)] dark:text-black shadow-brutal-xs font-extrabold'
                  : 'bg-[var(--surface-tile)] text-[var(--text-secondary)] opacity-80'
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/20 font-mono">2</span>
              <span>Verify & Password</span>
            </div>
          </div>

          {/* Card Shell */}
          <div className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] shadow-brutal-md transition-all">
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl border-2 border-red-500/40 bg-red-500/10 flex items-start gap-3 text-red-700 dark:text-red-300 shadow-brutal-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <div className="text-xs flex-1">
                  <p className="font-bold">{errorMessage}</p>
                  {attemptsRemaining !== null && (
                    <p className="mt-1 font-bold text-red-600 dark:text-red-200">
                      Remaining attempts before lockout: {attemptsRemaining}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Notice from Step 1 */}
            {requestNotice && (
              <div className="mb-6 p-4 rounded-2xl border-2 border-[var(--border-strong)] bg-cyan-500/10 flex items-start gap-3 text-cyan-800 dark:text-cyan-200 shadow-brutal-xs">
                <Info className="w-5 h-5 shrink-0 text-[var(--accent-strong)] mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">{requestNotice}</p>
              </div>
            )}

            {/* STEP 1: Request Activation Code */}
            {step === 1 && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="rollNumber"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                  >
                    Institutional Roll Number
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      id="rollNumber"
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. 21A91A0501"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm uppercase font-mono tracking-wider text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                      required
                    />
                  </div>
                  <p className="text-[11px] mt-1 text-[var(--text-secondary)] font-medium">
                    Must match your student roster entry uploaded by your college administration.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={requestMutation.isPending}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--accent-strong)] hover:opacity-95 disabled:opacity-50 text-[var(--surface-page)] dark:text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
                  >
                    {requestMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Activation Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verify Code and Configure Password */}
            {step === 2 && (
              <form onSubmit={handleConfirmActivation} className="space-y-4">
                {/* Roll Number (Read-only or editable) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="step2Roll"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                    >
                      Roll Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] font-bold text-[var(--accent-strong)] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                  <input
                    id="step2Roll"
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm font-mono uppercase tracking-wider text-[var(--text-primary)] opacity-90 shadow-brutal-xs"
                    required
                  />
                </div>

                {/* Verification Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="code"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                    >
                      6-Digit Activation Code
                    </label>
                    {cooldownSeconds > 0 ? (
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono font-bold">
                        Resend in {cooldownSeconds}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        className="text-[10px] font-bold text-[var(--accent-strong)] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      id="code"
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-base font-mono tracking-widest text-center font-bold text-[var(--accent-strong)] placeholder-[var(--text-muted)] transition-all focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                  >
                    New Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Password Policy Checklist */}
                <div className="p-3.5 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[11px] space-y-1.5 shadow-brutal-xs">
                  <p className="font-bold uppercase tracking-wider text-[10px] mb-1 text-[var(--text-secondary)]">
                    Security Requirements:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.length ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className={passwordCriteria.length ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                        8+ characters
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.upper ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className={passwordCriteria.upper ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                        1 uppercase letter (A-Z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.lower ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className={passwordCriteria.lower ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                        1 lowercase letter (a-z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.number ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className={passwordCriteria.number ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                        1 numeric digit (0-9)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.special ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className={passwordCriteria.special ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[var(--text-muted)]'}>
                        1 special character (!@#$)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.noRoll ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.noRoll ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                        No roll number in password
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Confirmation */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={confirmMutation.isPending || !isPasswordValid || password !== confirmPassword}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--accent-strong)] hover:opacity-95 disabled:opacity-40 text-[var(--surface-page)] dark:text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
                  >
                    {confirmMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Activating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm & Complete Activation</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Back to Login link */}
            <div className="mt-6 pt-6 border-t-2 border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
              <span>Already have a configured password?</span>{' '}
              <Link
                href={`/college/${slug}/login`}
                className="font-bold text-[var(--accent-strong)] hover:underline"
              >
                Sign in here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default ActivatePageClient;
