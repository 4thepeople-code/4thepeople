'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '#colleges', label: 'Colleges' },
  { href: '#steps', label: 'How it works' },
  { href: '#live-feed', label: 'Events' },
  { href: '#cta', label: 'Contact' },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 motion-reduce:transition-none ${
        scrolled
          ? 'border-[var(--line)] bg-[var(--bg)]/85 shadow-[0_1px_12px_rgba(7,11,24,0.07)] backdrop-blur-md'
          : 'border-transparent bg-transparent shadow-none backdrop-blur-none'
      }`}
    >
      <div
        className={`mx-auto flex h-16 max-w-7xl items-center justify-between px-6 transition-[padding] duration-200 motion-reduce:transition-none lg:px-8 ${
          scrolled ? 'py-3' : 'py-4'
        }`}
      >
        <Link
          href="/"
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg"
          aria-label="4 the people home"
        >
          <BrandLogo size="md" variant="dark" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-2 text-sm font-medium transition-colors hover:text-[var(--ink)]"
              style={{ color: 'var(--ink-soft)' }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="#cta"
            className="inline-flex h-11 items-center justify-center rounded-xl px-3.5 text-[13px] font-semibold text-white transition-colors sm:px-5 sm:text-sm hover:opacity-95"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            List your campus
          </Link>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid h-11 w-11 place-items-center rounded-xl border md:hidden"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span
                className={`h-0.5 w-5 transition-transform ${
                  mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''
                }`}
                style={{ backgroundColor: 'var(--ink)' }}
              />
              <span
                className={`h-0.5 w-5 transition-opacity ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
                style={{ backgroundColor: 'var(--ink)' }}
              />
              <span
                className={`h-0.5 w-5 transition-transform ${
                  mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''
                }`}
                style={{ backgroundColor: 'var(--ink)' }}
              />
            </span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-t md:hidden"
          style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium"
                style={{ color: 'var(--ink-soft)' }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
