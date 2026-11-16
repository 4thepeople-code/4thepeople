"use client";

import Link from "next/link";
import { LIVE_COLLEGE } from "@/lib/landing/constants";
import Search from "./Search";
import HeroStage from "../HeroStage";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
      <div aria-hidden className="absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[130px]" />
      <div aria-hidden className="absolute -bottom-40 right-0 h-[420px] w-[560px] rounded-full bg-coral/10 blur-[110px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-16 pt-8 sm:pt-10 md:pt-14 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-20 lg:pt-16">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Now live at {LIVE_COLLEGE}
          </p>

          <h1 className="mt-5 font-display text-[42px] font-bold leading-[0.98] tracking-[-0.03em] text-[var(--ink)] sm:text-[52px] lg:text-[64px]">
            Every club event on your campus.{" "}
            <span className="font-bold italic text-brand-600">One place.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-900/75">
            Browse events, register in one tap, show a QR at the door. Clubs
            run it all from one dashboard.
          </p>

          <div className="mt-8 flex max-w-xl flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Search id="college-search" buttonLabel="Find your college" />
            </div>
            <Link
              href="#cta"
              className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 py-2 text-sm font-semibold text-ink-900/75 transition-colors hover:text-brand-600 sm:py-0"
            >
              <span>List your campus</span>
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div
            className="mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3"
            aria-label="Key guarantees"
          >
            {["Free for students", "QR tickets", "Verified by your college"].map(
              (chip) => (
                <div
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-ink-950 shadow-xs backdrop-blur-xs"
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{chip}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mx-auto flex w-full min-w-0 justify-center lg:justify-end">
          <HeroStage />
        </div>
      </div>
    </section>
  );
}
