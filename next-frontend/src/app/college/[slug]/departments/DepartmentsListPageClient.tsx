'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useDepartments } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface DepartmentsListPageClientProps {
  slug: string;
}

const fallbackDepartments = [
  { id: 'cse', name: 'Computer Science & Engineering', code: 'CSE', shortCode: 'CSE', description: 'Core computing, algorithms, artificial intelligence, cloud architectures and open-source hackathons.', clubCount: 4 },
  { id: 'it', name: 'Information Technology', code: 'IT', shortCode: 'IT', description: 'Web development, cybersecurity, network systems and competitive software engineering.', clubCount: 3 },
  { id: 'ece', name: 'Electronics & Communication', code: 'ECE', shortCode: 'ECE', description: 'Robotics, embedded IoT, VLSI design, signal processing, and hardware innovation.', clubCount: 3 },
  { id: 'eee', name: 'Electrical & Electronics', code: 'EEE', shortCode: 'EEE', description: 'Power systems, smart grid automation, renewable energy, and electric vehicle technology.', clubCount: 2 },
  { id: 'mech', name: 'Mechanical Engineering', code: 'MECH', shortCode: 'MECH', description: 'CAD modeling, automotive design, thermodynamics, and manufacturing automation.', clubCount: 2 },
  { id: 'civil', name: 'Civil Engineering', code: 'CIVIL', shortCode: 'CIVIL', description: 'Structural engineering, sustainable urban development, smart city infrastructures and surveying.', clubCount: 2 },
];

export function DepartmentsListPageClient({ slug }: DepartmentsListPageClientProps) {
  const { data: rawDepartments = [], isLoading, isError, error, refetch } = useDepartments(slug);
  const [searchQuery, setSearchQuery] = useState('');

  const displayDepartments = rawDepartments.length > 0 ? rawDepartments : fallbackDepartments;

  const filteredDepartments = useMemo(() => {
    return displayDepartments.filter((dept) => {
      const term = searchQuery.toLowerCase().trim();
      if (!term) return true;
      return (
        dept.name?.toLowerCase().includes(term) ||
        (dept as any).shortCode?.toLowerCase().includes(term) ||
        (dept as any).code?.toLowerCase().includes(term) ||
        dept.description?.toLowerCase().includes(term)
      );
    });
  }, [displayDepartments, searchQuery]);

  const collegeDisplay = slug.toUpperCase();

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-140px)]">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Academic divisions
            </p>
            <div className="mt-3 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <h1 className="font-campus text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                  Departments &amp; chapters
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">
                  Academic divisions across {collegeDisplay} anchor departmental clubs, technical teams and student societies.
                </p>
              </div>

              {/* Search Bar */}
              <div className="w-full lg:w-80">
                <label
                  htmlFor="departments-search"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Search departments
                </label>
                <input
                  id="departments-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search departments…"
                  className="min-h-11 w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] shadow-brutal-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Directory Content Area */}
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* Error State */}
          {isError && rawDepartments.length === 0 && (
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {error instanceof Error ? error.message : 'The department list could not be loaded. Check your connection and try again.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try again</span>
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && rawDepartments.length === 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading departments">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="h-64 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                />
              ))}
            </div>
          )}

          {/* No Search Matches */}
          {!isLoading && displayDepartments.length > 0 && filteredDepartments.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
              <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                No departments match
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                No departments match your search. Try a different keyword or short code.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tile)] shadow-brutal-xs"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Departments Grid */}
          {!isLoading && filteredDepartments.length > 0 && (
            <>
              <div className="flex justify-start lg:justify-end">
                <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                  {filteredDepartments.length} {filteredDepartments.length === 1 ? 'department' : 'departments'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDepartments.map((dept) => {
                  const code = (dept as any).shortCode || (dept as any).code || 'DEPT';
                  const clubCount =
                    (dept as any).clubCount ??
                    ((dept as any).clubs ? (dept as any).clubs.length : 3);

                  return (
                    <Link
                      key={dept.id}
                      href={`/college/${slug}/departments/${dept.id}`}
                      className="group flex h-full cursor-pointer flex-col justify-between rounded-3xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-brutal-md transition-transform duration-200 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-x-1 hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1"
                      aria-label={`View department: ${dept.name}`}
                    >
                      <div>
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <span className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-tile)] px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                            {code}
                          </span>
                          <span className="shrink-0 rounded-full border-2 border-[var(--border-strong)] px-3 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                            {clubCount} {clubCount === 1 ? 'club' : 'clubs'}
                          </span>
                        </div>

                        <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                          {dept.name}
                        </h3>

                        {dept.description && (
                          <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
                            {dept.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-[var(--border-soft)] pt-4">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                          View department
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-strong)] transition-transform group-hover:translate-x-1">
                          <span aria-hidden="true">&rarr;</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

export default DepartmentsListPageClient;
