import Link from 'next/link';
import type { ReactNode } from 'react';

export interface CampusPageHeroProps {
  backHref: string;
  backLabel: string;
  /** Small uppercase kicker above the title, e.g. the club category. */
  eyebrow?: string;
  /** Uppercase Anton display title. */
  title: string;
  description?: string;
  /** Chip row (members, status, department tags). */
  children?: ReactNode;
  /**
   * Optional real cover image rendered as a framed panel beside the title
   * (demo clubs use a solid club-color band; the real data model has no
   * color, so the cover image stands in as the band's visual). Without one,
   * the band renders as the plain warm tile surface.
   */
  coverUrl?: string | null;
}

/**
 * Campus page hero band: back chip, eyebrow, Anton uppercase title,
 * description and chips on a solid tile surface, with an optional framed
 * cover panel on the right. Brutal bottom border, matching the demo event
 * page hero.
 */
export default function CampusPageHero({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  children,
  coverUrl,
}: CampusPageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
      <div aria-hidden className="absolute -right-16 top-0 h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15" />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-tile)]"
        >
          <span aria-hidden className="mr-1.5">
            ←
          </span>
          {backLabel}
        </Link>

        <div className={`mt-8 gap-10 md:gap-12 lg:gap-16 ${coverUrl ? 'flex flex-col md:flex-row md:items-center md:justify-between' : ''}`}>
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{eyebrow}</p>
            )}
            <h1 className="font-campus mt-3 text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">{description}</p>
            )}
            {children && <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>}
          </div>

          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              aria-hidden
              className="aspect-[16/10] w-full max-w-md shrink-0 rounded-2xl border-2 border-[var(--border-strong)] object-cover shadow-brutal-md md:w-80 md:max-w-none lg:w-96"
            />
          )}
        </div>
      </div>
    </section>
  );
}
