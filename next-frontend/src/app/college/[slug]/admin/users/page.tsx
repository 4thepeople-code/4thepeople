import React from 'react';
import CollegeAdminUsersClient from './CollegeAdminUsersClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CollegeAdminUsersPage({ params }: PageProps) {
  const { slug } = await params;
  return <CollegeAdminUsersClient slug={slug} />;
}

