import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import BrandLogo from '@/components/landing/BrandLogo';
import { COLLEGES } from '@/components/landing/data';

interface DemoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DemoCollegePage({ params }: DemoPageProps) {
  const { slug } = await params;
  const college = COLLEGES.find((c) => c.slug === slug) || {
    slug,
    name: slug.toUpperCase(),
    shortName: slug.toUpperCase(),
    city: 'Campus',
    status: 'demo' as const,
    homepageUrl: `/demo/${slug}`,
    tagline: 'Demo college experience.',
    description: 'Explore how 4 the people looks on your campus.',
  };

  return (
    <div className="landing-scope min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between">
      <header className="border-b border-[var(--line)] bg-[var(--surface)] py-4 px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center">
            <BrandLogo size="md" variant="dark" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Demo Environment
            </span>
            <Link
              href="/college/lbrce"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Switch to Live LBRCE
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-soft px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Campus Demo</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--ink)]">
          {college.name}
        </h1>

        <p className="mt-4 text-base sm:text-lg text-[var(--ink-soft)] max-w-xl mx-auto leading-relaxed">
          {college.description || college.tagline}
        </p>

        <div className="mt-8 p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-left shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--line)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              Simulated Campus Architecture
            </span>
            <span className="text-xs font-semibold text-emerald-600">● Tenant Verified</span>
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            This campus demonstrates how student organizations, department clubs, and ticket reservations are partitioned. The active production deployment for Andhra Pradesh is live at <strong>LBRCE</strong>.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/college/lbrce"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition-all hover:bg-brand-500 shadow-sm"
          >
            <span>Visit Live LBRCE Portal</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>

          <Link
            href="/#colleges"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Campuses</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] py-6 text-center text-xs text-[var(--ink-soft)]">
        <p>© 2026 4 the people. Demo college sandbox preview.</p>
      </footer>
    </div>
  );
}
