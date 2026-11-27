'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCollegeAdminLoginMutation } from '@/lib/api/auth';
import type { AuthUser } from '@/types/auth';
import {
  AuthShell,
  AuthAlert,
  AuthPasswordInput,
  authInputBaseClass,
  authPrimaryButtonClass,
} from '@/components/auth/AuthShell';
import {
  ArrowRight,
  Loader2,
  Shield,
  GraduationCap,
} from 'lucide-react';

export interface CollegeAdminLoginClientProps {
  slug: string;
  initialReturnUrl?: string;
}

export function CollegeAdminLoginClient({ slug, initialReturnUrl }: CollegeAdminLoginClientProps) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const isPathTenant =
    typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`);
  const managerHref = isPathTenant ? `/college/${slug}/login/manager` : '/login/manager';
  const studentHref = isPathTenant ? `/college/${slug}/login` : '/login';

  return (
    <AuthShell
      sectionIndex="03"
      sectionLabel="COLLEGE GOVERNANCE"
      collegeDisplay={collegeDisplay}
      workspaceLabel={slug.toLowerCase()}
      backHref={`/college/${slug}`}
      backLabel={`Back to ${collegeDisplay}`}
      badgeLabel="COLLEGE ADMIN"
      heroTitle={
        <>
          Institutional governance,{' '}
          <span className="font-serif italic font-normal text-[#8183ff]">
            simplified.
          </span>
        </>
      }
      heroDescription={`Oversee departments, student rosters, club approvals, and campus-wide analytics for ${collegeDisplay}.`}
      title={
        <>
          Admin{' '}
          <span className="font-serif italic font-normal text-[#4f46e8] dark:text-[#8183ff]">
            sign in.
          </span>
        </>
      }
      subtitle={`${collegeDisplay} Institutional Governance Portal`}
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
              href={managerHref}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <Shield className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Manager Portal</span>
            </Link>
            <Link
              href={studentHref}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border border-[#16181d]/12 dark:border-white/12 bg-white dark:bg-[#14171f] hover:border-[#4f46e8]/45 dark:hover:border-[#8183ff]/45 text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7] shadow-xs transition-all"
            >
              <GraduationCap className="w-4 h-4 text-[#4b5060] dark:text-[#a7acbb] group-hover:text-[#4f46e8] dark:group-hover:text-[#8183ff] transition-colors" />
              <span>Student Portal</span>
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMsg && <AuthAlert variant="error">{errorMsg}</AuthAlert>}
        {successMsg && <AuthAlert variant="success">{successMsg}</AuthAlert>}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
            >
              Administrator Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="admin@college.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={adminLoginMutation.isPending}
              autoComplete="email"
              className={`${authInputBaseClass} px-3.5 py-2.5`}
            />
          </div>

          <AuthPasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={adminLoginMutation.isPending}
            autoComplete="current-password"
          />

          <div className="pt-1">
            <button
              type="submit"
              disabled={adminLoginMutation.isPending}
              className={authPrimaryButtonClass}
            >
              {adminLoginMutation.isPending ? (
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

export default CollegeAdminLoginClient;
