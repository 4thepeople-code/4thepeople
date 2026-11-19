import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ManagerEventDetailClient } from './ManagerEventDetailClient';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface ManagerEventDetailPageProps {
  params: Promise<{ slug: string; clubId: string; eventId: string }>;
}

export async function generateMetadata({ params }: ManagerEventDetailPageProps): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug;
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
  const resolved = await params;
  const slug = resolved?.slug;
  const clubId = resolved?.clubId;
  const eventId = resolved?.eventId;

  if (!slug || !clubId || !eventId || !UUID_REGEX.test(clubId) || !UUID_REGEX.test(eventId)) {
    notFound();
  }

  return <ManagerEventDetailClient slug={slug} clubId={clubId} eventId={eventId} />;
}

