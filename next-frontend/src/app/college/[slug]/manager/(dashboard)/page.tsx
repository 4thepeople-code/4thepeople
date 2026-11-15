import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Event Manager overview | 4thepeople',
  description: 'Your managed clubs, members and published events.',
};

export default async function ManagerDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DashboardClient slug={slug} />;
}
