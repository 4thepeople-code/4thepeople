'use client';

import React from 'react';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '@/lib/utils/cloudinary';
import type { Club } from '@/types/models';

export interface ClubCardProps {
  club: Club;
  onClick?: () => void;
}

export function ClubCard({ club, onClick }: ClubCardProps) {
  if (!club) return null;

  const rawLogoUrl = club.logoUrl || club.logo?.url;
  const logoUrl = getCloudinaryUrl(rawLogoUrl, CLOUDINARY_TRANSFORMS.LOGO);

  const rawCoverUrl = club.bannerUrl || club.coverUrl || club.coverImage?.url;
  const coverUrl = getCloudinaryUrl(rawCoverUrl, CLOUDINARY_TRANSFORMS.COVER);

  const initials = club.name ? club.name.slice(0, 2).toUpperCase() : 'CL';
  const memberCountText =
    club.memberCount !== undefined
      ? `${club.memberCount} Members`
      : club.membersCount !== undefined
      ? `${club.membersCount} Members`
      : club._count?.members !== undefined
      ? `${club._count.members} Members`
      : 'Active Club';

  const departments = Array.isArray(club.departments) ? club.departments : [];

  return (
    <div
      onClick={onClick}
      className="group relative w-full h-[400px] bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 rounded-[10px] figma-card-shadow transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer overflow-hidden select-none"
    >
      {/* Club Image Container */}
      <div className="absolute top-[20px] left-[20px] right-[19.67px] h-[240px] rounded-[5px] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={club.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-slate-900 flex flex-col items-center justify-center p-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={club.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-xl group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-black text-2xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                {initials}
              </div>
            )}
          </div>
        )}

        {/* Badge */}
        <div className="absolute top-[10px] left-[10px] px-[10px] py-[5px] bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-[5px] flex items-center justify-center gap-[10px] shadow-sm z-10 border border-slate-200/50 dark:border-white/10">
          <span className="text-[10px] leading-[12px] font-bold text-cyan-600 dark:text-[#00F0FF] tracking-wide text-center uppercase min-w-[22px]">
            {club.category || 'CLUB'}
          </span>
        </div>

        {/* Department Tags */}
        {departments.length > 0 && (
          <div className="absolute top-[10px] right-[10px] flex flex-wrap gap-1 justify-end max-w-[65%] z-10">
            {departments.map((dept) => (
              <span
                key={dept.id || dept.shortCode || dept.code || dept.name}
                className="px-[8px] py-[3px] bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-[4px] text-[10px] leading-[12px] font-semibold text-cyan-600 dark:text-cyan-300 shadow-xs uppercase tracking-wider truncate max-w-[100px] border border-slate-200/50 dark:border-white/10"
                title={dept.name}
              >
                {dept.shortCode || dept.code || dept.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Club Title */}
      <h3
        className="absolute top-[275px] left-[20px] right-[19.67px] h-[38px] text-[16px] leading-[19px] font-bold text-[#0F172A] dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-[#00F0FF] transition-colors"
        title={club.name}
      >
        {club.name || 'Campus Student Organization'}
      </h3>

      {/* Primary Subtext: Member Count */}
      <div className="absolute bottom-[56px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-semibold text-cyan-600 dark:text-[#00F0FF] truncate flex items-center gap-1.5">
        <span>{memberCountText} • Student Organization</span>
      </div>

      {/* Secondary Subtext: Location / Category */}
      <div className="absolute bottom-[20px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-normal text-slate-500 dark:text-slate-400 truncate flex items-center justify-between">
        <span className="truncate">
          {club.description
            ? club.description.replace(/\n/g, ' ').slice(0, 45)
            : 'CAMPUS CLUB - Connect & Attend Events'}
        </span>
      </div>
    </div>
  );
}

export default ClubCard;

