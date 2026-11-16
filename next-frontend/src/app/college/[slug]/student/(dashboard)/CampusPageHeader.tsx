export interface CampusPageHeaderProps {
  /** Uppercase Anton display title, e.g. "My registrations". */
  title: string;
  /** One-line supporting sentence under the title. */
  description?: string;
  /** Right-aligned action slot (buttons, links). */
  actions?: React.ReactNode;
}

/**
 * Campus page header for the student workspace: Anton display title with the
 * dashed rule used across the college public side. Student-only; the shared
 * dashboard PageHeader keeps serving manager/admin screens.
 */
export default function CampusPageHeader({ title, description, actions }: CampusPageHeaderProps) {
  return (
    <div className="mb-8 border-b-2 border-dashed border-[var(--border-soft)] pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-campus text-3xl uppercase leading-tight tracking-wide text-[var(--text-primary)] sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
