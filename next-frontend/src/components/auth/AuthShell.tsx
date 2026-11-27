'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import BrandLogo from '@/components/landing/BrandLogo';
import { LBRCE_LOGO_URL } from '@/components/public/PublicNavbar';

export const authInputBaseClass =
  'w-full rounded-xl border border-[#16181d]/12 dark:border-white/15 bg-[#faf7f2] dark:bg-[#0d0f14] text-sm font-medium text-[#16181d] dark:text-[#f2f3f7] placeholder:text-[#4b5060]/55 dark:placeholder:text-[#a7acbb]/45 transition-all focus:outline-none focus:bg-white dark:focus:bg-[#181c26] focus:border-[#4f46e8] dark:focus:border-[#8183ff] focus:ring-2 focus:ring-[#4f46e8]/15 dark:focus:ring-[#8183ff]/20 disabled:opacity-60 disabled:cursor-not-allowed';

export const authInputWithIconClass = `${authInputBaseClass} pl-10 pr-3.5 py-2.5`;

export const authPrimaryButtonClass =
  'w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#4f46e8] hover:bg-[#4338ca] active:bg-[#3730a3] dark:bg-[#6366f1] dark:hover:bg-[#4f46e8] text-white text-sm font-semibold shadow-sm shadow-[#4f46e8]/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e8] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export const authSecondaryButtonClass =
  'inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#16181d]/12 dark:border-white/15 bg-white dark:bg-[#14171f] hover:bg-[#faf7f2] dark:hover:bg-white/5 text-[#16181d] dark:text-[#f2f3f7] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e8]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export interface AuthShellProps {
  sectionIndex?: string;
  sectionLabel?: string;
  heroTitle?: React.ReactNode;
  heroDescription?: string;
  workspaceLabel?: string;
  badgeLabel: string;
  badgeIcon?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  collegeDisplay?: string;
  backHref?: string;
  backLabel?: string;
  maxWidth?: 'md' | 'lg';
  footer?: React.ReactNode;
  belowCard?: React.ReactNode;
  children: React.ReactNode;
}

const TESTIMONIALS = [
  {
    quote:
      'Discovering technical clubs and registering for campus fests took seconds. Everything I needed for college events is in one place.',
    name: 'Karthik Reddy',
    role: 'STUDENT',
    initials: 'KR',
  },
  {
    quote:
      'Verified event passes and instant digital certificates made showcasing my campus participation effortless during placements.',
    name: 'Sneha Patel',
    role: 'STUDENT',
    initials: 'SP',
  },
];

export function AuthShell({
  sectionIndex = '01',
  sectionLabel = 'STUDENT PORTAL',
  heroTitle,
  heroDescription = 'A focused campus hub for student clubs, verified event registrations, and instant digital certificates — built for your college community.',
  workspaceLabel,
  badgeLabel,
  title,
  subtitle,
  collegeDisplay,
  backHref,
  backLabel = 'Back to campus',
  maxWidth = 'md',
  footer,
  belowCard,
  children,
}: AuthShellProps) {
  const formWidthClass = maxWidth === 'lg' ? 'max-w-[440px]' : 'max-w-[390px]';

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 font-sans antialiased bg-[#faf7f2] dark:bg-[#0d0f14] text-[#16181d] dark:text-[#f2f3f7]">
      {/* LEFT PANEL: 4thepeople Reference Palette (Warm Cream + Subtle Grid + Soft Indigo/Peach Glow) */}
      <aside className="hidden lg:flex lg:col-span-7 relative flex-col justify-between bg-[#faf7f2] dark:bg-[#0d0f14] text-[#16181d] dark:text-[#f2f3f7] p-10 xl:p-14 overflow-hidden select-none">
        {/* Subtle grid & soft ambient gradients matching 4thepeople-ui.vercel.app */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid opacity-70 dark:opacity-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 h-[440px] w-[440px] rounded-full bg-[#4f46e8]/[0.11] dark:bg-[#6366f1]/[0.18] blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 right-8 h-[340px] w-[340px] rounded-full bg-[#ff4a3d]/[0.09] dark:bg-[#ff6a5c]/[0.10] blur-[100px]"
        />

        {/* Top Row: Section Index + Back Link */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#4f46e8] dark:text-[#8183ff]">
            <span className="font-mono">{sectionIndex}</span>
            <span className="w-8 h-px bg-[#4f46e8]/30 dark:bg-[#8183ff]/30" />
            <span>{sectionLabel}</span>
          </div>

          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b5060] dark:text-[#a7acbb] hover:text-[#4f46e8] dark:hover:text-[#8183ff] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </Link>
          )}
        </div>

        {/* Center Hero Copy */}
        <div className="relative z-10 my-auto py-10 max-w-xl space-y-5">
          <h2 className="font-display text-4xl xl:text-[46px] font-bold leading-[1.1] tracking-tight text-[#16181d] dark:text-[#f2f3f7]">
            {heroTitle || (
              <>
                Every club event on your campus.{' '}
                <span className="font-serif italic font-semibold text-[#4f46e8] dark:text-[#8183ff]">
                  One place.
                </span>
              </>
            )}
          </h2>

          <p className="text-sm xl:text-[15px] leading-relaxed text-[#4b5060] dark:text-[#a7acbb] max-w-lg">
            {heroDescription}
          </p>

          {(workspaceLabel || collegeDisplay) && (
            <p className="text-xs text-[#4b5060] dark:text-[#a7acbb] pt-1">
              Connected to{' '}
              <span className="text-[#4f46e8] dark:text-[#8183ff] font-semibold">
                {workspaceLabel || collegeDisplay?.toLowerCase()}
              </span>{' '}
              workspace
            </p>
          )}
        </div>

        {/* Bottom Testimonials */}
        <div className="relative z-10 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4b5060]/75 dark:text-[#a7acbb]/75">
            WHAT STUDENTS SAY
          </p>
          <div className="grid grid-cols-2 gap-4">
            {TESTIMONIALS.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-[#16181d]/10 dark:border-white/10 bg-white/90 dark:bg-[#14171f]/90 backdrop-blur-sm p-4 shadow-[0_10px_30px_-12px_rgba(22,24,29,0.08)] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <span className="text-[#4f46e8]/45 dark:text-[#8183ff]/45 font-serif text-lg leading-none block">
                    &ldquo;
                  </span>
                  <p className="text-xs leading-relaxed text-[#4b5060] dark:text-[#a7acbb]">
                    {item.quote}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="w-7 h-7 rounded-full bg-[#ececfd] dark:bg-[#6366f1]/20 border border-[#4f46e8]/20 dark:border-[#8183ff]/30 flex items-center justify-center text-[10px] font-bold text-[#4f46e8] dark:text-[#8183ff]">
                    {item.initials}
                  </div>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-[#16181d] dark:text-[#f2f3f7]">{item.name}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#4b5060]/75 dark:text-[#a7acbb]/75">
                      {item.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL: Clean White Sign-In Surface */}
      <main className="lg:col-span-5 flex flex-col justify-center px-6 py-10 sm:px-10 bg-white dark:bg-[#14171f] lg:border-l lg:border-[#16181d]/10 lg:dark:border-white/10">
        <div className={`w-full ${formWidthClass} mx-auto space-y-6`}>
          {/* Mobile Back Link */}
          {backHref && (
            <div className="lg:hidden">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b5060] dark:text-[#a7acbb] hover:text-[#4f46e8] dark:hover:text-[#8183ff] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel}</span>
              </Link>
            </div>
          )}

          {/* Brand & Heading: [4thepeople Logo] [LBRCE Logo] */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center gap-3">
              <BrandLogo size="md" variant="dark" />
              <span
                aria-hidden="true"
                className="h-6 w-px bg-[#16181d]/15 dark:bg-white/15 shrink-0"
              />
              <img
                src={LBRCE_LOGO_URL}
                alt="Lakireddy Bali Reddy College of Engineering (LBRCE) Logo"
                className="h-9 w-auto sm:h-10 object-contain shrink-0"
              />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4f46e8]/15 dark:border-[#8183ff]/25 bg-[#ececfd] dark:bg-[#6366f1]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4f46e8] dark:text-[#8183ff]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e8] dark:bg-[#8183ff]" />
                <span>{badgeLabel}</span>
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#16181d] dark:text-[#f2f3f7]">
                {title}
              </h1>
              <p className="text-xs sm:text-[13px] text-[#4b5060] dark:text-[#a7acbb] leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Form Content */}
          <div>{children}</div>

          {/* Portal Switcher / Footer */}
          {footer && <div className="pt-1">{footer}</div>}

          {belowCard && <div className="text-center">{belowCard}</div>}
        </div>
      </main>
    </div>
  );
}

export interface AuthAlertProps {
  variant: 'error' | 'success' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthAlert({ variant, title, children, className = '' }: AuthAlertProps) {
  const styles = {
    error:
      'border-red-200 dark:border-red-900/60 bg-red-50/90 dark:bg-red-950/35 text-red-700 dark:text-red-300',
    success:
      'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-950/35 text-emerald-800 dark:text-emerald-300',
    info:
      'border-[#4f46e8]/20 dark:border-[#8183ff]/30 bg-[#ececfd]/70 dark:bg-[#6366f1]/15 text-[#4338ca] dark:text-[#a5b4fc]',
  }[variant];

  const Icon = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Info,
  }[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed ${styles} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="font-medium">{children}</div>
      </div>
    </div>
  );
}

export interface AuthPasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  rightLabelAction?: React.ReactNode;
  className?: string;
}

export function AuthPasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••••••',
  autoComplete = 'current-password',
  required = true,
  disabled = false,
  rightLabelAction,
  className = '',
}: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5060] dark:text-[#a7acbb]"
        >
          {label}
        </label>
        {rightLabelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          className={`${authInputBaseClass} pl-3.5 pr-10 py-2.5`}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#4b5060] dark:text-[#a7acbb] hover:text-[#16181d] dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e8]"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
