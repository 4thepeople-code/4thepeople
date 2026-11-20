'use client';

import React from 'react';
import Link from 'next/link';
import type { Club } from '@/types/models';
import { getClubCoverImage } from '@/lib/utils/clubCovers';
import { getClubCategory } from '@/lib/utils/categories';

export interface CollegeClubCardProps {
  club: Club;
  href: string;
}

export function CollegeClubCard({ club, href }: CollegeClubCardProps) {
  if (!club) return null;

  const coverUrl = getClubCoverImage(club);
  const category = club.category || getClubCategory(club);
  const memberCount =
    (club as any)._count?.members ??
    (club as any).membersCount ??
    (club as any).memberCount ??
    (club.members ? club.members.length : undefined);

  const eventsCount =
    (club as any).events?.length ??
    (club as any)._count?.events ??
    (club as any).eventsCount;

  return (
    <Link href={href} className="group block h-full" aria-label={`View the ${club.name} club`}>
      <article className="flex h-full flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1">
        <div>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Cover for ${club.name}`}
              className="aspect-[4/3] w-full rounded-2xl border border-[var(--border-soft)] object-cover shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-tile)]">
              <span aria-hidden="true" className="font-display text-6xl font-bold text-[var(--text-muted)]">
                {club.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="mt-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                {club.name}
              </h3>
              {category && (
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                  {category}
                </p>
              )}
            </div>
            {typeof memberCount === 'number' && (
              <span className="shrink-0 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] px-3 py-1 text-xs font-bold text-[var(--text-primary)]">
                {memberCount} members
              </span>
            )}
          </div>

          {club.description && (
            <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
              {club.description}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-xs font-bold">
          {typeof eventsCount === 'number' && eventsCount > 0 ? (
            <span className="uppercase tracking-wider text-[var(--text-secondary)]">
              {eventsCount} upcoming {eventsCount === 1 ? 'event' : 'events'}
            </span>
          ) : (
            <span className="uppercase tracking-wider text-[var(--text-secondary)]">Active Organization</span>
          )}
          <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[var(--accent-strong)] transition-transform group-hover:translate-x-1">
            Explore &rarr;
          </span>
        </div>
      </article>
    </Link>
  );
}

export default CollegeClubCard;
