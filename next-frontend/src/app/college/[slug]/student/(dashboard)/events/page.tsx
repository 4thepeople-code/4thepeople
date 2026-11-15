import type { Metadata } from 'next';
import DiscoverEventsClient from './DiscoverEventsClient';

export const metadata: Metadata = {
  title: 'Discover events | 4thepeople',
  description: 'Upcoming campus events across every club.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudentDiscoverEventsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DiscoverEventsClient slug={slug} />;
}
