import React from 'react';
import type { Metadata } from 'next';
import PlatformAdminLoginClient from './PlatformAdminLoginClient';

export const metadata: Metadata = {
  title: 'Platform Operations Sign In | 4thepeople',
  description: 'Cryptographically secured platform super-administrator authentication.',
};

export default function PlatformAdminLoginPage() {
  return <PlatformAdminLoginClient />;
}
