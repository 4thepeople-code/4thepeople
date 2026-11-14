import type { Metadata } from 'next';
import CollegesClient from './CollegesClient';

export const metadata: Metadata = {
  title: 'Colleges | 4thepeople',
  description: 'Add colleges, invite their College Admins, and control whether each college portal is live.',
};

export default function PlatformCollegesPage() {
  return <CollegesClient />;
}
