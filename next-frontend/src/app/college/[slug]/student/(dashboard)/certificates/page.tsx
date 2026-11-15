import type { Metadata } from 'next';
import CertificatesClient from './CertificatesClient';

export const metadata: Metadata = {
  title: 'My certificates | 4thepeople',
  description: 'Official participation credentials issued for your campus events.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudentCertificatesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CertificatesClient slug={slug} />;
}
