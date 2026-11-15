import type { Metadata } from 'next';
import RegistrationsClient from './RegistrationsClient';

export const metadata: Metadata = {
  title: 'My registrations | 4thepeople',
  description: 'Campus events you have registered for.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudentRegistrationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <RegistrationsClient slug={slug} />;
}
