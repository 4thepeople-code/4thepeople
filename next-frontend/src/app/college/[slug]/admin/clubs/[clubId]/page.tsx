import React from 'react';
import CollegeAdminClubDetailClient from './CollegeAdminClubDetailClient';

interface PageProps {
  params: Promise<{
    slug: string;
    clubId: string;
  }>;
}

export default async function CollegeAdminClubDetailPage({ params }: PageProps) {
  const { slug, clubId } = await params;
  return <CollegeAdminClubDetailClient slug={slug} clubId={clubId} />;
}

