import StudentDashboardFrame from './StudentDashboardFrame';

/**
 * Student shell for every /college/[slug]/student/* screen. Lives in a route
 * group so /college/[slug]/login (the student login shim) stays unguarded; the
 * RoleGuard keeps the session + coarse role check the old in-page redirect
 * enforced (unauthenticated → student login with returnUrl, College Admin →
 * admin workspace).
 */
export default async function StudentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <StudentDashboardFrame slug={slug}>{children}</StudentDashboardFrame>;
}
