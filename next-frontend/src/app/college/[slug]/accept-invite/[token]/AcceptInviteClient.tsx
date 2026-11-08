'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useValidateInviteQuery, useAcceptInviteMutation } from '@/lib/api/admin';
import { useTheme } from '@/context/ThemeContext';
import PublicLayout from '@/components/public/PublicLayout';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Mail,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

export interface AcceptInviteClientProps {
  slug: string;
  token: string;
}

export function AcceptInviteClient({ slug, token }: AcceptInviteClientProps) {
  const { isDark } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  const { data: validationData, isLoading: validating, error: validateErr } = useValidateInviteQuery(
    slug,
    token
  );
  const acceptMutation = useAcceptInviteMutation(slug);

  const isValid = validationData?.valid === true;
  const invitedUser = validationData?.user;

  const hasMinLength = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!hasMinLength) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }

    if (!passwordsMatch) {
      setSubmitError('Passwords do not match.');
      return;
    }

    try {
      await acceptMutation.mutateAsync({ token, password });
      setAcceptedSuccess(true);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setSubmitError(
        errObj.response?.data?.message || 'Failed to accept invitation. The link may have expired.'
      );
    }
  };

  const managerLoginHref =
    typeof window !== 'undefined' && window.location.pathname.startsWith(`/college/${slug}`)
      ? `/college/${slug}/login/manager`
      : '/login/manager';

  return (
    <PublicLayout collegeSlug={slug}>
      <div
        className={`min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors ${
          isDark ? 'bg-[#0B0C10]' : 'bg-[#FAF9F5]'
        }`}
      >
        <div className="max-w-md w-full space-y-6 font-sans">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-[#B08D57]/10 text-[#B08D57] mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-serif tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              {acceptedSuccess ? 'Invitation Accepted!' : 'Set Up Manager Account'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {slug.toUpperCase()} Student Organization Management
            </p>
          </div>

          <div
            className={`p-6 sm:p-8 rounded-2xl border shadow-lg transition-colors ${
              isDark
                ? 'bg-[#15161E] border-gray-800 text-white'
                : 'bg-white border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            {/* Validating State */}
            {validating && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#B08D57] animate-spin" />
                <p className="text-xs text-gray-500">Validating your invitation token...</p>
              </div>
            )}

            {/* Invalid or Expired State */}
            {!validating && !isValid && (
              <div className="space-y-5 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Invalid or Expired Invitation
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {(validateErr as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                      'This invitation link is invalid, has expired, or has already been accepted.'}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href={managerLoginHref}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-semibold rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors"
                  >
                    Go to Manager Login
                  </Link>
                </div>
              </div>
            )}

            {/* Success State */}
            {!validating && acceptedSuccess && (
              <div className="space-y-5 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Account Activated Successfully!
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Your password has been configured and your manager account is now active. You may now log in to manage your club.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href={managerLoginHref}
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <span>Proceed to Manager Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Form State */}
            {!validating && isValid && !acceptedSuccess && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Invited User Summary Badge */}
                {invitedUser && (
                  <div className="p-3 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white">
                      <UserIcon className="w-3.5 h-3.5 text-[#B08D57]" />
                      <span>{invitedUser.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span>{invitedUser.email}</span>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-600 dark:text-gray-300">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={acceptMutation.isPending}
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

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-600 dark:text-gray-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={acceptMutation.isPending}
                      className={`w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none ${
                        isDark
                          ? 'bg-[#1E2029] border-gray-700 text-white focus:border-[#B08D57]'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-[#B08D57]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={acceptMutation.isPending || !hasMinLength || !passwordsMatch}
                    className="w-full py-2.5 px-4 bg-[#B08D57] hover:bg-[#997847] text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {acceptMutation.isPending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Activate Manager Account</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default AcceptInviteClient;
