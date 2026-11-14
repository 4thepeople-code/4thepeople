import type { Metadata } from 'next';
import RosterClient from './RosterClient';

export const metadata: Metadata = {
  title: 'Student roster | 4thepeople',
  description: 'Import student records in bulk for self-activation.',
};

export default async function CollegeAdminRosterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <RosterClient slug={slug} />;
}
