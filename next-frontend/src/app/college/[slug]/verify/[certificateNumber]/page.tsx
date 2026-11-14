import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CertificateVerifyClient from './CertificateVerifyClient';

export interface CertificateVerifyPageProps {
  params: Promise<{ slug: string; certificateNumber: string }>;
}

export async function generateMetadata({ params }: CertificateVerifyPageProps): Promise<Metadata> {
  const { slug, certificateNumber } = await params;

  if (!slug || !certificateNumber) {
    return {
      title: 'Certificate Verification | 4 THE PEOPLE',
    };
  }

  const collegeDisplay = slug.toUpperCase();

  return {
    title: `Verify Certificate ${certificateNumber} | ${collegeDisplay} | 4 THE PEOPLE`,
    description: `Public credential authenticity verification for certificate ${certificateNumber} at ${collegeDisplay}.`,
    robots: {
      index: false, // Prevent search indexing of verification lookup pages
      follow: false,
    },
  };
}

export default async function CertificateVerifyPage({ params }: CertificateVerifyPageProps) {
  const { slug, certificateNumber } = await params;

  if (!slug || !certificateNumber) {
    notFound();
  }

  return (
    <CertificateVerifyClient
      slug={slug.toLowerCase()}
      certificateNumber={decodeURIComponent(certificateNumber)}
    />
  );
}
