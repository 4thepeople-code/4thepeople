import Link from 'next/link';
import type { Club } from '@/types/models';
import { resolveImageUrl } from './imageUrl';

export interface CampusClubCardProps {
  club: Club;
  href: string;
}

/**
 * Campus club card — the exact card the college homepage uses (brutal border,
 * offset shadow, cover image or initial tile, member pill). Shared by the
 * homepage, the clubs directory and department pages.
 */
export default function CampusClubCard({ club, href }: CampusClubCardProps) {
  const clubImage = resolveImageUrl(
    club.coverImageUrl,
    club.coverImage?.url,
    club.coverUrl,
    club.bannerUrl,
    club.logoUrl,
    club.logo?.url,
  );
  const memberCount = club._count?.members ?? club.membersCount ?? club.memberCount;

  return (
    <Link href={href} className="group block" aria-label={`View the ${club.name} club`}>
      <article className="flex h-full flex-col rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
        {clubImage ? (
          <img
            src={clubImage}
            alt={`Cover for ${club.name}`}
            className="aspect-[4/3] w-full rounded-2xl border border-[var(--border-soft)] object-cover"
          />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-tile)]">
            <span aria-hidden className="font-display text-6xl font-bold text-[var(--text-muted)]">
              {club.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="mt-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
              {club.name}
            </h3>
            {club.category && (
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">{club.category}</p>
            )}
          </div>
          {typeof memberCount === 'number' && (
            <span className="shrink-0 rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-xs font-bold text-[var(--text-primary)]">
              {memberCount} members
            </span>
          )}
        </div>

        {club.description && (
          <p className="mt-3 line-clamp-2 text-sm font-medium text-[var(--text-secondary)]">{club.description}</p>
        )}
      </article>
    </Link>
  );
}
