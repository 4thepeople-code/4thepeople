import type { Metadata } from 'next';
import CreateEventClient from './CreateEventClient';

export const metadata: Metadata = {
  title: 'Create event | 4thepeople',
  description: 'Create a new campus event for a managed club.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManagerCreateEventPage({
  params,
}: {
  params: Promise<{ slug: string; clubId: string }>;
}) {
  const { slug, clubId } = await params;
  return <CreateEventClient slug={slug} clubId={clubId} />;
}
