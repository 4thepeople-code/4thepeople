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
    noRoll: !rollNumber.trim() || rollNumber.trim().length < 3 || !password.toLowerCase().includes(rollNumber.trim().toLowerCase()),
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
      const resData = (err as { response?: { data?: { message?: string; attemptsRemaining?: number; code?: string } } })?.response?.data;
      const msg = resData?.message || (err instanceof Error ? err.message : 'Activation failed.');
      setErrorMessage(msg);
      if (typeof resData?.attemptsRemaining === 'number') {
        setAttemptsRemaining(resData.attemptsRemaining);
      }
    }
  };

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Activation</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              ACTIVATE YOUR <span className="text-[#00F0FF]">ACCOUNT.</span>
            </h1>
            <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              First-time setup for enrolled students at {collegeDisplay}. Verify your identity and configure your account password.
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-wider">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${
                step === 1
                  ? 'bg-[#00F0FF] text-black border-cyan-400'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <span>1</span>
              <span>Request Code</span>
            </div>
            <div className="w-6 h-px bg-white/20" />
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${
                step === 2
                  ? 'bg-[#00F0FF] text-black border-cyan-400'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <span>2</span>
              <span>Verify & Password</span>
            </div>
          </div>

          {/* Card Shell */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${
              isDark
                ? 'bg-[#12141C] border-white/10 shadow-black/40'
                : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div className="text-xs flex-1">
                  <p className="font-semibold">{errorMessage}</p>
                  {attemptsRemaining !== null && (
                    <p className="mt-1 font-bold text-red-200">
                      Remaining attempts before lockout: {attemptsRemaining}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Notice from Step 1 */}
            {requestNotice && (
              <div className="mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-3 text-cyan-200">
                <Info className="w-5 h-5 shrink-0 text-[#00F0FF] mt-0.5" />
                <p className="text-xs leading-relaxed">{requestNotice}</p>
              </div>
            )}

            {/* STEP 1: Request Activation Code */}
            {step === 1 && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="rollNumber"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    Institutional Roll Number
                  </label>
                  <div className="relative">
                    <User
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-gray-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      id="rollNumber"
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. 21A91A0501"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm uppercase font-mono tracking-wider transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                      required
                    />
                  </div>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                    Must match your student roster entry uploaded by your college administration.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={requestMutation.isPending}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 active:scale-[0.99] cursor-pointer"
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
                      className={`block text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-slate-700'
                      }`}
                    >
                      Roll Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] text-[#00F0FF] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                  <input
                    id="step2Roll"
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono uppercase tracking-wider opacity-90 ${
                      isDark
                        ? 'bg-[#0B0C10] border-white/10 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                    required
                  />
                </div>

                {/* Verification Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="code"
                      className={`block text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-slate-700'
                      }`}
                    >
                      6-Digit Activation Code
                    </label>
                    {cooldownSeconds > 0 ? (
                      <span className="text-[10px] text-gray-400 font-mono">
                        Resend in {cooldownSeconds}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        className="text-[10px] text-[#00F0FF] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-gray-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      id="code"
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-base font-mono tracking-widest text-center transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-[#00F0FF] placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-cyan-700 placeholder-slate-400'
                      }`}
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    New Account Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-gray-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-gray-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Password Policy Checklist */}
                <div
                  className={`p-3.5 rounded-2xl border text-[11px] space-y-1.5 ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <p className={`font-bold uppercase tracking-wider text-[10px] mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Security Requirements:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.length ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.length ? 'text-emerald-400' : 'text-gray-400'}>
                        8+ characters
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.upper ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.upper ? 'text-emerald-400' : 'text-gray-400'}>
                        1 uppercase letter (A-Z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.lower ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.lower ? 'text-emerald-400' : 'text-gray-400'}>
                        1 lowercase letter (a-z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.number ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.number ? 'text-emerald-400' : 'text-gray-400'}>
                        1 numeric digit (0-9)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.special ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={passwordCriteria.special ? 'text-emerald-400' : 'text-gray-400'}>
                        1 special character (!@#$)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.noRoll ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <span className={passwordCriteria.noRoll ? 'text-emerald-400' : 'text-red-400'}>
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
                    className="w-full py-3.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] disabled:opacity-40 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 active:scale-[0.99] cursor-pointer"
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
            <div className={`mt-6 pt-6 border-t text-center text-xs ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>Already have a configured password?</span>{' '}
              <Link
                href={`/college/${slug}/login`}
                className="font-bold text-[#00F0FF] hover:underline"
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
