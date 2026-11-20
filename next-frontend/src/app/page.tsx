import React from 'react';
import type { Metadata } from 'next';
import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import CollegesSection from '@/components/landing/CollegesSection';
import AudienceSection from '@/components/landing/AudienceSection';
import LiveFeedSection from '@/components/landing/LiveFeedSection';
import BeforeAfterSection from '@/components/landing/BeforeAfterSection';
import AdminTrustSection from '@/components/landing/AdminTrustSection';
import StepsSection from '@/components/landing/StepsSection';
import CtaSection from '@/components/landing/CtaSection';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: '4 the people — Every club event on your campus. One place.',
  description:
    'Browse campus events, register in one tap, show a QR ticket at the door. Live at LBRCE. Free for students.',
  alternates: {
    canonical: 'https://4thepeople.in',
  },
  openGraph: {
    title: '4 the people — Every club event on your campus. One place.',
    description:
      'Browse campus events, register in one tap, show a QR ticket at the door. Live at LBRCE. Free for students.',
    type: 'website',
    url: 'https://4thepeople.in',
  },
};

export default function LandingPage() {
  return (
    <div className="landing-scope min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <LandingNavbar />
      <main>
        <HeroSection />
        <CollegesSection />
        <AudienceSection />
        <LiveFeedSection />
        <BeforeAfterSection />
        <AdminTrustSection />
        <StepsSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
