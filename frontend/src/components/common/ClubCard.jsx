import React from 'react';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '../../utils/cloudinary';
import { Building2, Users, ArrowRight } from 'lucide-react';

export const ClubCard = ({ club, onClick }) => {
  if (!club) return null;

  const rawLogoUrl = club.logoUrl || club.logo?.url;
  const logoUrl = getCloudinaryUrl(rawLogoUrl, CLOUDINARY_TRANSFORMS.LOGO);

  const rawCoverUrl = club.bannerUrl || club.coverUrl || club.coverImage?.url;
  const coverUrl = getCloudinaryUrl(rawCoverUrl, CLOUDINARY_TRANSFORMS.COVER);

  const initials = club.name ? club.name.slice(0, 2).toUpperCase() : 'CL';
  const memberCountText = club.memberCount !== undefined ? `${club.memberCount} Members` : 'Active Club';

  const departments = Array.isArray(club.departments) ? club.departments : [];

  return (
    <div
      onClick={onClick}
      className="group relative w-full h-[400px] bg-[#FFFFFF] rounded-[10px] figma-card-shadow transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer overflow-hidden select-none"
      style={{
        fontFamily: "'Product Sans', 'Plus Jakarta Sans', sans-serif"
      }}
    >
      {/* Club Image Container (height: 240px, top: 20px, left: 20px, right: 19.67px, border-radius: 5px) */}
      <div className="absolute top-[20px] left-[20px] right-[19.67px] h-[240px] rounded-[5px] overflow-hidden bg-slate-100">
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

        {/* Badge (Frame 1: top: 30px, left: 30px -> relative to image: top: 10px, left: 10px) */}
        <div className="absolute top-[10px] left-[10px] px-[10px] py-[5px] bg-[#FFFFFF] rounded-[5px] flex items-center justify-center gap-[10px] shadow-sm z-10">
          <span className="text-[10px] leading-[12px] font-normal text-[#7848F4] tracking-wide text-center uppercase min-w-[22px]">
            CLUB
          </span>
        </div>

        {/* Department Tags (Only shown when club has departments, leaving layout unchanged when none) */}
        {departments.length > 0 && (
          <div className="absolute top-[10px] right-[10px] flex flex-wrap gap-1 justify-end max-w-[65%] z-10">
            {departments.map((dept) => (
              <span
                key={dept.id || dept.shortCode || dept.name}
                className="px-[8px] py-[3px] bg-[#FFFFFF]/95 backdrop-blur-xs rounded-[4px] text-[10px] leading-[12px] font-semibold text-[#7848F4] shadow-xs uppercase tracking-wider truncate max-w-[100px]"
                title={dept.name}
              >
                {dept.shortCode || dept.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Club Title (top: 275px, left: 20px, right: 19.67px, height: 38px, font-size: 16px, line-height: 19px) */}
      <h3
        className="absolute top-[275px] left-[20px] right-[19.67px] h-[38px] text-[16px] leading-[19px] font-normal text-[#000000] line-clamp-2 group-hover:text-[#7848F4] transition-colors"
        title={club.name}
      >
        {club.name || 'Campus Student Organization'}
      </h3>

      {/* Primary Subtext: Member Count (bottom: 56px, left: 20px, right: 19.67px, height: 15px, font-size: 12px, line-height: 15px, color: #7848F4) */}
      <div className="absolute bottom-[56px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-normal text-[#7848F4] truncate flex items-center gap-1.5">
        <span>{memberCountText} • Student Organization</span>
      </div>

      {/* Secondary Subtext: Location / Category (bottom: 20px, left: 20px, right: 19.67px, height: 15px, font-size: 12px, line-height: 15px, color: #7E7E7E) */}
      <div className="absolute bottom-[20px] left-[20px] right-[19.67px] h-[15px] text-[12px] leading-[15px] font-normal text-[#7E7E7E] truncate flex items-center justify-between">
        <span className="truncate">
          {club.description ? club.description.replace(/\n/g, ' ').slice(0, 45) : 'CAMPUS CLUB - Connect & Attend Events'}
        </span>
      </div>
    </div>
  );
};

export default ClubCard;
