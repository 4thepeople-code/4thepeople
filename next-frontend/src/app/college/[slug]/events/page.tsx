import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CollegeEventsPageClient from './CollegeEventsPageClient';

export interface CollegeEventsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CollegeEventsPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Campus Events | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Campus Events | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Upcoming workshops, competitions and community activities at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/events`,
    },
    openGraph: {
      title: `Campus Events | ${collegeDisplay}`,
      description: `Upcoming workshops, competitions and community activities at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/events`,
    },
  };
}

export default async function CollegeEventsPage({ params }: CollegeEventsPageProps) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <CollegeEventsPageClient slug={slug.toLowerCase()} collegeName={slug.toUpperCase()} />;
}
