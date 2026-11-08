'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useStudentLoginMutation } from '@/lib/api/auth';
import PublicLayout from '@/components/public/PublicLayout';
import {
  GraduationCap,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
  RefreshCw,
} from 'lucide-react';

export interface LoginPageClientProps {
  slug: string;
  initialReturnUrl?: string;
  activated?: boolean;
  initialRollNumber?: string;
}

export function LoginPageClient({
  slug,
  initialReturnUrl,
  activated = false,
  initialRollNumber = '',
}: LoginPageClientProps) {
  const router = useRouter();
  const { login } = useAuth();
  const { isDark } = useTheme();

  const collegeDisplay = slug.toUpperCase();
  const returnUrl = initialReturnUrl || `/college/${slug}/student`;

  const [identifier, setIdentifier] = useState(initialRollNumber);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const studentLoginMutation = useStudentLoginMutation(slug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your Roll Number or Email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
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
        // Authoritative cookie-first login establishes session
        login(user, token);
        router.push(returnUrl);
      } else {
        setErrorMsg('Login succeeded but user payload was missing.');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Invalid credentials or account not yet activated.');
      setErrorMsg(msg);
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
              <span>Student Portal</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              STUDENT <span className="text-[#00F0FF]">LOGIN.</span>
            </h1>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Access your {collegeDisplay} event RSVPs, registrations, and campus clubs.
            </p>
          </div>

          {/* Activation Success Banner */}
          {activated && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Account Activated!</p>
                <p className="mt-0.5 text-emerald-200/90">
                  Your password has been configured. Log in below to access your student account.
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
            {errorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div className="text-xs flex-1">
                  <p className="font-semibold">{errorMsg}</p>
                  {errorMsg.toLowerCase().includes('not yet activated') && (
                    <Link
                      href={`/college/${slug}/activate`}
                      className="mt-2 inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 underline"
                    >
                      <span>Activate your student account now</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Roll Number or Email Input */}
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

              {/* Password Input */}
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
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors cursor-pointer`}
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
                      <span>Sign In to Student Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Links & Switchers */}
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
        </div>
      </div>
    </PublicLayout>
  );
}

export default LoginPageClient;
