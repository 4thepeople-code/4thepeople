import React from 'react';
import Link from 'next/link';
import { COLLEGES } from './data';

const DEMO_ITEMS = [
  {
    slug: 'lbrce',
    name: 'LBRCE',
    shortName: 'LBRCE',
    description: 'The live LBRCE portal walked end to end — public, student and staff views, no login.',
    url: '/demo/lbrce',
  },
  {
    slug: 'northwood',
    name: 'Northwood University',
    shortName: 'Northwood',
    description: 'Robotics, music, dance and debate clubs share one calendar.',
    url: '/demo/northwood',
  },
  {
    slug: 'crestview',
    name: 'Crestview College',
    shortName: 'Crestview',
    description: 'Poetry slams, synth nights and generative art jams.',
    url: '/demo/crestview',
  },
  {
    slug: 'bellavista',
    name: 'Bellavista Institute',
    shortName: 'Bellavista',
    description: 'Game jams, synth builds and street-dance fusion.',
    url: '/demo/bellavista',
  },
  {
    slug: 'westbrook',
    name: 'Westbrook University',
    shortName: 'Westbrook',
    description: 'Rivalry games, skate sessions and summit hikes.',
    url: '/demo/westbrook',
  },
];

export default function CollegesSection() {
  const liveCollege = COLLEGES.find((c) => c.status === 'live') || COLLEGES[0];

  return (
    <section
      id="colleges"
      aria-labelledby="colleges-heading"
      className="scroll-mt-24 bg-[var(--bg)] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Pick a campus
          </p>
          <h2
            id="colleges-heading"
            className="mt-4 font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl"
          >
            Pick a <em className="italic font-bold text-brand-600">campus.</em>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
            LBRCE is live. Explore the demo colleges to see how a campus looks.
          </p>
        </div>

        {/* Live Now Highlight Banner */}
        <div className="mt-14 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 lg:p-10 shadow-sm flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
              Live now
            </p>
            <h3 className="font-display text-2xl font-bold text-[var(--ink)] lg:text-3xl">
              {liveCollege.name}
            </h3>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {liveCollege.tagline}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-1.5" aria-hidden="true" />
              Live
            </span>
          </div>

          <Link
            className="mt-4 lg:mt-0 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:text-[var(--primary-strong)]"
            href={liveCollege.homepageUrl}
          >
            Visit {liveCollege.shortName} →
          </Link>
        </div>

        {/* Demo Colleges Grid */}
        <div className="mt-14">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-4">
            Try a demo
          </h3>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_ITEMS.map((col) => (
              <article
                key={col.slug}
                className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm h-full flex flex-col transition-colors hover:border-[var(--primary)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold text-[var(--ink)]">
                      {col.name}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
                      Demo
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Demo
                  </span>
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                  {col.description}
                </p>

                <Link
                  className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:text-[var(--primary-strong)]"
                  href={col.url}
                >
                  Explore {col.shortName} demo →
                </Link>
              </article>
            ))}
          </div>
        </div>

        {/* Your College Here Early Access Banner */}
        <div className="mt-10 rounded-3xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <p className="font-display text-lg font-bold text-[var(--ink)] lg:text-xl">
              Your college here
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              Not live at your college yet? Get early access and we&apos;ll set it up.
            </p>
          </div>

          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            href="#cta"
          >
            Get early access
          </Link>
        </div>
      </div>
    </section>
  );
}
