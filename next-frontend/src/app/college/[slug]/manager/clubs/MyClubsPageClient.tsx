'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { useMyClubsQuery } from '@/lib/api/manager';
import ManagerLayout from '@/components/manager/ManagerLayout';
import {
  Building2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronRight,
} from 'lucide-react';

export interface MyClubsPageClientProps {
  slug: string;
}

export function MyClubsPageClient({ slug }: MyClubsPageClientProps) {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  const {
    data: clubs = [],
    isLoading: loading,
    isError,
    error: errObj,
    refetch,
  } = useMyClubsQuery(slug);

  const filteredClubs = clubs.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Header Banner */}
        <div
          className={`rounded-3xl p-6 sm:p-8 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] text-[10px] font-black uppercase tracking-wider border border-[#00F0FF]/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Club Portfolio</span>
            </div>

            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-black uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              My Managed <span className="text-[#00F0FF]">Clubs</span>
            </h1>

            <p className={`text-xs font-medium max-w-xl ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Select a club to edit details, upload logos & cover photos, manage campus events, and organize photo galleries.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-full border text-xs font-medium focus:outline-hidden focus:border-[#00F0FF] transition-all ${
                isDark
                  ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Error Alert */}
        {isError && (
          <div className="p-4 rounded-2xl border flex items-center justify-between text-xs font-bold bg-rose-500/10 border-rose-500/30 text-rose-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>
                {(errObj as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                  'Failed to load your assigned clubs.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-black uppercase rounded-xl transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-48 rounded-3xl animate-pulse border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !isError && clubs.length === 0 && (
          <div
            className={`text-center py-16 rounded-3xl border space-y-3 ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <Building2 className="w-12 h-12 text-gray-500 mx-auto" />
            <h3 className="font-['Syne',sans-serif] text-lg font-bold uppercase">No Managed Clubs Assigned</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              You haven&apos;t been assigned to manage any clubs yet — please contact your college administrator.
            </p>
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && !isError && clubs.length > 0 && filteredClubs.length === 0 && (
          <div
            className={`text-center py-12 rounded-3xl border space-y-2 ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <Search className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs font-semibold text-gray-400">No managed clubs match your search filter.</p>
          </div>
        )}

        {/* Clubs Grid */}
        {!loading && !isError && filteredClubs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club) => {
              const logoUrl = club.logoUrl || club.logo?.url;
              const initials = club.name ? club.name.slice(0, 2).toUpperCase() : 'CL';
              const clubHref = getPath(`/manager/clubs/${club.id}`);

              return (
                <Link
                  key={club.id}
                  href={clubHref}
                  className={`group border rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                    isDark
                      ? 'bg-[#12141C] hover:bg-[#161922] border-white/10 hover:border-cyan-500/50'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-cyan-400'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={club.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-xs group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-blue-600 flex items-center justify-center text-black font-['Syne',sans-serif] font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                          {initials}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-['Syne',sans-serif] text-xl font-black group-hover:text-[#00F0FF] transition truncate ${
                            isDark ? 'text-white' : 'text-[#0F172A]'
                          }`}
                        >
                          {club.name}
                        </h3>
                        <span className="text-[10px] text-[#00F0FF] font-black uppercase tracking-wider bg-[#00F0FF]/10 px-2.5 py-0.5 rounded-full inline-block mt-0.5 border border-[#00F0FF]/25">
                          Manager Access
                        </span>
                      </div>
                    </div>

                    <p className={`text-xs line-clamp-3 leading-relaxed font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      {club.description || 'No description provided for this campus club.'}
                    </p>
                  </div>

                  <div className={`pt-4 mt-6 border-t flex items-center justify-between text-xs ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {club.members ? `${club.members.length} Members` : 'Manage Details'}
                    </span>
                    <div className="flex items-center gap-1 font-extrabold text-[#00F0FF] group-hover:translate-x-1 transition-transform uppercase text-[11px] tracking-wider">
                      <span>Manage Club</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

export default MyClubsPageClient;

