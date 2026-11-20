import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventsListPageClient from './EventsListPageClient';

export interface EventsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EventsPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Events Directory | 4 THE PEOPLE',
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

export default async function EventsPage({ params }: EventsPageProps) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <EventsListPageClient slug={slug.toLowerCase()} />;
}
