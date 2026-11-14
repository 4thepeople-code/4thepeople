import type { Metadata } from 'next';
import DepartmentsClient from './DepartmentsClient';

export const metadata: Metadata = {
  title: 'Departments | 4thepeople',
  description: 'Academic departments, short codes and their affiliated clubs.',
};

export default async function CollegeAdminDepartmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DepartmentsClient slug={slug} />;
}
