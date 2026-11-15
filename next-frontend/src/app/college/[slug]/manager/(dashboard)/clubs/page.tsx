import type { Metadata } from 'next';
import MyClubsClient from './MyClubsClient';

export const metadata: Metadata = {
  title: 'My Managed Clubs | 4thepeople',
  description: 'Manage your assigned clubs and view performance.',
};

export default async function ManagerMyClubsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MyClubsClient slug={slug} />;
}
