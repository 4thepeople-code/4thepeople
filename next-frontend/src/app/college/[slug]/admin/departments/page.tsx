import React from 'react';
import CollegeAdminDepartmentsClient from './CollegeAdminDepartmentsClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminDepartmentsPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminDepartmentsClient slug={slug} />;
}

