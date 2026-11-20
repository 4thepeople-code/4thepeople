import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CreateEventClient } from './CreateEventClient';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface CreateEventPageProps {
  params: Promise<{ slug: string; clubId: string }>;
}

export async function generateMetadata({ params }: CreateEventPageProps): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Create Event | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Create a new campus event for a managed club at ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CreateEventPage({ params }: CreateEventPageProps) {
  const resolved = await params;
  const slug = resolved?.slug;
  const clubId = resolved?.clubId;

  if (!slug || !clubId || !UUID_REGEX.test(clubId)) {
    notFound();
  }

  return <CreateEventClient slug={slug} clubId={clubId} />;
}
