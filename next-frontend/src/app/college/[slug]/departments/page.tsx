import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DepartmentsListPageClient from './DepartmentsListPageClient';

export interface DepartmentsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DepartmentsPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Departments Directory | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Academic Departments | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Discover academic divisions, departments, and affiliated student clubs at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/departments`,
    },
    openGraph: {
      title: `Academic Departments | ${collegeDisplay}`,
      description: `Campus academic departments and student organizations at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/departments`,
    },
  };
}

export default async function DepartmentsPage({ params }: DepartmentsPageProps) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <DepartmentsListPageClient slug={slug.toLowerCase()} />;
}

