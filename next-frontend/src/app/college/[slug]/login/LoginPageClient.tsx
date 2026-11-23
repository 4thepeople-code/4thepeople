'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useStudentLoginMutation } from '@/lib/api/auth';
import { requestExternalOtp, verifyExternalOtp } from '@/lib/api/events';
import {
  setStoredExternalToken,
  setStoredExternalUser,
  getStoredExternalUser,
} from '@/lib/auth/tokenStorage';
import PublicLayout from '@/components/public/PublicLayout';
import {
  GraduationCap,
  Lock,
  User,
  Mail,
  Phone,
  Building,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
  RefreshCw,
  Globe,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

export interface LoginPageClientProps {
  slug: string;
  initialReturnUrl?: string;
  activated?: boolean;
  initialRollNumber?: string;
  initialType?: 'registered' | 'external';
}

export function LoginPageClient({
  slug,
  initialReturnUrl,
  activated = false,
  initialRollNumber = '',
  initialType = 'registered',
}: LoginPageClientProps) {
  const router = useRouter();
  const { user: currentUser, login } = useAuth();
  const { isDark } = useTheme();

  // If college admin is already logged in, redirect them to admin workspace
  useEffect(() => {
    if (currentUser?.role === 'COLLEGE_ADMIN') {
      router.replace(`/college/${slug}/admin`);
    }
  }, [currentUser, router, slug]);

  const collegeDisplay = slug.toUpperCase();
  const returnUrl = initialReturnUrl || `/college/${slug}/student`;

  // Segmented Sliding Tab: 'REGISTERED' (College Student) vs 'EXTERNAL' (Guest)
  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'EXTERNAL'>(
    initialType === 'external' ? 'EXTERNAL' : 'REGISTERED'
  );

  // -------------------------------------------------------------
  // Tab 1: Registered College Student Form State
  // -------------------------------------------------------------
  const [identifier, setIdentifier] = useState(initialRollNumber);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentErrorMsg, setStudentErrorMsg] = useState<string | null>(null);

  const studentLoginMutation = useStudentLoginMutation(slug);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentErrorMsg(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setStudentErrorMsg('Please enter your Roll Number or Email.');
      return;
    }
    if (!password) {
      setStudentErrorMsg('Please enter your password.');
      return;
    }

    const isEmail = trimmed.includes('@');
    const payload = isEmail
      ? { email: trimmed.toLowerCase(), password }
      : { rollNumber: trimmed.toUpperCase(), password };

    try {
      const response = await studentLoginMutation.mutateAsync(payload);
      const resPayload = response as unknown as {
        user?: AuthUser;
        token?: string;
        data?: { user?: AuthUser; token?: string };
      };
      const user = resPayload.user || resPayload.data?.user;
      const token = resPayload.token || resPayload.data?.token;

      if (user) {
        if (user.role === 'COLLEGE_ADMIN') {
          login(user, token);
          router.push(`/college/${slug}/admin`);
          return;
        }

        login(user, token);
        router.push(returnUrl);
      } else {
        setStudentErrorMsg('Login succeeded but user payload was missing.');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Invalid credentials or account not yet activated.');
      setStudentErrorMsg(msg);
    }
  };

  // -------------------------------------------------------------
  // Tab 2: External / Guest Participant State
  // -------------------------------------------------------------
  const existingExternal = getStoredExternalUser();
  const [externalStep, setExternalStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [externalName, setExternalName] = useState(existingExternal?.name || '');
  const [externalEmail, setExternalEmail] = useState(existingExternal?.email || '');
  const [externalPhone, setExternalPhone] = useState(existingExternal?.phone || '');
  const [externalInstitution, setExternalInstitution] = useState(existingExternal?.institutionName || '');

  // OTP inputs
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [externalErrorMsg, setExternalErrorMsg] = useState<string | null>(null);
  const [externalNotice, setExternalNotice] = useState<string | null>(null);

  // Extract optional eventId from returnUrl if present (e.g., /college/slug/events/[uuid])
  const eventIdMatch = returnUrl.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  );
  const inferredEventId = eventIdMatch ? eventIdMatch[0] : null;

  // Countdown timer for OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP input on step switch
  useEffect(() => {
    if (externalStep === 'OTP') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [externalStep]);

  const handleRequestExternalOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setExternalErrorMsg(null);
    setExternalNotice(null);

    const trimmedEmail = externalEmail.trim().toLowerCase();
    const trimmedName = externalName.trim();

    if (!trimmedEmail) {
      setExternalErrorMsg('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setExternalErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!trimmedName || trimmedName.length < 2) {
      setExternalErrorMsg('Please enter your full name (minimum 2 characters).');
      return;
    }

    try {
      setIsRequestingOtp(true);
      await requestExternalOtp(inferredEventId, trimmedEmail);
      setExternalNotice(`A 6-digit access code has been dispatched to ${trimmedEmail}.`);
      setCooldown(60);
      setExternalStep('OTP');
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to send verification code. Please try again.';
      setExternalErrorMsg(msg);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setExternalErrorMsg(null);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  const handleVerifyExternalOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setExternalErrorMsg(null);

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setExternalErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const trimmedEmail = externalEmail.trim().toLowerCase();
      const res = await verifyExternalOtp(trimmedEmail, fullCode, inferredEventId || undefined);

      if (res?.token) {
        setStoredExternalToken(res.token);
        const externalProfile = {
          name: externalName.trim(),
          email: trimmedEmail,
          phone: externalPhone.trim() || undefined,
          institutionName: externalInstitution.trim() || undefined,
        };
        setStoredExternalUser(externalProfile);

        // Populate session
        login(
          {
            id: `ext_${trimmedEmail}`,
            name: externalName.trim(),
            email: trimmedEmail,
            role: 'EXTERNAL',
          },
          res.token
        );

        // Redirect back to returnUrl or events directory
        router.push(returnUrl);
      } else {
        setExternalErrorMsg('Verification succeeded but security token was not received.');
      }
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid or expired verification code. Please check and try again.';
      setExternalErrorMsg(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Header Card */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Event & Campus Portal</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              SIGN <span className="text-[#00F0FF]">IN.</span>
            </h1>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Access your {collegeDisplay} registrations, RSVPs, and public events.
            </p>
          </div>

          {/* Activation Success Banner */}
          {activated && activeTab === 'REGISTERED' && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Account Activated!</p>
                <p className="mt-0.5 text-emerald-200/90">
                  Your password has been configured. Sign in below to access your student account.
                </p>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${
              isDark
                ? 'bg-[#12141C] border-white/10 shadow-black/40'
                : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            {/* Sliding Segmented Buttons */}
            <div className="relative p-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center mb-6">
              {/* Sliding background indicator */}
              <div
                className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm ${
                  activeTab === 'REGISTERED'
                    ? 'left-1.5 bg-white dark:bg-[#1A1D2B] border border-slate-200/80 dark:border-white/15'
                    : 'left-[calc(50%+3px)] bg-white dark:bg-[#1A1D2B] border border-slate-200/80 dark:border-white/15'
                }`}
              />

              {/* Option 1: Registered College */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('REGISTERED');
                  setStudentErrorMsg(null);
                }}
                className={`relative z-10 flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'REGISTERED'
                    ? 'text-cyan-600 dark:text-[#00F0FF]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Registered College</span>
              </button>

              {/* Option 2: External */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('EXTERNAL');
                  setExternalErrorMsg(null);
                }}
                className={`relative z-10 flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'EXTERNAL'
                    ? 'text-[#FF5733] dark:text-[#FF5733]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>External</span>
              </button>
            </div>

            {/* TAB 1: Registered College Student Form */}
            {activeTab === 'REGISTERED' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {studentErrorMsg && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                    <div className="text-xs flex-1">
                      <p className="font-semibold">{studentErrorMsg}</p>
                      {studentErrorMsg.toLowerCase().includes('not yet activated') && (
                        <Link
                          href={`/college/${slug}/activate`}
                          className="mt-2 inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 underline"
                        >
                          <span>Activate your student account now</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {studentErrorMsg.toLowerCase().includes('admin') && (
                        <Link
                          href={`/college/${slug}/login/admin`}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 font-bold tracking-wide"
                        >
                          <Shield className="w-3.5 h-3.5 text-red-400" />
                          <span>Go to College Admin Portal</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  {/* Roll Number or Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="identifier"
                      className={`block text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-slate-700'
                      }`}
                    >
                      Roll Number or Email
                    </label>
                    <div className="relative">
                      <User
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                          isDark ? 'text-gray-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. 21A91A0501 or user@lbrce.ac.in"
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark
                            ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className={`block text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-slate-700'
                      }`}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                          isDark ? 'text-gray-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`w-full pl-10 pr-11 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark
                            ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={studentLoginMutation.isPending}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 active:scale-[0.99] cursor-pointer"
                    >
                      {studentLoginMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In as College Student</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Quick Links */}
                <div className={`mt-6 pt-6 border-t space-y-3 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>First time student?</span>
                    <Link
                      href={`/college/${slug}/activate`}
                      className="font-bold text-[#00F0FF] hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Activate Account</span>
                    </Link>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>Club Manager or Staff?</span>
                    <Link
                      href={`/college/${slug}/manager/login`}
                      className="font-semibold text-gray-300 hover:text-white inline-flex items-center gap-1"
                    >
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      <span>Manager Portal</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: External / Guest Participant Form */}
            {activeTab === 'EXTERNAL' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {externalErrorMsg && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                    <div className="text-xs flex-1">
                      <p className="font-semibold">{externalErrorMsg}</p>
                    </div>
                  </div>
                )}

                {externalNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="text-xs flex-1">
                      <p className="font-semibold">{externalNotice}</p>
                    </div>
                  </div>
                )}

                {/* STEP A: Enter Details & Request OTP */}
                {externalStep === 'DETAILS' && (
                  <form onSubmit={handleRequestExternalOtp} className="space-y-4">
                    <div className="text-xs text-slate-500 dark:text-gray-400 pb-1">
                      Sign in with your email to register for public campus events without a college student ID.
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <label
                        className={`block text-[11px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        Full Name <span className="text-[#FF5733]">*</span>
                      </label>
                      <div className="relative">
                        <User
                          className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                            isDark ? 'text-gray-500' : 'text-slate-400'
                          }`}
                        />
                        <input
                          type="text"
                          value={externalName}
                          onChange={(e) => setExternalName(e.target.value)}
                          placeholder="e.g. Priya Sharma"
                          className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#FF5733] ${
                            isDark
                              ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                              : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                          }`}
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label
                        className={`block text-[11px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        Email Address <span className="text-[#FF5733]">*</span>
                      </label>
                      <div className="relative">
                        <Mail
                          className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                            isDark ? 'text-gray-500' : 'text-slate-400'
                          }`}
                        />
                        <input
                          type="email"
                          value={externalEmail}
                          onChange={(e) => setExternalEmail(e.target.value)}
                          placeholder="e.g. priya@gmail.com"
                          className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#FF5733] ${
                            isDark
                              ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                              : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                          }`}
                          required
                        />
                      </div>
                    </div>

                    {/* Optional Phone & Institution */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          className={`block text-[11px] font-bold uppercase tracking-wider ${
                            isDark ? 'text-gray-300' : 'text-slate-700'
                          }`}
                        >
                          Phone <span className="text-gray-500 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                          <Phone
                            className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                              isDark ? 'text-gray-500' : 'text-slate-400'
                            }`}
                          />
                          <input
                            type="tel"
                            value={externalPhone}
                            onChange={(e) => setExternalPhone(e.target.value)}
                            placeholder="9876543210"
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#FF5733] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          className={`block text-[11px] font-bold uppercase tracking-wider ${
                            isDark ? 'text-gray-300' : 'text-slate-700'
                          }`}
                        >
                          Institution <span className="text-gray-500 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                          <Building
                            className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                              isDark ? 'text-gray-500' : 'text-slate-400'
                            }`}
                          />
                          <input
                            type="text"
                            value={externalInstitution}
                            onChange={(e) => setExternalInstitution(e.target.value)}
                            placeholder="College / Company"
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#FF5733] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Send Code CTA */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isRequestingOtp}
                        className="w-full py-3.5 px-4 rounded-xl bg-[#FF5733] hover:bg-[#E64A26] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/20 active:scale-[0.99] cursor-pointer"
                      >
                        {isRequestingOtp ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Sending Access Code...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Verification Code</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP B: Enter 6-digit OTP Code */}
                {externalStep === 'OTP' && (
                  <form onSubmit={handleVerifyExternalOtp} className="space-y-4">
                    <div className="flex items-center justify-between pb-1">
                      <button
                        type="button"
                        onClick={() => setExternalStep('DETAILS')}
                        className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Change Email</span>
                      </button>
                      <span className="text-[11px] font-mono text-cyan-400">{externalEmail}</span>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className={`block text-[11px] font-bold uppercase tracking-wider text-center ${
                          isDark ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        Enter 6-Digit Access Code
                      </label>
                      <div className="flex items-center justify-center gap-2 sm:gap-2.5 pt-1">
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              otpInputRefs.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            onPaste={handleOtpPaste}
                            className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold rounded-xl border transition-all focus:outline-hidden ${
                              digit
                                ? 'border-[#FF5733] text-[#FF5733] bg-[#FF5733]/10'
                                : isDark
                                ? 'border-white/15 bg-black/40 text-white focus:border-[#FF5733]'
                                : 'border-slate-300 bg-white text-slate-900 focus:border-[#FF5733]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Resend Cooldown */}
                    <div className="text-center text-xs pt-1">
                      {cooldown > 0 ? (
                        <span className="text-slate-500">Resend code in {cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestExternalOtp()}
                          disabled={isRequestingOtp}
                          className="font-bold text-[#FF5733] hover:underline cursor-pointer"
                        >
                          Resend Code
                        </button>
                      )}
                    </div>

                    {/* Verify & Enter CTA */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
                        className="w-full py-3.5 px-4 rounded-xl bg-[#FF5733] hover:bg-[#E64A26] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/20 active:scale-[0.99] cursor-pointer"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Verifying Code...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4" />
                            <span>Verify & Sign In</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Explanatory footer for External */}
                <div className={`mt-6 pt-5 border-t text-[11px] text-slate-500 dark:text-gray-400 space-y-1.5 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <p>
                    • No password needed. Access codes are securely generated and verified for each session.
                  </p>
                  <p>
                    • External registration applies to open public events across {collegeDisplay}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default LoginPageClient;
