import type { HTMLAttributes } from 'react';

export interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover border accent (for clickable/interactive cards). */
  interactive?: boolean;
}

/**
 * The one card for all role dashboards: paper surface, hairline border,
 * soft shadow — the landing page's card language.
 */
export default function DashboardCard({
  interactive = false,
  className = '',
  children,
  ...rest
}: DashboardCardProps) {
  const hover = interactive
    ? 'transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)]'
    : '';

  return (
    <div
      className={`rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm ${hover} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
