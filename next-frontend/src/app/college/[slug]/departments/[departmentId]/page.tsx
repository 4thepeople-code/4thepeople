import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DepartmentDetailPageClient from './DepartmentDetailPageClient';

export interface DepartmentDetailPageProps {
  params: Promise<{ slug: string; departmentId: string }>;
}

export async function generateMetadata({ params }: DepartmentDetailPageProps): Promise<Metadata> {
  const { slug, departmentId } = await params;

  if (!slug || !departmentId || !/^[a-z0-9-]+$/i.test(slug)) {
    return {
      title: 'Department Details | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Academic Department | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Explore student chapters, clubs, and technical teams affiliated with this academic department at ${collegeDisplay}.`,
    alternates: {
      canonical: `https://${slug}.4thepeople.in/departments/${departmentId}`,
    },
    openGraph: {
      title: `Academic Department | ${collegeDisplay}`,
      description: `Affiliated student clubs and academic divisions at ${collegeDisplay}.`,
      type: 'website',
      url: `https://${slug}.4thepeople.in/departments/${departmentId}`,
    },
  };
}

export default async function DepartmentDetailPage({ params }: DepartmentDetailPageProps) {
  const { slug, departmentId } = await params;

  if (!slug || !departmentId || !/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  return <DepartmentDetailPageClient slug={slug.toLowerCase()} departmentId={departmentId} />;
}

