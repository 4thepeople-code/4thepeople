import type { Metadata } from 'next';
import { ManagerEventDetailClient } from './ManagerEventDetailClient';

interface ManagerEventDetailPageProps {
  params: Promise<{ slug: string; clubId: string; eventId: string }>;
}

export async function generateMetadata({ params }: ManagerEventDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Event Management | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Manage event details, media covers, gallery, and registrations for ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ManagerEventDetailPage({ params }: ManagerEventDetailPageProps) {
  const { slug, clubId, eventId } = await params;
  return <ManagerEventDetailClient slug={slug} clubId={clubId} eventId={eventId} />;
}

