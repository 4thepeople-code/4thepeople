'use client';

import RoleGuard from '@/components/dashboard/RoleGuard';
import DashboardShell from '@/components/dashboard/DashboardShell';

/**
 * Super Admin frame: RoleGuard (PLATFORM_SUPER_ADMIN or isPlatformAdmin —
 * the old PlatformAdminLayout requirement, kept) around the shared
 * DashboardShell. The shell sits here, not in app/admin/layout.tsx, so
 * /admin/login stays unguarded.
 */
export default function PlatformDashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="superAdmin">
      <DashboardShell role="superAdmin">{children}</DashboardShell>
    </RoleGuard>
  );
}
