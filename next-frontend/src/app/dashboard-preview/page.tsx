import DashboardPreview from '@/components/dashboard/DashboardPreview';

/**
 * TEMPORARY — Phase 1 manual test page. Removed in Phase 5 cleanup.
 *
 * /dashboard-preview                → unguarded kit + shell showcase
 * /dashboard-preview?role=admin&guarded=1 → RoleGuard + DashboardShell demo
 */
export const metadata = {
  title: 'Dashboard UI preview (temporary)',
};

type RoleParam = 'admin' | 'manager' | 'student' | 'platform' | undefined;

export default async function DashboardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; guarded?: string }>;
}) {
  const params = await searchParams;
  const roleParam = (Array.isArray(params.role) ? params.role[0] : params.role) as RoleParam;
  const guarded = params.guarded === '1';

  return <DashboardPreview roleParam={roleParam} guarded={guarded} />;
}
