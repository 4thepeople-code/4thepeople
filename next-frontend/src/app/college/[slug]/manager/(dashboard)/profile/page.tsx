import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'Manager profile | 4thepeople',
  description: 'Manage your manager profile, avatar and password.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManagerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProfileClient slug={slug} />;
}
