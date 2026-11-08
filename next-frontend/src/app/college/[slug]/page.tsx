import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CollegeHomePageClient from './CollegeHomePageClient';

export interface CollegePortalPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CollegePortalPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'College Portal Not Found | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `${collegeDisplay} | Student Campus Events & Clubs | 4 THE PEOPLE`,
    description: `Explore official campus clubs, upcoming workshops, hackathons, and student activities at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in`,
    },
    openGraph: {
      title: `${collegeDisplay} Student Hub | 4 THE PEOPLE`,
      description: `Official student clubs, event registrations, and campus life at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in`,
    },
  };
}

export default async function CollegePortalPage({ params }: CollegePortalPageProps) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <CollegeHomePageClient slug={slug.toLowerCase()} />;
}
