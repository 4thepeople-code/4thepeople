import React from 'react';
import CollegeAdminRosterClient from './CollegeAdminRosterClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminRosterPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminRosterClient slug={slug} />;
}

