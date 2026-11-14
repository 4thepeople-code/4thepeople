import PlatformDashboardFrame from './PlatformDashboardFrame';

/**
 * Super Admin shell for /admin, /admin/colleges and /admin/admins. Lives in a
 * route group so /admin/login (no shell) is unaffected.
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <PlatformDashboardFrame>{children}</PlatformDashboardFrame>;
}
