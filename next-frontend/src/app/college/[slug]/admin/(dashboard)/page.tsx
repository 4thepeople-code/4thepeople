import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'College Admin overview | 4thepeople',
  description: 'Accounts, clubs and Event Managers at your college, plus common shortcuts.',
};

export default async function CollegeAdminDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DashboardClient slug={slug} />;
}
