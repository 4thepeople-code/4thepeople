import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClubDetailPageClient from './ClubDetailPageClient';

export interface ClubDetailPageProps {
  params: Promise<{ slug: string; clubId: string }>;
}

export async function generateMetadata({ params }: ClubDetailPageProps): Promise<Metadata> {
  const { slug, clubId } = await params;

  if (!slug || !clubId || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Club Details | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Club Profile | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `View student club details, upcoming event schedules, and photo archives at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/clubs/${clubId}`,
    },
    openGraph: {
      title: `Club Profile | ${collegeDisplay}`,
      description: `Student club activities, members, and events at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/clubs/${clubId}`,
    },
  };
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { slug, clubId } = await params;

  if (!slug || !clubId || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <ClubDetailPageClient slug={slug.toLowerCase()} clubId={clubId} />;
}

