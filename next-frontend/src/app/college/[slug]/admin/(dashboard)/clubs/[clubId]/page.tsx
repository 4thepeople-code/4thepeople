import type { Metadata } from 'next';
import ClubDetailClient from './ClubDetailClient';

export const metadata: Metadata = {
  title: 'Club details | 4thepeople',
  description: 'Inspect a club and manage its Event Managers.',
};

export default async function CollegeAdminClubDetailPage({
  params,
}: {
  params: Promise<{ slug: string; clubId: string }>;
}) {
  const { slug, clubId } = await params;
  return <ClubDetailClient slug={slug} clubId={clubId} />;
}
