import React from 'react';
import type { Metadata } from 'next';
import { PaymentStatusPageClient } from './PaymentStatusPageClient';

export interface PaymentStatusPageProps {
  params: Promise<{
    slug: string;
    eventId: string;
  }>;
}

export async function generateMetadata({ params }: PaymentStatusPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Payment Status | ${slug.toUpperCase()} | 4 THE PEOPLE`,
    description: 'Transaction verification and registration confirmation.',
  };
}

export default async function PaymentStatusPage({ params }: PaymentStatusPageProps) {
  const { slug, eventId } = await params;
  return <PaymentStatusPageClient slug={slug} eventId={eventId} />;
}
