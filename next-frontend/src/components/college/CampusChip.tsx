import type { ReactNode } from 'react';

export type CampusChipVariant = 'outline' | 'inverse' | 'accent';

export interface CampusChipProps {
  variant?: CampusChipVariant;
  /** Renders a coral status dot before the label (live/ongoing cue). */
  dot?: boolean;
  children: ReactNode;
}

const variantClasses: Record<CampusChipVariant, string> = {
  outline:
    'border-2 border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-brutal-xs',
  inverse:
    'bg-[var(--surface-inverse)] text-[var(--text-inverse)]',
  accent:
    'bg-[var(--accent-strong)] text-[var(--on-primary)]',
};

/**
 * Campus pill chip (category eyebrow, status, member count). Non-interactive;
 * matches the college homepage / demo chips.
 */
export default function CampusChip({ variant = 'outline', dot = false, children }: CampusChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${variantClasses[variant]}`}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />}
      {children}
    </span>
  );
}
