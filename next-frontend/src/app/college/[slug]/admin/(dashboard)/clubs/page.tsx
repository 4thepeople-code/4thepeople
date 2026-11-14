import type { Metadata } from 'next';
import ClubsClient from './ClubsClient';

export const metadata: Metadata = {
  title: 'Clubs | 4thepeople',
  description: 'Every club at this college, its departments and its Event Managers.',
};

export default async function CollegeAdminClubsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ClubsClient slug={slug} />;
}
