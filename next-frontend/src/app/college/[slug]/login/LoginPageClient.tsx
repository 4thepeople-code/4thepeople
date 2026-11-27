'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { useStudentLoginMutation } from '@/lib/api/auth';
import {
  AuthShell,
  AuthAlert,
  AuthPasswordInput,
  authInputBaseClass,
  authPrimaryButtonClass,
} from '@/components/auth/AuthShell';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Loader2,
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
    <AuthShell
      sectionIndex="01"
      sectionLabel="STUDENT PORTAL"
      collegeDisplay={collegeDisplay}
      workspaceLabel={slug.toLowerCase()}
      backHref={`/college/${slug}`}
      backLabel={`Back to ${collegeDisplay}`}
      badgeLabel="STUDENT SIGN-IN"
      title={
        <>
          Welcome{' '}
          <span className="font-serif italic font-normal text-[#4f46e8] dark:text-[#8183ff]">
            back.
          </span>
        </>
      }
      subtitle={`Sign in to continue your ${collegeDisplay} campus journey.`}
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
              href={`/college/${slug}/login/manager`}
              className="group flex flex-col items-center justify-center gap-1.5 py-3.5 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <Shield className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Manager Portal</span>
            </Link>
            <Link
              href={`/college/${slug}/activate`}
              className="group flex flex-col items-center justify-center gap-1.5 py-3.5 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Activate Account</span>
            </Link>
          </div>

          <p className="text-center text-[11px] text-[#4b5060] dark:text-[#a7acbb]">
            First time at {collegeDisplay}?{' '}
            <Link
              href={`/college/${slug}/activate`}
              className="font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline"
            >
              Activate your student account
            </Link>
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {activated && (
          <AuthAlert variant="success" title="Account activated">
            Your password has been configured. Sign in below to access your student account.
          </AuthAlert>
        )}

        {errorMsg && (
          <AuthAlert variant="error">
            <p>{errorMsg}</p>
            {errorMsg.toLowerCase().includes('not yet activated') && (
              <Link
                href={`/college/${slug}/activate`}
                className="mt-2 inline-flex items-center gap-1 font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline"
              >
                <span>Activate your student account now</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
            {errorMsg.toLowerCase().includes('admin') && (
              <Link
                href={`/college/${slug}/login/admin`}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#16181d]/15 dark:border-white/15 bg-white dark:bg-[#14171f] text-[#16181d] dark:text-[#f2f3f7] font-semibold"
              >
                <Shield className="w-3.5 h-3.5 text-[#4f46e8]" />
                <span>Go to College Admin Portal</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </AuthAlert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="identifier"
              className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
            >
              Roll Number or Email
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 21A91A0501 or user@lbrce.ac.in"
              className={`${authInputBaseClass} px-3.5 py-2.5`}
              autoComplete="username"
              disabled={studentLoginMutation.isPending}
              required
            />
          </div>

          <AuthPasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={studentLoginMutation.isPending}
            autoComplete="current-password"
          />

          <div className="pt-1">
            <button
              type="submit"
              disabled={studentLoginMutation.isPending}
              className={authPrimaryButtonClass}
            >
              {studentLoginMutation.isPending ? (
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
      </div>
    </AuthShell>
  );
}

export default LoginPageClient;
