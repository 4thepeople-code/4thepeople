import type { Metadata } from 'next';
import { ManagerClubDetailClient } from './ManagerClubDetailClient';

interface ManagerClubDetailPageProps {
  params: Promise<{ slug: string; clubId: string }>;
}

export async function generateMetadata({ params }: ManagerClubDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Club Management | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Manage club profile, media branding, and events for ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ManagerClubDetailPage({ params }: ManagerClubDetailPageProps) {
  const { slug, clubId } = await params;
  return <ManagerClubDetailClient slug={slug} clubId={clubId} />;
}

