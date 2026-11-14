import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'My profile | 4thepeople',
  description: 'Update your College Admin profile, picture and password.',
};

export default async function CollegeAdminProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProfileClient slug={slug} />;
}
