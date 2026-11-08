import type { Metadata } from 'next';
import { LoginPageClient } from './LoginPageClient';

interface LoginPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ returnUrl?: string; activated?: string; rollNumber?: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Student Portal Login | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Log in to your ${collegeDisplay} student account to register for events, manage RSVPs, and discover campus clubs.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/login`,
    },
    openGraph: {
      title: `Student Portal Login | ${collegeDisplay} | 4 THE PEOPLE`,
      description: `Access your ${collegeDisplay} campus student account.`,
      url: `https://${slug}.4thepeople.in/login`,
      siteName: '4 THE PEOPLE',
    },
  };
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <LoginPageClient
      slug={slug}
      initialReturnUrl={resolvedSearchParams.returnUrl}
      activated={resolvedSearchParams.activated === 'true'}
      initialRollNumber={resolvedSearchParams.rollNumber}
    />
  );
}
