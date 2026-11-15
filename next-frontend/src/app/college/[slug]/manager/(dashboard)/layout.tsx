import ManagerDashboardFrame from './ManagerDashboardFrame';

/**
 * Event Manager shell for every /college/[slug]/manager/* screen. Lives in a
 * route group so /college/[slug]/manager/login (a redirect shim) stays
 * unguarded; the RoleGuard keeps the manager check (legacy 'MANAGER' or
 * 'USER' with active memberships, College Admin bounced to the admin
 * workspace) that the old ManagerLayout enforced.
 */
export default async function ManagerDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ManagerDashboardFrame slug={slug}>{children}</ManagerDashboardFrame>;
}
