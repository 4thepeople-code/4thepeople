import React from 'react';
import type { Metadata } from 'next';
import { PaymentStatusPageClient } from '@/app/college/[slug]/events/[eventId]/payment/status/PaymentStatusPageClient';

export interface RootPaymentStatusPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Payment Status | 4 THE PEOPLE',
  description: 'Transaction verification and event registration confirmation.',
};

export default async function RootPaymentStatusPage({ params }: RootPaymentStatusPageProps) {
  const { eventId } = await params;
  // Default to public root slug
  return <PaymentStatusPageClient slug="lbrce" eventId={eventId} />;
}
