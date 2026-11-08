import React from 'react';
import CollegeAdminUserDetailClient from './CollegeAdminUserDetailClient';

interface PageProps {
  params: Promise<{
    slug: string;
    userId: string;
  }>;
}

export default async function CollegeAdminUserDetailPage({ params }: PageProps) {
  const { slug, userId } = await params;
  return <CollegeAdminUserDetailClient slug={slug} userId={userId} />;
}

