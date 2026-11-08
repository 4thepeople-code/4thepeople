import type { Metadata } from 'next';
import { ActivatePageClient } from './ActivatePageClient';

interface ActivatePageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ rollNumber?: string }>;
}

export async function generateMetadata({ params }: ActivatePageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Activate Student Account | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Activate your institutional student account for ${collegeDisplay} and configure your account password.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/activate`,
    },
    openGraph: {
      title: `Activate Student Account | ${collegeDisplay} | 4 THE PEOPLE`,
      description: `First-time student activation for ${collegeDisplay}.`,
      url: `https://${slug}.4thepeople.in/activate`,
      siteName: '4 THE PEOPLE',
    },
  };
}

export default async function ActivatePage({ params, searchParams }: ActivatePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <ActivatePageClient
      slug={slug}
      initialRollNumber={resolvedSearchParams.rollNumber}
    />
  );
}

