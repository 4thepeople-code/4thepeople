'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  useManagerLoginMutation,
  useManagerForgotPasswordMutation,
  useManagerResetPasswordMutation,
} from '@/lib/api/auth';
import type { AuthUser } from '@/types/auth';
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
  Mail,
  ArrowRight,
  KeyRound,
  Loader2,
  GraduationCap,
} from 'lucide-react';

export interface ManagerLoginClientProps {
  slug: string;
  initialReturnUrl?: string;
}

export function ManagerLoginClient({ slug, initialReturnUrl }: ManagerLoginClientProps) {
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';
  const returnUrl =
    initialReturnUrl ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
      ? `/college/${slug}/manager`
      : '/manager');

  // If already authenticated as College Admin, redirect to College Admin portal
  React.useEffect(() => {
    if (user && user.role === 'COLLEGE_ADMIN') {
      const adminUrl =
        typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
          ? `/college/${slug}/admin`
          : '/admin';
      window.location.href = adminUrl;
    }
  }, [user, slug]);

  const managerLoginMutation = useManagerLoginMutation(slug);
  const forgotPasswordMutation = useManagerForgotPasswordMutation();
  const resetPasswordMutation = useManagerResetPasswordMutation();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your manager email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    try {
      const response = await managerLoginMutation.mutateAsync({
        email: trimmedEmail,
        password,
      });

      const resPayload = response as unknown as {
        user?: AuthUser;
        token?: string;
        data?: { user?: AuthUser; token?: string };
      };
      const user = resPayload.user || resPayload.data?.user;
      const token = resPayload.token || resPayload.data?.token;

      if (user) {
        login(user, token);
        if (user.role === 'COLLEGE_ADMIN') {
          const adminUrl =
            typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
              ? `/college/${slug}/admin`
              : '/admin';
          window.location.href = adminUrl;
        } else {
          window.location.href = returnUrl;
        }
      } else {
        setErrorMsg('Login succeeded but user payload was missing.');
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { message?: string } } };
      if (errObj.response?.status === 429) {
        setErrorMsg('Too many login attempts. Please wait a moment and try again.');
      } else {
        setErrorMsg(
          errObj.response?.data?.message || 'Invalid email or password for this college workspace.'
        );
      }
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your registered manager email address.');
      return;
    }

    try {
      await forgotPasswordMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setOtpSent(true);
      setSuccessMsg('A 6-digit reset code has been sent to your email.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to send reset code. Verify your email address.';
      setErrorMsg(msg);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setErrorMsg('Please enter the 6-digit reset code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password: newPassword,
      });
      setSuccessMsg('Password updated successfully! Please log in with your new credentials.');
      setIsForgotPassword(false);
      setOtpSent(false);
      setPassword('');
      setOtp('');
      setNewPassword('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid or expired reset code. Please try again.';
      setErrorMsg(msg);
    }
  };

  return (
    <AuthShell
      sectionIndex="02"
      sectionLabel="MANAGER PORTAL"
      collegeDisplay={collegeDisplay}
      workspaceLabel={slug.toLowerCase()}
      backHref={`/college/${slug}`}
      backLabel={`Back to ${collegeDisplay}`}
      badgeLabel="MANAGER SIGN-IN"
      heroTitle={
        <>
          Lead clubs and{' '}
          <span className="font-serif italic font-normal text-[#8183ff]">
            campus events.
          </span>
        </>
      }
      heroDescription={`Manage club rosters, publish verified campus events, track registrations, and issue digital certificates at ${collegeDisplay}.`}
      title={
        <>
          Manager{' '}
          <span className="font-serif italic font-normal text-[#4f46e8] dark:text-[#8183ff]">
            sign in.
          </span>
        </>
      }
      subtitle={`Sign in to manage clubs and events at ${collegeDisplay}.`}
      footer={
        <div className="space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-[#16181d]/10 dark:border-white/10" />
            <span className="bg-white dark:bg-[#14171f] px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4b5060]/70 dark:text-[#a7acbb]/70 whitespace-nowrap">
              OTHER PORTALS
            </span>
            <div className="w-full border-t border-[#16181d]/10 dark:border-white/10" />
          </div>

          <Link
            href={`/college/${slug}/login`}
            className="group flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
          >
            <GraduationCap className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
            <span>Student Portal</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMsg && <AuthAlert variant="error">{errorMsg}</AuthAlert>}
        {successMsg && <AuthAlert variant="success">{successMsg}</AuthAlert>}

        {!isForgotPassword ? (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@college.ac.in"
                required
                autoComplete="email"
                disabled={managerLoginMutation.isPending}
                className={`${authInputBaseClass} px-3.5 py-2.5`}
              />
            </div>

            <AuthPasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={managerLoginMutation.isPending}
              rightLabelAction={
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#ececfd] dark:bg-[#6366f1]/15 text-[11px] font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              }
            />

            <div className="pt-1">
              <button
                type="submit"
                disabled={managerLoginMutation.isPending}
                className={authPrimaryButtonClass}
              >
                {managerLoginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : !otpSent ? (
          /* FORGOT PASSWORD: STEP 1 (REQUEST OTP) */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#16181d] dark:text-[#f2f3f7]">
                Reset manager password
              </h2>
              <p className="text-xs text-[#4b5060] dark:text-[#a7acbb]">
                Enter your manager email address to receive a 6-digit one-time verification code.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="resetEmail"
                className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
              >
                Manager Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                <input
                  id="resetEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@college.ac.in"
                  required
                  className={authInputWithIconClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMsg('');
                }}
                className={`flex-1 ${authSecondaryButtonClass}`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className={`flex-1 ${authPrimaryButtonClass}`}
              >
                {forgotPasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Send OTP</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* FORGOT PASSWORD: STEP 2 (VERIFY OTP & SET PASSWORD) */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#16181d] dark:text-[#f2f3f7]">
                Enter verification code
              </h2>
              <p className="text-xs text-[#4b5060] dark:text-[#a7acbb]">
                Enter the 6-digit code sent to <strong className="text-[#16181d] dark:text-white">{email}</strong> and
                choose a new password.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="otp"
                className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
              >
                6-Digit OTP Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5060]/70 dark:text-[#a7acbb]/70 pointer-events-none" />
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className={`${authInputWithIconClass} font-mono text-base tracking-[0.3em] text-center font-bold text-[#4f46e8] dark:text-[#8183ff]`}
                />
              </div>
            </div>

            <AuthPasswordInput
              id="newPassword"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setIsForgotPassword(false);
                }}
                className={`flex-1 ${authSecondaryButtonClass}`}
              >
                Back to Login
              </button>

              <button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className={`flex-1 ${authPrimaryButtonClass}`}
              >
                {resetPasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Save Password</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

export default ManagerLoginClient;
