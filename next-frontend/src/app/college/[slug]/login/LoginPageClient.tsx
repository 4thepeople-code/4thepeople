'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
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
  const { user: currentUser, login } = useAuth();

  // If college admin is already logged in, redirect them to admin workspace
  React.useEffect(() => {
    if (currentUser?.role === 'COLLEGE_ADMIN') {
      router.replace(`/college/${slug}/admin`);
    }
  }, [currentUser, router, slug]);

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
        // If college admin logs in, route to admin portal directly
        if (user.role === 'COLLEGE_ADMIN') {
          login(user, token);
          router.push(`/college/${slug}/admin`);
          return;
        }

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
      <div className="college-scope min-h-[calc(100vh-200px)] bg-[var(--surface-page)] text-[var(--text-primary)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Header Card */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)] shadow-brutal-xs mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student Portal</span>
            </div>

            <h1 className="font-campus text-4xl sm:text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)]">
              STUDENT <span className="text-[var(--accent-strong)]">LOGIN.</span>
            </h1>

            <p className="text-xs max-w-sm mx-auto text-[var(--text-secondary)] font-medium">
              Access your {collegeDisplay} event RSVPs, registrations, and campus clubs.
            </p>
          </div>

          {/* Activation Success Banner */}
          {activated && (
            <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 flex items-start gap-3 text-emerald-800 dark:text-emerald-200 shadow-brutal-xs">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Account Activated!</p>
                <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                  Your password has been configured. Log in below to access your student account.
                </p>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] shadow-brutal-md space-y-5">
            {errorMsg && (
              <div className="p-4 rounded-2xl border-2 border-red-500/40 bg-red-500/10 flex items-start gap-3 text-red-700 dark:text-red-300 shadow-brutal-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <div className="text-xs flex-1">
                  <p className="font-bold">{errorMsg}</p>
                  {errorMsg.toLowerCase().includes('not yet activated') && (
                    <Link
                      href={`/college/${slug}/activate`}
                      className="mt-2 inline-flex items-center gap-1 font-bold text-[var(--accent-strong)] hover:underline"
                    >
                      <span>Activate your student account now</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  {errorMsg.toLowerCase().includes('admin') && (
                    <Link
                      href={`/college/${slug}/login/admin`}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-[var(--text-primary)] font-bold tracking-wide shadow-brutal-xs"
                    >
                      <Shield className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                      <span>Go to College Admin Portal</span>
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
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Roll Number or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 21A91A0501 or user@lbrce.ac.in"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent-strong)] shadow-brutal-xs"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
                  className="w-full py-3.5 px-4 rounded-xl bg-[var(--accent-strong)] hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 shadow-brutal-sm cursor-pointer"
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
            <div className="mt-6 pt-5 border-t-2 border-[var(--border-soft)] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium">First time student?</span>
                <Link
                  href={`/college/${slug}/activate`}
                  className="font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Activate Account</span>
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[var(--text-secondary)] font-medium">Club Manager or Staff?</span>
                <Link
                  href={`/college/${slug}/manager/login`}
                  className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)] inline-flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-purple-500" />
                  <span>Manager Portal</span>
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[var(--text-secondary)] font-medium">College Administrator?</span>
                <Link
                  href={`/college/${slug}/login/admin`}
                  className="font-semibold text-[#B08D57] hover:underline inline-flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Admin Portal</span>
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
