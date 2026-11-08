import type { Metadata } from 'next';
import { ManagerLoginClient } from './ManagerLoginClient';

interface ManagerLoginPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ returnUrl?: string }>;
}

export async function generateMetadata({ params }: ManagerLoginPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Manager Login | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Log in to manage campus clubs, organize events, and review student attendees at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/login/manager`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ManagerLoginPage({ params, searchParams }: ManagerLoginPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <ManagerLoginClient
      slug={slug}
      initialReturnUrl={resolvedSearchParams.returnUrl}
    />
  );
}

