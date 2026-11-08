'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCollegeAdminLoginMutation } from '@/lib/api/auth';
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
} from 'lucide-react';

export interface CollegeAdminLoginClientProps {
  slug: string;
  initialReturnUrl?: string;
}

export function CollegeAdminLoginClient({ slug, initialReturnUrl }: CollegeAdminLoginClientProps) {
  const { login } = useAuth();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';
  const returnUrl =
    initialReturnUrl ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
      ? `/college/${slug}/admin`
      : '/admin');

  const adminLoginMutation = useCollegeAdminLoginMutation(slug);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your administrator email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    try {
      const response = await adminLoginMutation.mutateAsync({
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
        window.location.href = returnUrl;
      } else {
        setErrorMsg('Login succeeded but user payload was missing.');
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { message?: string } } };
      if (errObj.response?.status === 429) {
        setErrorMsg('Too many login attempts. Please wait a moment and try again.');
      } else {
        setErrorMsg(
          errObj.response?.data?.message ||
          'Invalid administrator email or password.'
        );
      }
    }
  };

  return (
    <PublicLayout collegeSlug={slug}>
      <div
        className={`min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors ${
          isDark ? 'bg-[#0B0C10]' : 'bg-[#FAF9F5]'
        }`}
      >
        <div className="max-w-md w-full space-y-6">
          {/* Header Card */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-[#B08D57]/10 text-[#B08D57] mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-serif tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              College Administrator Login
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {collegeDisplay} Institutional Governance Portal
            </p>
          </div>

          {/* Form Container */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border shadow-lg transition-colors font-sans ${
              isDark
                ? 'bg-[#15161E] border-gray-800 text-white'
                : 'bg-white border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-600 dark:text-gray-300">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="admin@college.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={adminLoginMutation.isPending}
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none ${
                      isDark
                        ? 'bg-[#1E2029] border-gray-700 text-white focus:border-[#B08D57]'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-[#B08D57]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-600 dark:text-gray-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={adminLoginMutation.isPending}
                    className={`w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none ${
                      isDark
                        ? 'bg-[#1E2029] border-gray-700 text-white focus:border-[#B08D57]'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-[#B08D57]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={adminLoginMutation.isPending}
                  className="w-full py-2.5 px-4 bg-[#B08D57] hover:bg-[#997847] text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {adminLoginMutation.isPending ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In as College Admin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center space-y-2">
              <p className="text-xs text-gray-500">
                Are you a club manager?{' '}
                <Link
                  href={typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`) ? `/college/${slug}/login/manager` : '/login/manager'}
                  className="text-[#B08D57] hover:underline font-medium"
                >
                  Manager Login
                </Link>
              </p>
              <p className="text-xs text-gray-500">
                Are you a student?{' '}
                <Link
                  href={typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`) ? `/college/${slug}/login` : '/login'}
                  className="text-[#B08D57] hover:underline font-medium"
                >
                  Student Portal
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default CollegeAdminLoginClient;
