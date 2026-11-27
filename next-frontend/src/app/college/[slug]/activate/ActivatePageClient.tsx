'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useStudentActivationRequestMutation,
  useStudentActivationConfirmMutation,
} from '@/lib/api/auth';
import {
  AuthShell,
  AuthAlert,
  AuthPasswordInput,
  authInputBaseClass,
  authInputWithIconClass,
  authPrimaryButtonClass,
} from '@/components/auth/AuthShell';
import {
  KeyRound,
  User,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Shield,
  GraduationCap,
} from 'lucide-react';

export interface ActivatePageClientProps {
  slug: string;
  initialRollNumber?: string;
}

export function ActivatePageClient({ slug, initialRollNumber = '' }: ActivatePageClientProps) {
  const router = useRouter();
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
    <AuthShell
      maxWidth="lg"
      sectionIndex="02"
      sectionLabel="ACCOUNT ACTIVATION"
      collegeDisplay={collegeDisplay}
      workspaceLabel={slug.toLowerCase()}
      backHref={`/college/${slug}/login`}
      backLabel="Back to Student Login"
      badgeLabel="STUDENT ONBOARDING"
      heroTitle={
        <>
          Verify your identity,{' '}
          <span className="font-serif italic font-normal text-[#8183ff]">
            unlock campus.
          </span>
        </>
      }
      heroDescription={`First-time setup for enrolled ${collegeDisplay} students. Confirm your institutional roll number with a one-time code and set your password.`}
      title={
        <>
          Activate{' '}
          <span className="font-serif italic font-normal text-[#4f46e8] dark:text-[#8183ff]">
            account.
          </span>
        </>
      }
      subtitle={`Set up your ${collegeDisplay} student credentials in two quick steps.`}
      footer={
        <div className="space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-[#16181d]/10 dark:border-white/10" />
            <span className="bg-white dark:bg-[#14171f] px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4b5060]/70 dark:text-[#a7acbb]/70 whitespace-nowrap">
              OTHER PORTALS
            </span>
            <div className="w-full border-t border-[#16181d]/10 dark:border-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/college/${slug}/login`}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <GraduationCap className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Student Portal</span>
            </Link>
            <Link
              href={`/college/${slug}/login/manager`}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <Shield className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Manager Portal</span>
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Clean Stepper Indicator */}
        <div className="flex items-center justify-center gap-2.5 text-xs font-semibold pb-1">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
              step === 1
                ? 'bg-[#0c1322] dark:bg-[#4f46e8] border-transparent text-white shadow-xs'
                : 'bg-white dark:bg-[#14171f] border-[#16181d]/12 dark:border-white/12 text-[#4b5060] dark:text-[#a7acbb]'
            }`}
          >
            <span className="font-mono text-[10px]">1</span>
            <span>Request Code</span>
          </div>
          <div className="w-6 h-px bg-[#16181d]/15 dark:bg-white/15" />
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
              step === 2
                ? 'bg-[#0c1322] dark:bg-[#4f46e8] border-transparent text-white shadow-xs'
                : 'bg-white dark:bg-[#14171f] border-[#16181d]/12 dark:border-white/12 text-[#4b5060] dark:text-[#a7acbb]'
            }`}
          >
            <span className="font-mono text-[10px]">2</span>
            <span>Verify & Password</span>
          </div>
        </div>

        {errorMessage && (
          <AuthAlert variant="error">
            <p>{errorMessage}</p>
            {attemptsRemaining !== null && (
              <p className="mt-1 font-semibold">
                Remaining attempts before lockout: {attemptsRemaining}
              </p>
            )}
          </AuthAlert>
        )}

        {requestNotice && <AuthAlert variant="info">{requestNotice}</AuthAlert>}

        {/* STEP 1: Request Activation Code */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="rollNumber"
                className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
              >
                Institutional Roll Number
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                <input
                  id="rollNumber"
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 21A91A0501"
                  className={`${authInputWithIconClass} uppercase font-mono tracking-wider`}
                  disabled={requestMutation.isPending}
                  required
                />
              </div>
              <p className="text-[11px] text-[#4b5060] dark:text-[#a7acbb]">
                Must match your student roster entry uploaded by your college administration.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className={authPrimaryButtonClass}
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="step2Roll"
                  className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
                >
                  Roll Number
                </label>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
              <input
                id="step2Roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                className={`${authInputBaseClass} px-3.5 py-2.5 uppercase font-mono tracking-wider`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="code"
                  className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
                >
                  6-Digit Activation Code
                </label>
                {cooldownSeconds > 0 ? (
                  <span className="text-[11px] text-[#4b5060] dark:text-[#a7acbb] font-mono">
                    Resend in {cooldownSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    className="text-[11px] font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className={`${authInputWithIconClass} font-mono text-base tracking-[0.3em] text-center font-bold text-[#4f46e8] dark:text-[#8183ff]`}
                  autoComplete="one-time-code"
                  required
                />
              </div>
            </div>

            <AuthPasswordInput
              id="password"
              label="New Account Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <AuthPasswordInput
              id="confirmPassword"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />

            {/* Password Policy Checklist */}
            <div className="p-3.5 rounded-xl border border-[#16181d]/10 dark:border-white/10 bg-white dark:bg-[#14171f] text-[11px] space-y-2">
              <p className="font-bold uppercase tracking-wider text-[10px] text-[#4b5060] dark:text-[#a7acbb]">
                Security Requirements
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  { ok: passwordCriteria.length, label: '8+ characters' },
                  { ok: passwordCriteria.upper, label: '1 uppercase letter (A-Z)' },
                  { ok: passwordCriteria.lower, label: '1 lowercase letter (a-z)' },
                  { ok: passwordCriteria.number, label: '1 numeric digit (0-9)' },
                  { ok: passwordCriteria.special, label: '1 special character (!@#$)' },
                  { ok: passwordCriteria.noRoll, label: 'No roll number in password', warn: !passwordCriteria.noRoll },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    {item.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          item.warn ? 'text-red-500' : 'text-[#4b5060]/40 dark:text-[#a7acbb]/40'
                        }`}
                      />
                    )}
                    <span
                      className={
                        item.ok
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : item.warn
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : 'text-[#4b5060] dark:text-[#a7acbb]'
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={confirmMutation.isPending || !isPasswordValid || password !== confirmPassword}
                className={authPrimaryButtonClass}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
      </div>
    </AuthShell>
  );
}

export default ActivatePageClient;
