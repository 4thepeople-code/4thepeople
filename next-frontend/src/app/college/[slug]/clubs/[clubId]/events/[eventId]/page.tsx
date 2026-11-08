import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventDetailPageClient from '@/app/college/[slug]/events/[eventId]/EventDetailPageClient';

export interface ClubEventDetailPageProps {
  params: Promise<{ slug: string; clubId: string; eventId: string }>;
}

export async function generateMetadata({ params }: ClubEventDetailPageProps): Promise<Metadata> {
  const { slug, clubId, eventId } = await params;

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
      canonical: `https://${slug}.4thepeople.in/clubs/${clubId}/events/${eventId}`,
    },
    openGraph: {
      title: `Campus Event Details | ${collegeDisplay}`,
      description: `Student event schedule, location, and official registrations at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/clubs/${clubId}/events/${eventId}`,
    },
  };
}

export default async function ClubEventDetailPage({ params }: ClubEventDetailPageProps) {
  const { slug, clubId, eventId } = await params;

  if (!slug || !eventId || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <EventDetailPageClient slug={slug.toLowerCase()} eventId={eventId} clubId={clubId} />;
}

