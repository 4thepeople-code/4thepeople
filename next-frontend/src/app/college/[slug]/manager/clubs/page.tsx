import type { Metadata } from 'next';
import { MyClubsPageClient } from './MyClubsPageClient';

interface MyClubsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MyClubsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `My Managed Clubs | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Manage assigned clubs and view performance for ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function MyClubsPage({ params }: MyClubsPageProps) {
  const { slug } = await params;
  return <MyClubsPageClient slug={slug} />;
}

