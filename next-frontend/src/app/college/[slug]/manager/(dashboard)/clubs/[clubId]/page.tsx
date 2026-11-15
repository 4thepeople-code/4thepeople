import type { Metadata } from 'next';
import ClubDetailClient from './ClubDetailClient';

export const metadata: Metadata = {
  title: 'Club management | 4thepeople',
  description: 'Manage a club\'s details, media branding, members and events.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManagerClubDetailPage({
  params,
}: {
  params: Promise<{ slug: string; clubId: string }>;
}) {
  const { slug, clubId } = await params;
  return <ClubDetailClient slug={slug} clubId={clubId} />;
}
