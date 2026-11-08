import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClubsListPageClient from './ClubsListPageClient';

export interface ClubsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ClubsPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Clubs Directory | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Campus Clubs & Societies | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Explore student organizations, technical chapters, and cultural clubs at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/clubs`,
    },
    openGraph: {
      title: `Clubs Directory | ${collegeDisplay}`,
      description: `Discover and connect with student clubs and communities at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/clubs`,
    },
  };
}

export default async function ClubsPage({ params }: ClubsPageProps) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <ClubsListPageClient slug={slug.toLowerCase()} />;
}

