import type { Metadata } from 'next';
import ManagerEventEditorClient from './ManagerEventEditorClient';

export const metadata: Metadata = {
  title: 'Event management | 4thepeople',
  description: 'Manage event details, media covers, gallery, and registrations.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManagerEventEditorPage({
  params,
}: {
  params: Promise<{ slug: string; clubId: string; eventId: string }>;
}) {
  const { slug, clubId, eventId } = await params;
  return <ManagerEventEditorClient slug={slug} clubId={clubId} eventId={eventId} />;
}
