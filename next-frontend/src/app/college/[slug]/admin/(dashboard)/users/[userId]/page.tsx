import type { Metadata } from 'next';
import UserDetailClient from './UserDetailClient';

export const metadata: Metadata = {
  title: 'Account details | 4thepeople',
  description: 'Inspect an account and its club memberships.',
};

export default async function CollegeAdminUserDetailPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  return <UserDetailClient slug={slug} userId={userId} />;
}
