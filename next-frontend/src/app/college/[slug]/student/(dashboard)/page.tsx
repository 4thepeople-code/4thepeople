import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import RegistrationsClient from './RegistrationsClient';

export const metadata: Metadata = {
  title: 'My registrations | 4thepeople',
  description: 'Campus events you have registered for.',
  robots: {
    index: false,
    follow: false,
  },
};

/** Tabs the old tabbed student dashboard accepted as ?tab= deep links. */
const OLD_TAB_ROUTES: Record<string, string> = {
  events: '/events',
  certificates: '/certificates',
  profile: '/profile',
};

export default async function StudentRegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  // Old tabbed-dashboard deep links (/student?tab=events etc.) move to their
  // real routes; anything else (incl. ?tab=registrations) stays on the landing.
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const target = rawTab ? OLD_TAB_ROUTES[rawTab] : undefined;
  if (target) {
    redirect(`/college/${slug}/student${target}`);
  }

  return <RegistrationsClient slug={slug} />;
}
