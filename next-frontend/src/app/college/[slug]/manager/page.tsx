import type { Metadata } from 'next';
import { ManagerDashboardClient } from './ManagerDashboardClient';

interface ManagerDashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ManagerDashboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Manager Dashboard | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Club and Event Manager workspace for ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ManagerDashboardPage({ params }: ManagerDashboardPageProps) {
  const { slug } = await params;
  return <ManagerDashboardClient slug={slug} />;
}

