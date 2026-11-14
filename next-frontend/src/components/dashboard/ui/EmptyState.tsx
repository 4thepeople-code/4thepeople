import type { ComponentType, ReactNode } from 'react';
import DashboardButton from './DashboardButton';
import { emptyStates } from '@/lib/copy';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  /** Label of the first action, e.g. "Create event". */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  children?: ReactNode;
}

/**
 * Empty state: what this is + why it's empty + the first action. Defaults come
 * from src/lib/copy.ts; screens pass their own title/action.
 */
export default function EmptyState({
  icon: Icon,
  title = emptyStates.generic.title,
  description = emptyStates.generic.description,
  actionLabel,
  actionHref,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center">
      {Icon && (
        <Icon aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-[var(--ink-soft)]" />
      )}
      <h2 className="font-display text-lg font-bold text-[var(--ink)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-6">
          <DashboardButton href={actionHref} onClick={onAction}>
            {actionLabel}
          </DashboardButton>
        </div>
      )}
      {children}
    </div>
  );
}
