import type { Metadata } from 'next';
import { StudentDashboardClient } from './StudentDashboardClient';

interface StudentPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: StudentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Student Dashboard | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Manage your campus event registrations, RSVPs, and profile at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/student`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentPage({ params, searchParams }: StudentPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <StudentDashboardClient
      slug={slug}
      initialTab={resolvedSearchParams.tab}
    />
  );
}

