import type { Metadata } from 'next';
import { ManagerProfileClient } from './ManagerProfileClient';

interface ManagerProfilePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ManagerProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const collegeDisplay = slug ? slug.toUpperCase() : 'CAMPUS';

  return {
    title: `Manager Profile Settings | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Manage profile, avatar, credentials, and view assigned clubs for ${collegeDisplay}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ManagerProfilePage({ params }: ManagerProfilePageProps) {
  const { slug } = await params;
  return <ManagerProfileClient slug={slug} />;
}

