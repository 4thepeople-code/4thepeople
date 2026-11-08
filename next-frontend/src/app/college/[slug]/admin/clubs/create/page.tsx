import React from 'react';
import CollegeAdminCreateClubClient from './CollegeAdminCreateClubClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminCreateClubPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminCreateClubClient slug={slug} />;
}

