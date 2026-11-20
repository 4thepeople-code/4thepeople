'use client';

import React, { useState } from 'react';
import { Users, Tag, Building2 } from 'lucide-react';
import type { Club } from '@/types/models';

export interface ClubHeaderProps {
  club: Club;
  children?: React.ReactNode;
  className?: string;
  isDark?: boolean;
}

export function ClubHeader({ club, children, className = '', isDark = false }: ClubHeaderProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  if (!club) return null;

  const rawCoverUrl = club.coverImageUrl || club.coverUrl || club.coverImage?.url;
  const rawLogoUrl = club.logoUrl || club.logo?.url;
  const category = club.category || club.clubType || 'Student Club';
  const memberCount = club.members?.length ?? club.memberCount ?? club.membersCount ?? 0;

  const initials = club.name
    ? club.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CL';

  const showCover = Boolean(rawCoverUrl && !coverFailed);
  const showLogo = Boolean(rawLogoUrl && !logoFailed);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-xs transition-colors ${className}`}
    >
      {/* Cover Banner */}
      <div className="relative w-full h-56 sm:h-64 md:h-72 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950">
        {showCover ? (
          <img
            src={rawCoverUrl!}
            alt={`${club.name} Cover`}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative select-none">
            <div className="text-center p-6 space-y-2 opacity-40">
              <Building2 className="w-16 h-16 text-[var(--primary)] mx-auto" />
              <p className="font-display text-xs uppercase font-bold tracking-widest text-white">
                {club.name || 'Campus Club'}
              </p>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Category & Members Badge */}
        <div className="absolute bottom-4 right-6 z-10 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
            <Tag className="w-3.5 h-3.5 text-white" />
            <span>{category}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm bg-[var(--surface)]/90 border border-[var(--line)] text-[var(--ink)]">
            <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </span>
        </div>

        {/* Square Overlapping Logo */}
        <div className="absolute -bottom-10 sm:-bottom-12 left-6 sm:left-8 z-20">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-4 border-[var(--surface)] bg-[var(--surface)] shadow-xl overflow-hidden shrink-0 relative">
            {showLogo ? (
              <img
                src={rawLogoUrl!}
                alt={`${club.name} Logo`}
                className="w-full h-full object-cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[var(--primary)] to-indigo-600 flex items-center justify-center text-white font-display font-black text-2xl sm:text-3xl uppercase">
                {initials}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header Info Below Cover */}
      <div className="px-6 sm:px-8 pb-6 pt-14 sm:pt-16 relative">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
              {club.name}
            </h1>
            <p className="text-xs sm:text-sm font-medium leading-relaxed text-[var(--ink-soft)]">
              {club.description || 'No description provided for this campus club.'}
            </p>
          </div>

          {children && <div className="shrink-0">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export default ClubHeader;

