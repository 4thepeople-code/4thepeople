'use client';

import { createContext, useContext, useState } from 'react';
import { UserPlus } from 'lucide-react';
import RoleGuard from '@/components/dashboard/RoleGuard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import InviteManagerModal from '@/components/collegeAdmin/InviteManagerModal';
import { actions } from '@/lib/copy';

/** Opens the global "Invite Event Manager" modal from anywhere in the shell. */
const InviteManagerContext = createContext<() => void>(() => {});

// eslint-disable-next-line react-refresh/only-export-components
export function useOpenInviteManager() {
  return useContext(InviteManagerContext);
}

/**
 * College Admin frame: RoleGuard (COLLEGE_ADMIN or ADMIN — the old
 * AdminLayout requirement, kept) around the shared DashboardShell, plus the
 * global "Invite Event Manager" entry that used to live in the old sidebar.
 */
export default function CollegeAdminFrame({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <InviteManagerContext.Provider value={() => setInviteOpen(true)}>
      <RoleGuard role="collegeAdmin" slug={slug}>
        <DashboardShell
          role="collegeAdmin"
          slug={slug}
          secondaryAction={{
            label: actions.inviteManager,
            icon: UserPlus,
            onClick: () => setInviteOpen(true),
          }}
        >
          {children}
        </DashboardShell>
        <InviteManagerModal slug={slug} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
      </RoleGuard>
    </InviteManagerContext.Provider>
  );
}
