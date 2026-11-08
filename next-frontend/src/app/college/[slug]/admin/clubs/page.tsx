import React from 'react';
import CollegeAdminClubsClient from './CollegeAdminClubsClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminClubsPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminClubsClient slug={slug} />;
}

