'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDepartment } from '@/lib/api/departments';
import PublicLayout from '@/components/public/PublicLayout';
import CollegeClubCard from '@/components/college/CollegeClubCard';
import { Building2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Club } from '@/types/models';

export interface DepartmentDetailPageClientProps {
  slug: string;
  departmentId: string;
}

const fallbackDepartments = [
  { id: 'cse', name: 'Computer Science & Engineering', code: 'CSE', shortCode: 'CSE', description: 'Core computing, algorithms, artificial intelligence, cloud architectures and open-source hackathons.', clubs: [] },
  { id: 'it', name: 'Information Technology', code: 'IT', shortCode: 'IT', description: 'Web development, cybersecurity, network systems and competitive software engineering.', clubs: [] },
  { id: 'ece', name: 'Electronics & Communication', code: 'ECE', shortCode: 'ECE', description: 'Robotics, embedded IoT, VLSI design, signal processing, and hardware innovation.', clubs: [] },
  { id: 'eee', name: 'Electrical & Electronics', code: 'EEE', shortCode: 'EEE', description: 'Power systems, smart grid automation, renewable energy, and electric vehicle technology.', clubs: [] },
  { id: 'mech', name: 'Mechanical Engineering', code: 'MECH', shortCode: 'MECH', description: 'CAD modeling, automotive design, thermodynamics, and manufacturing automation.', clubs: [] },
  { id: 'civil', name: 'Civil Engineering', code: 'CIVIL', shortCode: 'CIVIL', description: 'Structural engineering, sustainable urban development, smart city infrastructures and surveying.', clubs: [] },
];

export function DepartmentDetailPageClient({ slug, departmentId }: DepartmentDetailPageClientProps) {
  const router = useRouter();
  const { data: rawDepartment, isLoading, isError, error, refetch } = useDepartment(slug, departmentId);

  const fallback = fallbackDepartments.find((d) => d.id === departmentId.toLowerCase());
  const department = rawDepartment || fallback;
  const isNotFound = !isLoading && !department;

  const collegeDisplay = slug.toUpperCase();
  const clubs = Array.isArray(department?.clubs) ? (department.clubs as Club[]) : [];

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="college-scope bg-[var(--surface-page)] text-[var(--text-primary)] min-h-[calc(100vh-140px)]">
        {/* Loading Skeletons */}
        {isLoading && (
          <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8" role="status" aria-label="Loading department">
            <div className="h-56 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-72 animate-pulse rounded-3xl border-2 border-[var(--border-soft)] bg-[var(--surface-tile)] motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && (isNotFound || isError && !department) && (
          <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
            <div className="space-y-4 rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
              <Building2 className="mx-auto h-12 w-12 text-[var(--accent-strong)]" />
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
                Department Not Found
              </h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                The academic department you requested could not be found or has not been listed yet for {collegeDisplay}.
              </p>
              <div className="pt-2">
                <Link
                  href={`/college/${slug}/departments`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                >
                  <span aria-hidden="true" className="mr-1.5">&larr;</span>
                  All departments
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Department Profile Content */}
        {!isLoading && department && (
          <>
            {/* Hero Banner */}
            <section className="relative overflow-hidden border-b-2 border-[var(--border-strong)] bg-[var(--surface-tile)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 top-0 hidden h-72 w-72 rounded-full border-[14px] border-[var(--border-strong)]/15 md:block"
              />
              <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
                <Link
                  href={`/college/${slug}/departments`}
                  className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <span aria-hidden="true" className="mr-1.5">&larr;</span>
                  All departments
                </Link>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                    {(department as any).shortCode || (department as any).code || 'DEPT'}
                  </span>
                  <span className="rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-brutal-xs">
                    {clubs.length} affiliated {clubs.length === 1 ? 'club' : 'clubs'}
                  </span>
                </div>

                <h1 className="font-campus mt-4 text-5xl uppercase leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
                  {department.name}
                </h1>

                <p className="mt-4 max-w-2xl text-lg leading-snug text-[var(--text-secondary)]">
                  {department.description ||
                    'Student organizations, technical chapters and project teams operating under this academic department.'}
                </p>
              </div>
            </section>

            {/* Main Associated Clubs Area */}
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20 space-y-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Departmental clubs
                </p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)] sm:text-4xl">
                  Associated student organizations
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xl">
                  Student communities and technical project teams operating under {department.name} at {collegeDisplay}.
                </p>
              </div>

              {clubs.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-card)] p-10 text-center">
                  <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    No clubs affiliated yet
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                    Student organizations affiliated with this department will appear here once linked by faculty advisors or student heads.
                  </p>
                  <Link
                    href={`/college/${slug}/clubs`}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 shadow-brutal-xs"
                  >
                    Browse all campus clubs
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {clubs.map((c) => (
                    <CollegeClubCard key={c.id} club={c} href={`/college/${slug}/clubs/${c.id}`} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}

export default DepartmentDetailPageClient;
