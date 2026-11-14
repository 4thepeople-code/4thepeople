'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { actions } from '@/lib/copy';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-strong)]',
  secondary:
    'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--primary)]',
  ghost: 'text-[var(--primary)] hover:bg-[var(--primary-soft)]',
  danger: 'bg-[var(--secondary)] text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 text-xs',
  md: '',
};

export interface DashboardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  loading?: boolean;
  loadingLabel?: string;
  leftIcon?: ReactNode;
  children: ReactNode;
}

/**
 * The one button for all role dashboards. Renders a Next.js Link when `href`
 * is given, otherwise a <button>. Buttons in copy start with a verb — see
 * src/lib/copy.ts.
 */
export default function DashboardButton({
  variant = 'primary',
  size = 'md',
  href,
  loading = false,
  loadingLabel,
  leftIcon,
  children,
  className = '',
  disabled,
  ...rest
}: DashboardButtonProps) {
  const classes = [base, variants[variant], sizes[size], className].join(' ');

  if (href) {
    return (
      <Link href={href} className={classes} aria-busy={loading || undefined}>
        {loading ? (loadingLabel ?? actions.save) : (leftIcon ?? null)}
        {!loading && children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none"
          />
          <span>{loadingLabel ?? actions.save}</span>
        </>
      ) : (
        <>
          {leftIcon ?? null}
          {children}
        </>
      )}
    </button>
  );
}
