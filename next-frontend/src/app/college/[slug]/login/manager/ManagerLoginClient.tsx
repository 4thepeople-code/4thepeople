'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  useManagerLoginMutation,
  useManagerForgotPasswordMutation,
  useManagerResetPasswordMutation,
} from '@/lib/api/auth';
import type { AuthUser } from '@/types/auth';
import PublicLayout from '@/components/public/PublicLayout';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  KeyRound,
} from 'lucide-react';

export interface ManagerLoginClientProps {
  slug: string;
  initialReturnUrl?: string;
}

export function ManagerLoginClient({ slug, initialReturnUrl }: ManagerLoginClientProps) {
  const { user, login } = useAuth();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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
      const adminUrl = typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
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
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-300">
          {/* Header Card */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 text-[10px] font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manager Workspace</span>
            </div>

            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-black uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Manager <span className="text-[#00F0FF]">Login</span>
            </h1>

            <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Sign in to manage clubs, create events, and oversee campus registrations at{' '}
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{collegeDisplay}</strong>.
            </p>
          </div>

          {/* Form Box */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md transition-all ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p>{successMsg}</p>
              </div>
            )}

            {!isForgotPassword ? (
              /* LOGIN FORM */
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    Manager Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="manager@college.ac.in"
                      required
                      autoComplete="email"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-xs font-medium transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className={`block text-xs font-bold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-slate-700'
                      }`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] font-bold text-[#00F0FF] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className={`w-full pl-10 pr-12 py-3 rounded-2xl border text-xs font-medium transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={managerLoginMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 transition-all cursor-pointer disabled:opacity-50"
                >
                  {managerLoginMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Manager Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : !otpSent ? (
              /* FORGOT PASSWORD: STEP 1 (REQUEST OTP) */
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-2">
                  <h3
                    className={`font-['Syne',sans-serif] text-base font-bold uppercase ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Reset Manager Password
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    Enter your manager email address to receive a 6-digit one-time verification code.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    Manager Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="manager@college.ac.in"
                      required
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-xs font-medium transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-3 rounded-full border text-xs font-bold uppercase tracking-wider transition ${
                      isDark
                        ? 'border-white/10 text-gray-300 hover:bg-white/5'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={forgotPasswordMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 transition disabled:opacity-50"
                  >
                    {forgotPasswordMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Send OTP</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* FORGOT PASSWORD: STEP 2 (VERIFY OTP & SET PASSWORD) */
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <h3
                    className={`font-['Syne',sans-serif] text-base font-bold uppercase ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Enter Verification Code
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    Enter the 6-digit code sent to <strong className="text-[#00F0FF]">{email}</strong> and
                    choose a new password.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    6-Digit OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-xs font-mono tracking-widest text-center font-bold focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className={`w-full pl-10 pr-12 py-3 rounded-2xl border text-xs font-medium focus:outline-hidden focus:border-[#00F0FF] ${
                        isDark
                          ? 'bg-[#0B0C10] border-white/10 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setIsForgotPassword(false);
                    }}
                    className={`flex-1 py-3 rounded-full border text-xs font-bold uppercase tracking-wider transition ${
                      isDark
                        ? 'border-white/10 text-gray-300 hover:bg-white/5'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Back to Login
                  </button>

                  <button
                    type="submit"
                    disabled={resetPasswordMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 transition disabled:opacity-50"
                  >
                    {resetPasswordMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Save Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Toggle to Student Portal Login */}
            <div
              className={`mt-6 pt-6 border-t text-center text-xs ${
                isDark ? 'border-white/10 text-gray-400' : 'border-slate-200 text-slate-600'
              }`}
            >
              <span>Are you an enrolled student? </span>
              <Link
                href={`/college/${slug}/login`}
                className="font-bold text-[#00F0FF] hover:underline"
              >
                Go to Student Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default ManagerLoginClient;
