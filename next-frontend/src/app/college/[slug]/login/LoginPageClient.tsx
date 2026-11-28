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
  authInputWithIconClass,
  authPrimaryButtonClass,
} from '@/components/auth/AuthShell';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Loader2,
  GraduationCap,
  Globe,
  LogIn,
  UserPlus,
  Mail,
  User,
  Building2,
  Phone,
  BookOpen,
} from 'lucide-react';

export interface LoginPageClientProps {
  slug: string;
  initialReturnUrl?: string;
  activated?: boolean;
  initialRollNumber?: string;
}

type AuthMode = 'COLLEGE' | 'EXTERNAL';
type ExternalTab = 'SIGN_IN' | 'CREATE_ACCOUNT';

const EXTERNAL_CTA_BUTTON_CLASS =
  'w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f94d30] hover:bg-[#e03e22] active:bg-[#c8331a] text-white text-xs font-bold uppercase tracking-[0.08em] shadow-sm shadow-[#f94d30]/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f94d30] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

const EXTERNAL_FIELD_LABEL_CLASS =
  'block text-[10px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]';

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

  const [authMode, setAuthMode] = useState<AuthMode>('COLLEGE');
  const [externalTab, setExternalTab] = useState<ExternalTab>('SIGN_IN');

  // Registered College form state
  const [identifier, setIdentifier] = useState(initialRollNumber);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // External Sign In state
  const [extSignInEmail, setExtSignInEmail] = useState('');

  // External Create Account state
  const [extFullName, setExtFullName] = useState('');
  const [extCreateEmail, setExtCreateEmail] = useState('');
  const [extRollNumber, setExtRollNumber] = useState('');
  const [extDepartment, setExtDepartment] = useState('');
  const [extGender, setExtGender] = useState('');
  const [extYearOfStudy, setExtYearOfStudy] = useState('');
  const [extInstitution, setExtInstitution] = useState('');
  const [extPhone, setExtPhone] = useState('');

  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalInfo, setExternalInfo] = useState<string | null>(null);

  const studentLoginMutation = useStudentLoginMutation(slug);

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMsg(null);
    setExternalError(null);
    setExternalInfo(null);
  };

  const switchExternalTab = (tab: ExternalTab) => {
    setExternalTab(tab);
    setExternalError(null);
    setExternalInfo(null);
  };

  const handleExternalSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setExternalError(null);
    setExternalInfo(null);

    const trimmedEmail = extSignInEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setExternalError('Please enter a valid email address.');
      return;
    }

    setExternalInfo(
      `External portal sign-in is not yet connected to a backend endpoint. To register as an external participant, open any public event under ${collegeDisplay} and verify your email there.`
    );
  };

  const handleExternalCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setExternalError(null);
    setExternalInfo(null);

    const trimmedEmail = extCreateEmail.trim().toLowerCase();
    if (
      !extFullName.trim() ||
      !trimmedEmail ||
      !extRollNumber.trim() ||
      !extDepartment.trim() ||
      !extGender ||
      !extYearOfStudy ||
      !extInstitution.trim() ||
      !extPhone.trim()
    ) {
      setExternalError('Please fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setExternalError('Please enter a valid email address.');
      return;
    }

    setExternalInfo(
      `External account creation is not yet connected to a backend endpoint. To register as an external participant, open any public event under ${collegeDisplay} and verify your email there.`
    );
  };

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
      maxWidth={authMode === 'EXTERNAL' ? 'lg' : 'md'}
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
        {/* Top Mode Toggle: REGISTERED COLLEGE vs EXTERNAL */}
        <div
          role="tablist"
          aria-label="Sign in mode"
          className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#16181d]/10 dark:border-white/12 bg-[#faf7f2] dark:bg-[#0d0f14] p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'COLLEGE'}
            onClick={() => switchAuthMode('COLLEGE')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.06em] transition-all cursor-pointer ${
              authMode === 'COLLEGE'
                ? 'bg-white dark:bg-[#181c26] text-[#16181d] dark:text-[#f2f3f7] shadow-xs border border-[#16181d]/10 dark:border-white/12'
                : 'text-[#4b5060] dark:text-[#a7acbb] hover:text-[#16181d] dark:hover:text-[#f2f3f7]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>Registered College</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'EXTERNAL'}
            onClick={() => switchAuthMode('EXTERNAL')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.06em] transition-all cursor-pointer ${
              authMode === 'EXTERNAL'
                ? 'bg-white dark:bg-[#181c26] text-[#f94d30] dark:text-[#ff6a5c] shadow-xs border border-[#16181d]/10 dark:border-white/12'
                : 'text-[#4b5060] dark:text-[#a7acbb] hover:text-[#16181d] dark:hover:text-[#f2f3f7]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>External</span>
          </button>
        </div>

        {authMode === 'COLLEGE' ? (
          <>
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
          </>
        ) : (
          <div className="space-y-4">
            {/* External Sub-Tabs: Sign In vs Create Account */}
            <div
              role="tablist"
              aria-label="External authentication options"
              className="grid grid-cols-2 gap-1 rounded-xl border border-[#16181d]/10 dark:border-white/12 bg-[#faf7f2] dark:bg-[#0d0f14] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={externalTab === 'SIGN_IN'}
                onClick={() => switchExternalTab('SIGN_IN')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
                  externalTab === 'SIGN_IN'
                    ? 'bg-white dark:bg-[#181c26] text-[#f94d30] dark:text-[#ff6a5c] shadow-xs border border-[#16181d]/10 dark:border-white/12'
                    : 'text-[#4b5060] dark:text-[#a7acbb] hover:text-[#16181d] dark:hover:text-[#f2f3f7]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={externalTab === 'CREATE_ACCOUNT'}
                onClick={() => switchExternalTab('CREATE_ACCOUNT')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold transition-all cursor-pointer ${
                  externalTab === 'CREATE_ACCOUNT'
                    ? 'bg-white dark:bg-[#181c26] text-[#f94d30] dark:text-[#ff6a5c] shadow-xs border border-[#16181d]/10 dark:border-white/12'
                    : 'text-[#4b5060] dark:text-[#a7acbb] hover:text-[#16181d] dark:hover:text-[#f2f3f7]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Create Account</span>
              </button>
            </div>

            {externalError && (
              <AuthAlert variant="error">
                <p>{externalError}</p>
              </AuthAlert>
            )}

            {externalInfo && (
              <AuthAlert variant="info">
                <p>{externalInfo}</p>
                <Link
                  href={`/college/${slug}/events`}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-[#4f46e8] dark:text-[#8183ff] hover:underline"
                >
                  <span>Browse public {collegeDisplay} events</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </AuthAlert>
            )}

            {externalTab === 'SIGN_IN' ? (
              <form onSubmit={handleExternalSignIn} className="space-y-4">
                <p className="text-xs leading-relaxed text-[#4b5060] dark:text-[#a7acbb]">
                  Sign in to your external account using your registered email address. A one-time
                  code will be dispatched.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="ext-signin-email" className={EXTERNAL_FIELD_LABEL_CLASS}>
                    Email Address <span className="text-[#f94d30]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                    <input
                      id="ext-signin-email"
                      type="email"
                      value={extSignInEmail}
                      onChange={(e) => setExtSignInEmail(e.target.value)}
                      placeholder="e.g. priya@gmail.com"
                      className={authInputWithIconClass}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className={EXTERNAL_CTA_BUTTON_CLASS}>
                  <span>Send Login Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center text-xs text-[#4b5060] dark:text-[#a7acbb]">
                  First time here?{' '}
                  <button
                    type="button"
                    onClick={() => switchExternalTab('CREATE_ACCOUNT')}
                    className="font-semibold text-[#f94d30] dark:text-[#ff6a5c] hover:underline cursor-pointer"
                  >
                    Create an external account
                  </button>
                </p>

                <ul className="pt-3 border-t border-[#16181d]/10 dark:border-white/10 space-y-1.5 text-[11px] leading-relaxed text-[#4b5060] dark:text-[#a7acbb]">
                  <li>
                    &bull; No password needed. Access codes are securely generated and verified for
                    each session.
                  </li>
                  <li>
                    &bull; External registration applies to open public events across{' '}
                    {collegeDisplay}.
                  </li>
                </ul>
              </form>
            ) : (
              <form onSubmit={handleExternalCreateAccount} className="space-y-4">
                <p className="text-xs leading-relaxed text-[#4b5060] dark:text-[#a7acbb]">
                  First-time external student? Enter your details below to create your participant
                  profile.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="ext-full-name" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Full Name <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-full-name"
                        type="text"
                        value={extFullName}
                        onChange={(e) => setExtFullName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        className={authInputWithIconClass}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-create-email" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Email Address <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-create-email"
                        type="email"
                        value={extCreateEmail}
                        onChange={(e) => setExtCreateEmail(e.target.value)}
                        placeholder="e.g. priya@gmail.com"
                        className={authInputWithIconClass}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-roll-number" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Roll No. / Student ID <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-roll-number"
                        type="text"
                        value={extRollNumber}
                        onChange={(e) => setExtRollNumber(e.target.value)}
                        placeholder="e.g. 21CS101"
                        className={authInputWithIconClass}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-department" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Department <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <BookOpen className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-department"
                        type="text"
                        value={extDepartment}
                        onChange={(e) => setExtDepartment(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className={authInputWithIconClass}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-gender" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Gender <span className="text-[#f94d30]">*</span>
                    </label>
                    <select
                      id="ext-gender"
                      value={extGender}
                      onChange={(e) => setExtGender(e.target.value)}
                      className={`${authInputBaseClass} px-3.5 py-2.5`}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="NON_BINARY">Non-binary</option>
                      <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-year" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Year of Study <span className="text-[#f94d30]">*</span>
                    </label>
                    <select
                      id="ext-year"
                      value={extYearOfStudy}
                      onChange={(e) => setExtYearOfStudy(e.target.value)}
                      className={`${authInputBaseClass} px-3.5 py-2.5`}
                      required
                    >
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="PG">Postgraduate</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-institution" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      College / Institution <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-institution"
                        type="text"
                        value={extInstitution}
                        onChange={(e) => setExtInstitution(e.target.value)}
                        placeholder="College / University"
                        className={authInputWithIconClass}
                        autoComplete="organization"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ext-phone" className={EXTERNAL_FIELD_LABEL_CLASS}>
                      Phone Number <span className="text-[#f94d30]">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4b5060]/60 dark:text-[#a7acbb]/60" />
                      <input
                        id="ext-phone"
                        type="tel"
                        value={extPhone}
                        onChange={(e) => setExtPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className={authInputWithIconClass}
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className={EXTERNAL_CTA_BUTTON_CLASS}>
                  <span>Create Account &amp; Send Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center text-xs text-[#4b5060] dark:text-[#a7acbb]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchExternalTab('SIGN_IN')}
                    className="font-semibold text-[#f94d30] dark:text-[#ff6a5c] hover:underline cursor-pointer"
                  >
                    Sign In with Email
                  </button>
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default LoginPageClient;
