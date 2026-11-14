'use client';

import Link from 'next/link';
import { CalendarPlus, Club, Inbox, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import DashboardShell from './DashboardShell';
import RoleGuard from './RoleGuard';
import DashboardButton from './ui/DashboardButton';
import DashboardCard from './ui/DashboardCard';
import Chip from './ui/Chip';
import Field, { Input, Select, Textarea } from './ui/Field';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Skeleton, { SkeletonCard, SkeletonLines } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import type { DashboardRole } from './navConfig';
import { actions, roleNames } from '@/lib/copy';

const ROLE_BY_PARAM: Record<string, DashboardRole> = {
  admin: 'collegeAdmin',
  manager: 'eventManager',
  student: 'student',
  platform: 'superAdmin',
};

/**
 * TEMPORARY — Phase 1 manual test surface (removed in Phase 5 cleanup).
 * `guarded` mode demonstrates RoleGuard + DashboardShell with sample content.
 */
export default function DashboardPreview({
  roleParam,
  guarded,
}: {
  roleParam?: string;
  guarded: boolean;
}) {
  if (guarded) {
    const role = ROLE_BY_PARAM[roleParam ?? 'admin'] ?? 'collegeAdmin';
    return (
      <RoleGuard role={role} slug="lbrce">
        <DashboardShell role={role} slug="lbrce" collegeName="LBRCE">
          <SampleDashboard role={role} />
        </DashboardShell>
      </RoleGuard>
    );
  }
  return <KitShowcase />;
}

function SampleDashboard({ role }: { role: DashboardRole }): ReactNode {
  const { toast } = useToast();
  return (
    <div>
      <PageHeader
        role={role}
        title="Sample page header"
        description="Phase 1 placeholder content. Every real screen replaces this in later phases."
        actions={
          <DashboardButton href="/dashboard-preview" variant="secondary" size="sm">
            {actions.backToDashboard}
          </DashboardButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard>
          <Chip variant="success" dot>
            Live
          </Chip>
          <p className="mt-3 font-display text-xl font-bold">Card with a status chip</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Paper surface, hairline border, soft shadow.
          </p>
          <div className="mt-4">
            <DashboardButton
              size="sm"
              onClick={() =>
                toast('This is a success toast — feedback near the trigger.', {
                  variant: 'success',
                })
              }
            >
              Show success toast
            </DashboardButton>
          </div>
        </DashboardCard>
        <DashboardCard>
          <Chip variant="warning" dot>
            Pending
          </Chip>
          <p className="mt-3 font-display text-xl font-bold">Empty state preview</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Below is the shared EmptyState.</p>
        </DashboardCard>
        <DashboardCard>
          <Chip variant="accent" dot>
            Accent
          </Chip>
          <p className="mt-3 font-display text-xl font-bold">Form controls preview</p>
          <div className="mt-4 space-y-4">
            <Field label="Event title" htmlFor="preview-title" hint="Students see this first.">
              <Input id="preview-title" placeholder="e.g. RoboRush: Build-a-Bot Finals" />
            </Field>
            <Field label="Department" htmlFor="preview-dept" hint="Pick from known values — no free text.">
              <Select id="preview-dept" defaultValue="">
                <option value="" disabled>
                  Select a department
                </option>
                <option value="cse">CSE</option>
                <option value="ece">ECE</option>
              </Select>
            </Field>
            <Field label="Description" htmlFor="preview-desc">
              <Textarea id="preview-desc" placeholder="What should students expect?" />
            </Field>
          </div>
        </DashboardCard>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <EmptyState
          icon={CalendarPlus}
          title="No events yet"
          description="Create your first event so students can start registering."
          actionLabel={actions.createEvent}
          actionHref="/dashboard-preview"
        />
        <div className="space-y-4">
          <SkeletonCard label="Loading sample card" />
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <Skeleton shape="line" className="w-1/2" label="Loading summary" />
            <SkeletonLines count={2} className="mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KitShowcase() {
  const { toast } = useToast();
  return (
    <div className="dashboard-scope min-h-screen bg-[var(--bg)] p-6 text-[var(--ink)] sm:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <Chip variant="brand">Phase 1 preview</Chip>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Shared dashboard kit
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">
            Temporary page for manual testing — removed in Phase 5. Toggle dark mode with the site
            theme control (it lives in the shell), resize below 768px to see the drawer, and use the
            guarded links to test RoleGuard.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard-preview?role=admin&guarded=1"
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            College Admin shell →
          </Link>
          <Link
            href="/dashboard-preview?role=manager&guarded=1"
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            Event Manager shell →
          </Link>
          <Link
            href="/dashboard-preview?role=student&guarded=1"
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            Student shell →
          </Link>
          <Link
            href="/dashboard-preview?role=platform&guarded=1"
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            Super Admin shell →
          </Link>
        </section>

        <DashboardCard>
          <h2 className="font-display text-lg font-bold">Buttons</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DashboardButton>Primary</DashboardButton>
            <DashboardButton variant="secondary">Secondary</DashboardButton>
            <DashboardButton variant="ghost">Ghost</DashboardButton>
            <DashboardButton variant="danger">Danger</DashboardButton>
            <DashboardButton loading loadingLabel="Working…">
              Loading
            </DashboardButton>
            <DashboardButton disabled>Disabled</DashboardButton>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="font-display text-lg font-bold">Chips</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Chip variant="neutral">Neutral</Chip>
            <Chip variant="brand">Brand</Chip>
            <Chip variant="success" dot>
              Live
            </Chip>
            <Chip variant="warning" dot>
              Pending
            </Chip>
            <Chip variant="danger" dot>
              Cancelled
            </Chip>
            <Chip variant="accent" dot>
              Coral accent
            </Chip>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="font-display text-lg font-bold">Fields</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="showcase-email" hint="We only use this for invites.">
              <Input id="showcase-email" type="email" placeholder="manager@college.ac.in" />
            </Field>
            <Field
              label="Club"
              htmlFor="showcase-club"
              error="Pick a club — this one has no manager yet."
            >
              <Select id="showcase-club" defaultValue="" aria-invalid="true">
                <option value="" disabled>
                  Select a club
                </option>
                <option value="roborangers">RoboRangers</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="showcase-desc">
                <Textarea id="showcase-desc" placeholder="Shown to students on the event page." />
              </Field>
            </div>
          </div>
        </DashboardCard>

        <div className="grid gap-6 sm:grid-cols-2">
          <EmptyState
            icon={Inbox}
            title="No registrations yet"
            description="Registrations appear here as students start registering for events."
            actionLabel={actions.browseEvents}
            actionHref="/dashboard-preview"
          />
          <div className="space-y-4">
            <SkeletonCard label="Loading cards" />
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <Skeleton shape="line" className="w-1/3" />
              <SkeletonLines count={3} className="mt-3" />
              <div className="mt-4 flex gap-3">
                <DashboardButton
                  size="sm"
                  variant="secondary"
                  leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}
                  onClick={() =>
                    toast('Info toast: feedback appears near the trigger, never blocking.', {
                      variant: 'info',
                    })
                  }
                >
                  Info toast
                </DashboardButton>
                <DashboardButton
                  size="sm"
                  variant="danger"
                  leftIcon={<Club aria-hidden="true" className="h-4 w-4" />}
                  onClick={() =>
                    toast("Couldn't save. The server didn't respond — try again in a moment.", {
                      variant: 'error',
                    })
                  }
                >
                  Error toast
                </DashboardButton>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--ink-soft)]">
          {roleNames.collegeAdmin} · {roleNames.eventManager} · {roleNames.student} ·{' '}
          {roleNames.superAdmin} — one term per role, everywhere.
        </p>
      </div>
    </div>
  );
}
