'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Building2 } from 'lucide-react';
import RoleGuard from '@/components/dashboard/RoleGuard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { actions, eventManager } from '@/lib/copy';
import { useMyClubsQuery } from '@/lib/api/manager';

export interface ManagerDashboardFrameProps {
  slug: string;
  children: React.ReactNode;
}

const createEventPath = (slug: string, clubId: string) =>
  `/college/${slug}/manager/clubs/${clubId}/events/create`;

const CreateEventContext = createContext<() => void>(() => {});

/** Opens the club-aware "Create event" flow from anywhere in the shell. */
export function useOpenCreateEvent() {
  return useContext(CreateEventContext);
}

/**
 * Event Manager frame: RoleGuard (coarse 'USER'/'MANAGER' check plus the
 * College Admin bounce) around the shared DashboardShell. The topbar primary
 * action is a club-aware "Create event": one club → straight to that club's
 * new-event form, several → small club picker, none → guidance to ask the
 * College Admin.
 */
export default function ManagerDashboardFrame({ slug, children }: ManagerDashboardFrameProps) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noClubsOpen, setNoClubsOpen] = useState(false);

  // Permanently enforce light theme across the Manager Dashboard
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  const { data: myClubs = [] } = useMyClubsQuery(slug);

  const openCreateEvent = () => {
    if (myClubs.length === 0) {
      setNoClubsOpen(true);
      return;
    }
    if (myClubs.length === 1) {
      router.push(createEventPath(slug, myClubs[0].id));
      return;
    }
    setPickerOpen(true);
  };

  const chooseClub = (clubId: string) => {
    setPickerOpen(false);
    router.push(createEventPath(slug, clubId));
  };

  const primaryActionOverride = {
    label: actions.createEvent,
    icon: CalendarPlus,
    onClick: openCreateEvent,
  };

  return (
    <CreateEventContext.Provider value={openCreateEvent}>
      <RoleGuard role="eventManager" slug={slug}>
        <DashboardShell
          role="eventManager"
          slug={slug}
          collegeName={slug ? slug.toUpperCase() : undefined}
          primaryActionOverride={primaryActionOverride}
        >
          {children}
        </DashboardShell>

        {/* No managed clubs: guidance to ask the College Admin to assign one. */}
        <Modal
          open={noClubsOpen}
          onClose={() => setNoClubsOpen(false)}
          title={eventManager.noClubs.title}
          description={eventManager.noClubs.description}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{eventManager.noClubs.description}</p>
            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
              <DashboardButton variant="secondary" size="sm" onClick={() => setNoClubsOpen(false)}>
                {actions.keep}
              </DashboardButton>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNoClubsOpen(false);
                  router.push(`/college/${slug}/login/manager`);
                }}
              >
                {actions.goToLogin}
              </DashboardButton>
            </div>
          </div>
        </Modal>

        {/* Several clubs: small picker before the new-event form. */}
        <Modal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={actions.createEvent}
          description="Pick the club this event belongs to."
          size="md"
        >
          <ul className="space-y-2">
            {myClubs.map((club) => (
              <li key={club.id}>
                <button
                  type="button"
                  onClick={() => chooseClub(club.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm font-semibold text-[var(--ink)] transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <span className="flex items-center gap-3">
                    <Building2 aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
                    {club.name}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                    Create event
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      </RoleGuard>
    </CreateEventContext.Provider>
  );
}
