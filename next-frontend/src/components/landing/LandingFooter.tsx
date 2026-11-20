import React from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';

export default function LandingFooter() {
  return (
    <footer className="bg-ink-950 text-white/60">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Link
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            aria-label="4 the people home"
            href="/"
          >
            <BrandLogo size="md" variant="light" />
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            The operations platform for student clubs — plan, launch and measure campus life at scale.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
            Product
          </h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a href="#steps" className="transition-colors hover:text-white">
                How it works
              </a>
            </li>
            <li>
              <a href="#before-after" className="transition-colors hover:text-white">
                Before &amp; after
              </a>
            </li>
            <li>
              <a href="#admin-trust" className="transition-colors hover:text-white">
                Admin trust
              </a>
            </li>
            <li>
              <a href="#live-feed" className="transition-colors hover:text-white">
                Live feed
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
            Colleges
          </h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <Link className="transition-colors hover:text-white" href="/college/lbrce">
                LBRCE
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-white" href="/demo/northwood">
                Northwood University <span className="text-white/40">(demo)</span>
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-white" href="/demo/crestview">
                Crestview College <span className="text-white/40">(demo)</span>
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-white" href="/demo/bellavista">
                Bellavista Institute <span className="text-white/40">(demo)</span>
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-white" href="/demo/westbrook">
                Westbrook University <span className="text-white/40">(demo)</span>
              </Link>
            </li>
            <li className="pt-2 border-t border-white/10">
              <a className="font-semibold text-white/90 transition-colors hover:text-white" href="#colleges">
                All colleges →
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
            Contact
          </h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a href="mailto:help.yuvaa@gmail.com" className="transition-colors hover:text-white">
                help.yuvaa@gmail.com
              </a>
            </li>
            <li>
              <a href="#cta" className="transition-colors hover:text-white">
                Book a 15-minute setup call
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm lg:flex-row lg:px-8">
          <p>© 2026 4 the people. Built for the people who run the parties.</p>
          <p>Made with ♥ for student orgs everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
