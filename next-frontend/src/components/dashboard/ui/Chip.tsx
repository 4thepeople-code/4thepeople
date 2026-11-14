import type { ReactNode } from 'react';

export type ChipVariant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent';

export interface ChipProps {
  variant?: ChipVariant;
  /** Renders a small status dot before the label. */
  dot?: boolean;
  children: ReactNode;
}

const variants: Record<ChipVariant, { chip: string; dot: string }> = {
  neutral: {
    chip: 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] dark:text-[var(--ink-soft)]',
    dot: 'bg-[var(--ink-soft)]',
  },
  brand: {
    chip: 'border-[var(--primary)]/25 bg-[var(--primary-soft)] text-[var(--primary)]',
    dot: 'bg-[var(--primary)]',
  },
  success: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  warning: {
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  danger: {
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-300',
    dot: 'bg-rose-600 dark:bg-rose-400',
  },
  accent: {
    chip: 'border-[var(--secondary)]/30 bg-[var(--secondary-soft)] text-[var(--secondary)]',
    dot: 'bg-[var(--secondary)]',
  },
};

/**
 * Status/count chip. Same status language everywhere: use `success` for live /
 * confirmed things, `warning` for pending, `danger` for suspended/cancelled.
 */
export default function Chip({ variant = 'neutral', dot = false, children }: ChipProps) {
  const styles = variants[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${styles.chip}`}
    >
      {dot && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />}
      {children}
    </span>
  );
}
