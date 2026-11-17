'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Share } from 'lucide-react';
import { campusPublic } from '@/lib/copy';
import type { Club } from '@/types/models';

export interface ClubHeroProps {
  club: Club;
  slug: string;
  backHref: string;
  backLabel: string;
  coverUrl: string | null;
  upcomingCount: number;
}

/**
 * Campus club page hero — split layout on desktop (identity beside a framed
 * 4:3 cover), cover banner on top on mobile with the identity below on a solid
 * surface. Renders only what the public club data already has; no placeholders.
 */
export default function ClubHero({ club, slug, backHref, backLabel, coverUrl, upcomingCount }: ClubHeroProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/college/${slug}/clubs/${club.id}`;
    const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: club.name, url });
        return;
      } catch {
        // User dismissed the share sheet — do nothing.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard unavailable — stay silent.
    }
  };

  const primaryHref = upcomingCount > 0 ? '#club-events' : `/college/${slug}/events`;
  const primaryLabel = upcomingCount > 0 ? campusPublic.clubDetail.seeUpcoming(upcomingCount) : campusPublic.events.emptyAction;

  const departments = Array.isArray(club.departments) ? club.departments : [];
  const memberCount = club.memberCount ?? club.membersCount ?? club._count?.members;

  return (
    <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
      {coverUrl ? (
        <>
          <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/70" />
        </>
      ) : null}
      <div aria-hidden className="absolute -right-16 top-0 h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15" />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] motion-reduce:transition-none"
        >
          <span aria-hidden className="mr-1.5">
            ←
          </span>
          {backLabel}
        </Link>

        {coverUrl && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] lg:hidden">
            <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/70" />
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:mt-0 lg:grid-cols-2 lg:items-center">
          <div>
            {club.category && (
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{club.category}</p>
            )}
            <h1 className="font-campus mt-3 text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">{club.name}</h1>
            {club.description && <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">{club.description}</p>}
            {typeof memberCount === 'number' && <p className="mt-4 text-sm font-bold text-[var(--text-secondary)]">{campusPublic.clubDetail.membersChip(memberCount)}</p>}
            {departments.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {departments.map((dept) => (
                  <span
                    key={dept.id || dept.shortCode || dept.code || dept.name}
                    className="inline-flex items-center rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs"
                  >
                    {dept.shortCode || dept.code || dept.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-[var(--on-primary)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-tile)]"
              >
                {primaryLabel}
              </Link>
              <button
                type="button"
                onClick={share}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-tile)]"
              >
                <Share className="h-4 w-4" aria-hidden />
                {copied ? campusPublic.clubDetail.shareCopied : campusPublic.clubDetail.share}
              </button>
            </div>
          </div>

          {coverUrl && (
            <div className="hidden aspect-[4/3] overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-tile)] lg:block">
              <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-[var(--surface-inverse)]/70" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
