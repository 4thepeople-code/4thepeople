'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDepartments } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import { useTheme } from '@/context/ThemeContext';
import {
  Search,
  Building2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  Users,
} from 'lucide-react';

export interface DepartmentsListPageClientProps {
  slug: string;
}

export function DepartmentsListPageClient({ slug }: DepartmentsListPageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const { data: rawDepartments = [], isLoading, isError, error, refetch } = useDepartments(slug);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDepartments = useMemo(() => {
    return rawDepartments.filter((dept) => {
      const term = searchQuery.toLowerCase().trim();
      if (!term) return true;
      return (
        dept.name?.toLowerCase().includes(term) ||
        dept.shortCode?.toLowerCase().includes(term) ||
        dept.code?.toLowerCase().includes(term) ||
        dept.description?.toLowerCase().includes(term)
      );
    });
  }, [rawDepartments, searchQuery]);

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
              <span>Campus Academic Divisions</span>
            </div>
            <h1
              className={`font-['Syne',sans-serif] text-4xl sm:text-6xl font-extrabold uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              EXPLORE <span className="text-[#00F0FF]">DEPARTMENTS.</span>
            </h1>
            <p className={`text-base max-w-xl mt-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Discover campus departments at {collegeDisplay} and explore their student clubs, technical teams, and creative societies.
            </p>
          </div>

          {/* Search Input */}
          {!isLoading && !isError && rawDepartments.length > 0 && (
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
                placeholder="Search departments..."
                className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                  isDark
                    ? 'bg-[#12141C] border-white/10 text-white placeholder-gray-500 shadow-inner'
                    : 'bg-white border-slate-200 text-[#0F172A] placeholder-slate-400 shadow-xs'
                }`}
              />
            </div>
          )}
        </div>

        {/* Error Alert */}
        {isError && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : 'Failed to load academic departments.'}
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
                className={`h-64 rounded-3xl animate-pulse border p-6 flex flex-col justify-between ${
                  isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className={`h-6 w-16 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                    <div className={`h-6 w-20 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  </div>
                  <div className={`h-7 w-3/4 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <div className={`h-12 w-full rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                </div>
                <div className={`h-4 w-1/3 rounded ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              </div>
            ))}
          </div>
        )}

        {/* Empty State when no departments exist */}
        {!isLoading && !isError && rawDepartments.length === 0 && (
          <div
            className={`text-center py-20 rounded-3xl border space-y-4 ${
              isDark
                ? 'bg-[#12141C] border-white/10 text-gray-400'
                : 'bg-white border-slate-200 text-slate-500 shadow-sm'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-[#00F0FF] flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-8 h-8" />
            </div>
            <h3
              className={`font-['Syne',sans-serif] text-2xl font-bold uppercase tracking-wide ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              No departments yet
            </h3>
            <p className={`text-sm max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Academic departments have not been added yet for {collegeDisplay}. Please check back later.
            </p>
          </div>
        )}

        {/* Empty Search Filter State */}
        {!isLoading && !isError && rawDepartments.length > 0 && filteredDepartments.length === 0 && (
          <div
            className={`text-center py-16 rounded-3xl border space-y-3 ${
              isDark
                ? 'bg-[#12141C] border-white/10 text-gray-400'
                : 'bg-white border-slate-200 text-slate-500 shadow-sm'
            }`}
          >
            <Search className="w-12 h-12 text-gray-400 mx-auto" />
            <h3
              className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              No Matching Departments
            </h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              No departments match &quot;{searchQuery}&quot;. Try a different keyword or short code.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 px-4 py-2 rounded-full bg-[#00F0FF] text-black text-xs font-bold uppercase cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Departments Grid */}
        {!isLoading && !isError && filteredDepartments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDepartments.map((dept) => {
              const clubCount = dept.clubCount ?? (dept.clubs ? dept.clubs.length : 0);
              return (
                <div
                  key={dept.id}
                  onClick={() => router.push(`/college/${slug}/departments/${dept.id}`)}
                  className={`group relative rounded-3xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                    isDark
                      ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/10'
                      : 'bg-white border-slate-200 hover:border-cyan-500/50 shadow-sm hover:shadow-xl'
                  }`}
                >
                  <div>
                    {/* Top Row: Short Code Badge & Club Count */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                        {dept.shortCode || dept.code || 'DEPT'}
                      </span>
                      <span
                        className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                          isDark
                            ? 'bg-white/5 border-white/10 text-gray-300'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-500" />
                        <span>
                          {clubCount} {clubCount === 1 ? 'Club' : 'Clubs'}
                        </span>
                      </span>
                    </div>

                    {/* Department Name */}
                    <h3
                      className={`font-['Syne',sans-serif] text-2xl font-extrabold tracking-tight uppercase group-hover:text-[#00F0FF] transition-colors mb-3 line-clamp-2 ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      {dept.name}
                    </h3>

                    {/* Description */}
                    <p
                      className={`text-xs leading-relaxed line-clamp-3 mb-6 ${
                        isDark ? 'text-gray-400' : 'text-slate-600'
                      }`}
                    >
                      {dept.description ||
                        'Academic department offering student programs, hands-on learning, and community initiatives.'}
                    </p>
                  </div>

                  {/* Bottom Row */}
                  <div
                    className={`pt-4 border-t flex items-center justify-between ${
                      isDark ? 'border-white/5' : 'border-slate-100'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      View Department
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#00F0FF] group-hover:translate-x-1 transition-transform">
                      <span>Explore</span>
                      <ArrowUpRight className="w-4 h-4 text-[#00F0FF]" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default DepartmentsListPageClient;

