"use client";

import Link from "next/link";
import { useState } from "react";
import type { College } from "@/lib/landing/data";

const links = [
  { href: "#lineup", label: "Lineup" },
  { href: "#spotlight", label: "Spotlight" },
  { href: "#clubs", label: "Clubs" },
];

export default function CampusNav({ college }: { college: College }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-warm-ink/10 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-white"
            style={{ backgroundColor: college.accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 19V5l14 14V5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold uppercase tracking-wide text-warm-ink">{college.shortName}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-warm-ink/70 transition-colors hover:text-warm-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            href="/#cta"
            className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: college.accent }}
          >
            Start a club
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-warm-ink/15 bg-white md:hidden"
        >
          <span className="flex flex-col gap-1.5">
            <span className={`h-0.5 w-5 bg-warm-ink ${open ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`h-0.5 w-5 bg-warm-ink ${open ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-warm-ink ${open ? "rotate-[-45deg] -translate-y-[7px]" : ""}`} />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-warm-ink/10 bg-cream px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-warm-ink/80">
                {l.label}
              </a>
            ))}
            <Link href="/#cta" onClick={() => setOpen(false)} className="mt-2 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white" style={{ backgroundColor: college.accent }}>
              Start a club
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

