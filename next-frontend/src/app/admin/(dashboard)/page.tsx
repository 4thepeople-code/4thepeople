import type { Metadata } from 'next';
import OverviewClient from './OverviewClient';

export const metadata: Metadata = {
  title: 'Platform overview | 4thepeople',
  description: 'Colleges onboarded to 4 the people and their College Admin assignments.',
};

export default function AdminOverviewPage() {
  return <OverviewClient />;
}
