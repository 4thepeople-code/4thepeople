import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventDetailPageClient from './EventDetailPageClient';

export interface EventDetailPageProps {
  params: Promise<{ slug: string; eventId: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { slug, eventId } = await params;

  if (!slug || !eventId || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Event Details | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Campus Event Details | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `RSVP and view schedule, timing, venue, and registration links for this campus event at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/events/${eventId}`,
    },
    openGraph: {
      title: `Campus Event Details | ${collegeDisplay}`,
      description: `Student event schedule, location, and official registrations at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/events/${eventId}`,
    },
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug, eventId } = await params;

  if (!slug || !eventId || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <EventDetailPageClient slug={slug.toLowerCase()} eventId={eventId} />;
}

