import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'Student profile | 4thepeople',
  description: 'Your verified student account details.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProfileClient slug={slug} />;
}
