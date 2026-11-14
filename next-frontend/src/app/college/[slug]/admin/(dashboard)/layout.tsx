import CollegeAdminFrame from './CollegeAdminFrame';

/**
 * College Admin shell for every /college/[slug]/admin/* screen. Lives in a
 * route group so /college/[slug]/admin/login (a redirect shim) stays
 * unguarded. The RoleGuard keeps the COLLEGE_ADMIN-or-ADMIN requirement that
 * the old AdminLayout enforced.
 */
export default async function CollegeAdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CollegeAdminFrame slug={slug}>{children}</CollegeAdminFrame>;
}
