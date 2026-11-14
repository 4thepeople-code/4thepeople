import type { Metadata } from 'next';
import UsersClient from './UsersClient';

export const metadata: Metadata = {
  title: 'Accounts | 4thepeople',
  description: 'Every account at this college — students, Event Managers and College Admins.',
};

export default async function CollegeAdminUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UsersClient slug={slug} />;
}
