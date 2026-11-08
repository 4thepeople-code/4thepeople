import React from 'react';
import type { Metadata } from 'next';
import PlatformAdminDashboardClient from './PlatformAdminDashboardClient';

export const metadata: Metadata = {
  title: 'Platform Operations Dashboard | 4thepeople',
  description: 'Multi-tenant institution directory and platform operations command center.',
};

export default function PlatformAdminDashboardPage() {
  return <PlatformAdminDashboardClient />;
}
