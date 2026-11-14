import type { Metadata } from 'next';
import CreateClubClient from './CreateClubClient';

export const metadata: Metadata = {
  title: 'Create club | 4thepeople',
  description: 'Set up a new recognised campus organisation.',
};

export default async function CollegeAdminCreateClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CreateClubClient slug={slug} />;
}
