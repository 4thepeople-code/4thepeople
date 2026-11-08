import React from 'react';
import CollegeAdminLoginClient from './CollegeAdminLoginClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    returnUrl?: string;
  }>;
}

export default async function CollegeAdminLoginPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { returnUrl } = await searchParams;

  return <CollegeAdminLoginClient slug={slug} initialReturnUrl={returnUrl} />;
}

