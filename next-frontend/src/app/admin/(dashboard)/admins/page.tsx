import type { Metadata } from 'next';
import AdminsClient from './AdminsClient';

export const metadata: Metadata = {
  title: 'Platform admins | 4thepeople',
  description: 'Super Admins with full platform access and their two-factor sign-in status.',
};

export default function PlatformAdminsPage() {
  return <AdminsClient />;
}
