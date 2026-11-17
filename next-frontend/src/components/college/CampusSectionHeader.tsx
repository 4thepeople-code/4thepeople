import type { ReactNode } from 'react';

export interface CampusSectionHeaderProps {
  /** Small uppercase kicker above the title, e.g. "The clubhouse". Optional — public pages keep the hero eyebrow only. */
  eyebrow?: string;
  title: string;
  /** Supporting sentence shown under the title. */
  description?: string;
  /** Right-aligned slot (count pill, action). */
  aside?: ReactNode;
}

/**
 * Section header used across the campus public pages: optional accent eyebrow,
 * Anton display title, optional description and right-side aside. Matches the
 * college homepage section pattern. Public pages pass no eyebrow — the hero owns it.
 */
export default function CampusSectionHeader({ eyebrow, title, description, aside }: CampusSectionHeaderProps) {
  return (
    <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{eyebrow}</p>
        )}
        <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
