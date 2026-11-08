'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClubs } from '@/lib/api/clubs';
import PublicLayout from '@/components/public/PublicLayout';
import { useTheme } from '@/context/ThemeContext';
import { Search, Building2, AlertCircle, RefreshCw, ArrowUpRight, Sparkles, Users } from 'lucide-react';
import { getClubCoverImage } from '@/lib/utils/clubCovers';

export interface ClubsListPageClientProps {
  slug: string;
}

const categories = ['ALL', 'TECHNOLOGY', 'CULTURAL', 'SPORTS', 'ARTS', 'LITERARY', 'SOCIAL'];

export function ClubsListPageClient({ slug }: ClubsListPageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const { data: clubs = [], isLoading, isError, error, refetch } = useClubs(slug);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !term ||
        club.name?.toLowerCase().includes(term) ||
        club.description?.toLowerCase().includes(term) ||
        club.category?.toLowerCase().includes(term);

      const matchesCategory =
        selectedCategory === 'ALL' ||
        (club.category && club.category.toUpperCase().includes(selectedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [clubs, searchQuery, selectedCategory]);

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header & Search */}
        <div
          className={`flex flex-col md:flex-row md:items-end justify-between gap-8 border-b pb-8 ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Directory</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-4xl sm:text-6xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              FIND YOUR <span className="text-[#00F0FF]">COMMUNITY.</span>
            </h1>
            <p className={`text-base max-w-xl mt-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Join active campus clubs at {collegeDisplay}, connect with passionate peers, and participate in exciting projects & workshops.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search
              className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-gray-400' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs by name..."
              className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                isDark
                  ? 'bg-[#12141C] border-white/10 text-white placeholder-gray-500 shadow-inner'
                  : 'bg-white border-slate-200 text-[#0F172A] placeholder-slate-400 shadow-xs'
              }`}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-cyan-500/20'
                  : isDark
                  ? 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/25 hover:text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-2xs'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {isError && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : 'Failed to load clubs. Please check your connection.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold uppercase tracking-wider rounded-xl border border-red-500/40 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className={`h-80 rounded-3xl animate-pulse border ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredClubs.length === 0 && (
          <div
            className={`text-center py-16 rounded-3xl border space-y-3 ${
              isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
            }`}
          >
            <Building2 className="w-12 h-12 text-gray-400 mx-auto" />
            <h3 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              {searchQuery ? 'No Matching Clubs' : 'No Clubs Found'}
            </h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {searchQuery ? `No clubs match "${searchQuery}". Try a different keyword.` : 'No student clubs are currently registered.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 rounded-full bg-[#00F0FF] text-black text-xs font-bold uppercase cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Clubs Grid */}
        {!isLoading && !isError && filteredClubs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredClubs.map((club) => (
              <div
                key={club.id}
                onClick={() => router.push(`/college/${slug}/clubs/${club.id}`)}
                className={`group relative rounded-3xl overflow-hidden border transition-all duration-500 flex flex-col justify-between cursor-pointer ${
                  isDark
                    ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/10'
                    : 'bg-white border-slate-200 hover:border-cyan-500/50 shadow-sm hover:shadow-xl'
                }`}
              >
                <div className="relative h-32 w-full overflow-hidden bg-gray-900">
                  <img
                    src={getClubCoverImage(club)}
                    alt={club.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div
                    className={`absolute inset-0 ${
                      isDark
                        ? 'bg-gradient-to-t from-[#12141C] via-transparent to-transparent'
                        : 'bg-gradient-to-t from-black/50 via-transparent to-transparent'
                    }`}
                  />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 max-w-[85%]">
                    <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-extrabold uppercase tracking-widest text-[#00F0FF]">
                      {club.category || 'CAMPUS CLUB'}
                    </span>
                    {Array.isArray(club.departments) &&
                      club.departments.map((dept) => (
                        <span
                          key={dept.id || dept.shortCode || dept.code || dept.name}
                          className="px-2 py-0.5 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 text-[10px] font-bold uppercase tracking-wider text-cyan-200"
                          title={dept.name}
                        >
                          {dept.shortCode || dept.code || dept.name}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3
                      className={`font-['Syne',sans-serif] text-2xl font-extrabold tracking-tight uppercase group-hover:text-[#00F0FF] transition-colors mb-3 ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      {club.name}
                    </h3>
                    <p
                      className={`text-xs leading-relaxed line-clamp-3 mb-6 ${
                        isDark ? 'text-gray-300' : 'text-slate-600'
                      }`}
                    >
                      {club.description || 'Student organization promoting learning, technical skills, and collaboration.'}
                    </p>
                  </div>

                  <div
                    className={`pt-4 border-t flex items-center justify-between ${
                      isDark ? 'border-white/5' : 'border-slate-100'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold flex items-center gap-1.5 ${
                        isDark ? 'text-gray-400' : 'text-slate-500'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{club._count?.members || club.membersCount || club.memberCount || 100}+ Members</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#00F0FF] group-hover:translate-x-1 transition-transform">
                      <span>Explore</span>
                      <ArrowUpRight className="w-4 h-4 text-[#00F0FF]" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default ClubsListPageClient;

