'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDepartment } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import ClubCard from '@/components/common/ClubCard';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft,
  Building2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Users,
  Compass,
} from 'lucide-react';

export interface DepartmentDetailPageClientProps {
  slug: string;
  departmentId: string;
}

export function DepartmentDetailPageClient({ slug, departmentId }: DepartmentDetailPageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const { data: department, isLoading, isError, error, refetch } = useDepartment(slug, departmentId);

  const collegeDisplay = slug.toUpperCase();

  const isNotFound =
    !isLoading &&
    (isError && (error instanceof Error && error.message.includes('404')) || !department);

  const clubs = Array.isArray(department?.clubs) ? department.clubs : [];

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Back Link */}
        <div>
          <Link
            href={`/college/${slug}/departments`}
            className={`inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
              isDark ? 'text-gray-400 hover:text-[#00F0FF]' : 'text-slate-500 hover:text-cyan-600'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Departments</span>
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-8 animate-pulse">
            <div
              className={`p-8 rounded-3xl border ${
                isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className={`h-6 w-24 rounded-full mb-4 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <div className={`h-10 w-2/3 rounded-xl mb-4 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <div className={`h-16 w-full rounded-xl ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-96 rounded-2xl border ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Not Found State */}
        {!isLoading && (isNotFound || !department) && (
          <div
            className={`text-center py-20 px-4 rounded-3xl border space-y-4 max-w-2xl mx-auto ${
              isDark ? 'bg-[#12141C] border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-8 h-8" />
            </div>
            <h2
              className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-wide ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Department Not Found
            </h2>
            <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              The academic department you requested does not exist or may have been removed.
            </p>
            <div className="pt-2">
              <Link
                href={`/college/${slug}/departments`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:bg-[#38f2ff] transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span>Return to Departments</span>
              </Link>
            </div>
          </div>
        )}

        {/* Other Error State */}
        {!isLoading && isError && !isNotFound && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : 'Failed to load department details. Please try again.'}
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

        {/* Department Content */}
        {!isLoading && !isError && department && (
          <div className="space-y-12">
            {/* Header Banner */}
            <header
              className={`relative overflow-hidden rounded-3xl p-8 sm:p-12 border transition-colors ${
                isDark
                  ? 'bg-gradient-to-br from-[#12141C] via-[#0F1117] to-[#161922] border-white/10 shadow-2xl'
                  : 'bg-white border-slate-200 shadow-md'
              }`}
            >
              <div className="relative z-10 max-w-4xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00F0FF] text-xs font-black tracking-widest uppercase">
                    <Sparkles className="w-3 h-3" />
                    <span>{department.shortCode || department.code || 'DEPT'}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                      isDark ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-500" />
                    <span>
                      {clubs.length} {clubs.length === 1 ? 'Affiliated Club' : 'Affiliated Clubs'}
                    </span>
                  </span>
                </div>

                <h1
                  className={`font-['Syne',sans-serif] text-3xl sm:text-5xl font-black uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  {department.name}
                </h1>

                <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  {department.description ||
                    'Student organizations, technical chapters, and project teams operating under this academic department.'}
                </p>
              </div>

              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            </header>

            {/* Department Clubs Section */}
            <section className="space-y-6">
              <div
                className={`flex items-center justify-between border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <div>
                  <h2
                    className={`font-['Syne',sans-serif] text-2xl font-bold uppercase tracking-tight ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Affiliated Clubs
                  </h2>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Clubs and student societies associated with {department.name} at {collegeDisplay}
                  </p>
                </div>
              </div>

              {clubs.length === 0 ? (
                <div
                  className={`text-center py-20 rounded-3xl border space-y-4 ${
                    isDark
                      ? 'bg-[#12141C] border-white/10 text-gray-400'
                      : 'bg-white border-slate-200 text-slate-500 shadow-sm'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-[#00F0FF] flex items-center justify-center mx-auto mb-2">
                    <Compass className="w-8 h-8" />
                  </div>
                  <h3
                    className={`font-['Syne',sans-serif] text-2xl font-bold uppercase tracking-wide ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    No clubs in this department yet
                  </h3>
                  <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    There are currently no active clubs linked to this department. Check back later or explore other departments.
                  </p>
                  <div className="pt-2">
                    <Link
                      href={`/college/${slug}/departments`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:bg-[#38f2ff] transition-all"
                    >
                      <ArrowLeft className="w-4 h-4 text-black" />
                      <span>Browse Other Departments</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {clubs.map((club) => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      onClick={() => router.push(`/college/${slug}/clubs/${club.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default DepartmentDetailPageClient;

