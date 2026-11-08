import React from 'react';
import CollegeAdminDashboardClient from './CollegeAdminDashboardClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminDashboardClient slug={slug} />;
}

