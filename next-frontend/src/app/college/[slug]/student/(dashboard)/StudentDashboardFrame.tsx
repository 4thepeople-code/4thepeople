'use client';

import Link from 'next/link';
import { ArrowRight, Building2, GraduationCap } from 'lucide-react';
import RoleGuard from '@/components/dashboard/RoleGuard';
import StudentShell from '@/components/dashboard/StudentShell';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { useMyClubsQuery } from '@/lib/api/manager';
import { student } from '@/lib/copy';

export interface StudentDashboardFrameProps {
  slug: string;
  children: React.ReactNode;
}

/**
 * Student frame: RoleGuard (session + coarse role check; College Admin is
 * bounced to the admin workspace) around the campus StudentShell. Students
 * with active club-manager memberships get a persistent "switch to the manager
 * workspace" banner above every student screen.
 */
export default function StudentDashboardFrame({ slug, children }: StudentDashboardFrameProps) {
  const { data: myClubs = [] } = useMyClubsQuery(slug);
  const isManager = myClubs.length > 0;

  return (
    <RoleGuard role="student" slug={slug}>
      <StudentShell slug={slug} collegeName={slug ? slug.toUpperCase() : undefined}>
        {isManager && (
          <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)]"
              >
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                  <GraduationCap aria-hidden="true" className="h-4 w-4" />
                  {student.managerBanner.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-soft)]">
                  {student.managerBanner.body(myClubs.length)}
                </p>
              </div>
            </div>
            <Link
              href={`/college/${slug}/manager`}
              className="shrink-0 self-start sm:self-center"
            >
              <DashboardButton variant="primary" size="sm" leftIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                {student.managerBanner.action}
              </DashboardButton>
            </Link>
          </div>
        )}
        {children}
      </StudentShell>
    </RoleGuard>
  );
}
