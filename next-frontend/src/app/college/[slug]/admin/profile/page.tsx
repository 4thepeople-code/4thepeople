import React from 'react';
import CollegeAdminProfileClient from './CollegeAdminProfileClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminProfilePage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminProfileClient slug={slug} />;
}

