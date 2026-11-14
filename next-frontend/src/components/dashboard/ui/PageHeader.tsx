import type { ReactNode } from 'react';
import Chip from './Chip';
import { roleNames, type RoleName } from '@/lib/copy';

export interface PageHeaderProps {
  role?: RoleName;
  title: string;
  description?: string;
  /** Action buttons / primary CTA for this page. */
  actions?: ReactNode;
}

/**
 * Content-grid page header: role eyebrow, display-font title, lead line, and
 * the page's actions. The role's most frequent action should appear here.
 */
export default function PageHeader({ role, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {role && (
          <div className="mb-2">
            <Chip variant="brand">{roleNames[role]}</Chip>
          </div>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-soft)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
