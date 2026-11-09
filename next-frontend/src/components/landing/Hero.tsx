"use client";

import Link from "next/link";
import { LIVE_COLLEGE } from "@/lib/landing/constants";
import Search from "./Search";
import HeroArt from "./HeroArt";

function RealisticQRCode({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-label="Event ticket QR code (Sample)"
      role="img"
    >
      <rect width="100" height="100" fill="#ffffff" />
      {/* Top-Left Finder */}
      <rect x="8" y="8" width="28" height="28" fill="#070b18" rx="2" />
      <rect x="12" y="12" width="20" height="20" fill="#ffffff" rx="1" />
      <rect x="16" y="16" width="12" height="12" fill="#070b18" rx="1" />

      {/* Top-Right Finder */}
      <rect x="64" y="8" width="28" height="28" fill="#070b18" rx="2" />
      <rect x="68" y="12" width="20" height="20" fill="#ffffff" rx="1" />
      <rect x="72" y="16" width="12" height="12" fill="#070b18" rx="1" />

      {/* Bottom-Left Finder */}
      <rect x="8" y="64" width="28" height="28" fill="#070b18" rx="2" />
      <rect x="12" y="68" width="20" height="20" fill="#ffffff" rx="1" />
      <rect x="16" y="72" width="12" height="12" fill="#070b18" rx="1" />

      {/* Alignment Pattern */}
      <rect x="66" y="66" width="18" height="18" fill="#070b18" rx="1" />
      <rect x="70" y="70" width="10" height="10" fill="#ffffff" />
      <rect x="74" y="74" width="2" height="2" fill="#070b18" />

      {/* Timing Patterns */}
      <rect x="38" y="18" width="4" height="4" fill="#070b18" />
      <rect x="46" y="18" width="4" height="4" fill="#070b18" />
      <rect x="54" y="18" width="4" height="4" fill="#070b18" />
      <rect x="18" y="38" width="4" height="4" fill="#070b18" />
      <rect x="18" y="46" width="4" height="4" fill="#070b18" />
      <rect x="18" y="54" width="4" height="4" fill="#070b18" />

      {/* Random Data Pattern Dots */}
      <rect x="38" y="26" width="4" height="8" fill="#070b18" />
      <rect x="46" y="26" width="8" height="4" fill="#070b18" />
      <rect x="42" y="36" width="6" height="6" fill="#070b18" />
      <rect x="52" y="36" width="8" height="4" fill="#070b18" />
      <rect x="38" y="46" width="4" height="12" fill="#070b18" />
      <rect x="46" y="46" width="12" height="4" fill="#070b18" />
      <rect x="48" y="54" width="6" height="8" fill="#070b18" />
      <rect x="58" y="52" width="4" height="10" fill="#070b18" />
      <rect x="66" y="42" width="10" height="4" fill="#070b18" />
      <rect x="80" y="40" width="8" height="6" fill="#070b18" />
      <rect x="74" y="50" width="6" height="8" fill="#070b18" />
      <rect x="84" y="52" width="6" height="4" fill="#070b18" />
      <rect x="86" y="60" width="4" height="10" fill="#070b18" />
      <rect x="82" y="74" width="8" height="6" fill="#070b18" />
      <rect x="66" y="86" width="10" height="4" fill="#070b18" />
      <rect x="80" y="84" width="8" height="6" fill="#070b18" />
      <rect x="28" y="38" width="6" height="6" fill="#070b18" />
      <rect x="28" y="50" width="6" height="8" fill="#070b18" />
      <rect x="38" y="64" width="6" height="8" fill="#070b18" />
      <rect x="48" y="66" width="10" height="4" fill="#070b18" />
      <rect x="38" y="76" width="8" height="6" fill="#070b18" />
      <rect x="50" y="74" width="8" height="6" fill="#070b18" />
      <rect x="42" y="86" width="12" height="4" fill="#070b18" />
      <rect x="58" y="84" width="4" height="8" fill="#070b18" />
      <rect x="8" y="42" width="4" height="6" fill="#070b18" />
      <rect x="8" y="52" width="6" height="4" fill="#070b18" />
      <rect x="88" y="8" width="4" height="10" fill="#070b18" />
      <rect x="88" y="22" width="4" height="12" fill="#070b18" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      {/* Micro-story CSS styling with paused on hover/focus and prefers-reduced-motion fallback */}
      <style jsx>{`
        @keyframes registerTapAnim {
          0%,
          15% {
            transform: scale(1);
          }
          18% {
            transform: scale(0.94);
          }
          22%,
          93% {
            transform: scale(1);
          }
          97%,
          100% {
            transform: scale(1);
          }
        }

        @keyframes registerBtnText {
          0%,
          19% {
            opacity: 1;
            transform: translateY(0);
          }
          21%,
          94% {
            opacity: 0;
            transform: translateY(-8px);
          }
          97%,
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes registeredBtnText {
          0%,
          19% {
            opacity: 0;
            transform: translateY(8px);
          }
          22%,
          94% {
            opacity: 1;
            transform: translateY(0);
          }
          97%,
          100% {
            opacity: 0;
            transform: translateY(8px);
          }
        }

        @keyframes registerBtnBg {
          0%,
          19% {
            background-color: #4f46e8;
          }
          22%,
          94% {
            background-color: #059669;
          }
          97%,
          100% {
            background-color: #4f46e8;
          }
        }

        @keyframes count148Anim {
          0%,
          28% {
            opacity: 1;
            transform: translateY(0);
          }
          33%,
          94% {
            opacity: 0;
            transform: translateY(-100%);
          }
          97%,
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes count149Anim {
          0%,
          28% {
            opacity: 0;
            transform: translateY(100%);
          }
          33%,
          94% {
            opacity: 1;
            transform: translateY(0);
          }
          97%,
          100% {
            opacity: 0;
            transform: translateY(100%);
          }
        }

        @keyframes progressBarAnim {
          0%,
          28% {
            width: 74%;
          }
          34%,
          94% {
            width: 74.5%;
          }
          97%,
          100% {
            width: 74%;
          }
        }

        @keyframes qrFadeAnim {
          0%,
          42% {
            opacity: 0.22;
            filter: blur(1.5px);
          }
          48%,
          94% {
            opacity: 1;
            filter: blur(0);
          }
          97%,
          100% {
            opacity: 0.22;
            filter: blur(1.5px);
          }
        }

        @keyframes checkedChipPop {
          0%,
          65% {
            opacity: 0;
            transform: scale(0.65) translateY(8px);
            pointer-events: none;
          }
          69% {
            opacity: 1;
            transform: scale(1.12) translateY(0);
          }
          73%,
          94% {
            opacity: 1;
            transform: scale(1.12) translateY(0);
          }
          73%,
          94% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          97%,
          100% {
            opacity: 0;
            transform: scale(0.8) translateY(4px);
          }
        }

        .micro-story-root:hover *,
        .micro-story-root:focus-within * {
          animation-play-state: paused !important;
        }

        .anim-btn-tap {
          animation: registerTapAnim 6s ease-in-out infinite;
        }
        .anim-btn-bg {
          animation: registerBtnBg 6s ease-in-out infinite;
        }
        .anim-btn-text-init {
          animation: registerBtnText 6s ease-in-out infinite;
        }
        .anim-btn-text-final {
          animation: registeredBtnText 6s ease-in-out infinite;
        }
        .anim-count-148 {
          animation: count148Anim 6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        .anim-count-149 {
          animation: count149Anim 6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        .anim-progress {
          animation: progressBarAnim 6s ease-in-out infinite;
        }
        .anim-qr {
          animation: qrFadeAnim 6s ease-in-out infinite;
        }
        .anim-checked-chip {
          animation: checkedChipPop 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-btn-tap,
          .anim-btn-bg,
          .anim-btn-text-init,
          .anim-btn-text-final,
          .anim-count-148,
          .anim-count-149,
          .anim-progress,
          .anim-qr,
          .anim-checked-chip {
            animation: none !important;
          }
          .anim-btn-bg {
            background-color: #059669 !important;
          }
          .anim-btn-text-init {
            display: none !important;
          }
          .anim-btn-text-final {
            opacity: 1 !important;
            transform: none !important;
          }
          .anim-count-148 {
            display: none !important;
          }
          .anim-count-149 {
            opacity: 1 !important;
            transform: none !important;
          }
          .anim-progress {
            width: 74.5% !important;
          }
          .anim-qr {
            opacity: 1 !important;
            filter: none !important;
          }
          .anim-checked-chip {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
      <div aria-hidden className="absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[130px]" />
      <div aria-hidden className="absolute -bottom-40 right-0 h-[420px] w-[560px] rounded-full bg-coral/10 blur-[110px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pt-8 sm:pt-10 md:pt-14 lg:pt-16 pb-16 lg:pb-20 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Now live at {LIVE_COLLEGE}
          </p>

          <h1 className="mt-5 font-display font-bold leading-[0.98] tracking-[-0.03em] text-[var(--ink)] sm:text-[52px] lg:text-[64px]">
            Every club event on your campus.{" "}
            <span className="italic font-bold text-brand-600">One place.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-900/75">
            Browse events, register in one tap, show a QR at the door. Clubs run it all from one dashboard.
          </p>

          {/* Merged Search bar with inside "Find your college" button + secondary "List your campus" link */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 max-w-xl">
            <div className="flex-1 min-w-0">
              <Search id="college-search" buttonLabel="Find your college" />
            </div>
            <Link
              href="#cta"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900/75 hover:text-brand-600 transition-colors whitespace-nowrap px-1 py-2 sm:py-0"
            >
              <span>List your campus</span>
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Three honest proof chips with check icons */}
          <div className="mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3" aria-label="Key guarantees">
            {[
              "Free for students",
              "QR tickets",
              "Verified by your college",
            ].map((chip) => (
              <div
                key={chip}
                className="inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-ink-950 shadow-xs backdrop-blur-xs"
              >
                <svg
                  className="h-3.5 w-3.5 text-emerald-600 shrink-0"
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
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] min-w-0 justify-center py-2 lg:justify-end">
          <div
            tabIndex={0}
            role="region"
            aria-label="Interactive event pass demonstration (Sample)"
            className="micro-story-root relative w-full max-w-[370px] outline-none"
          >
            {/* Background layer decorative SVG */}
            <HeroArt className="absolute inset-0 -z-10 h-full w-full pointer-events-none" />

            {/* Main Tilted Ticket Card ("Admit one" style with side notches & perforation) */}
            <div className="relative z-10 w-full rotate-[-3deg] rounded-[28px] border border-ink-900/10 bg-white p-6 shadow-2xl transition-transform duration-300 hover:rotate-0">
              {/* Ticket Header & Admit One Badge */}
              <div className="flex items-center justify-between border-b border-ink-900/5 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
                  Admit One
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900/60">
                  Sample Pass
                </span>
              </div>

              {/* Event details */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
                  Acoustic Society Presents
                </p>
                <h3 className="mt-0.5 font-campus text-3xl font-bold uppercase tracking-wide text-ink-950 sm:text-4xl">
                  Midnight Melody
                </h3>
                <div className="mt-2 flex flex-col gap-0.5 text-xs text-ink-900/70">
                  <p className="font-semibold text-ink-950">Sat · Nov 21 · 7:30 PM</p>
                  <p>Open Air Amphitheatre · Gate B</p>
                </div>
              </div>

              {/* Micro-story step 1: Tap to Register Button */}
              <div className="mt-4">
                <div className="anim-btn-tap relative flex h-10 w-full items-center justify-center overflow-hidden rounded-xl shadow-xs">
                  <div className="anim-btn-bg absolute inset-0 bg-brand-600" />
                  <div className="relative z-10 flex items-center justify-center text-xs font-semibold text-white">
                    <span className="anim-btn-text-init absolute flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                      </svg>
                      Tap to register
                    </span>
                    <span className="anim-btn-text-final absolute flex items-center gap-1.5 whitespace-nowrap opacity-0">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                      Registered
                    </span>
                  </div>
                </div>
              </div>

              {/* Seat meter inside the ticket, directly under the Register button block */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-ink-900/60">
                  <span className="uppercase tracking-wider">Capacity · Sample</span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="relative inline-flex h-5 w-8 overflow-hidden font-display text-base font-bold">
                      <span className="anim-count-148 absolute inset-0 flex items-center">148</span>
                      <span className="anim-count-149 absolute inset-0 flex items-center text-emerald-600">149</span>
                    </span>
                    <span>/ 200 seats</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="anim-progress h-full rounded-full bg-brand-600" style={{ width: "74%" }} />
                </div>
              </div>

              {/* Perforated separator with side notches */}
              <div className="relative my-5 -mx-6 flex items-center justify-between">
                <div
                  aria-hidden
                  className="h-6 w-6 -translate-x-1/2 rounded-full border border-ink-900/10 bg-[var(--bg)]"
                />
                <div className="h-[2px] flex-1 border-t-2 border-dashed border-ink-900/15" />
                <div
                  aria-hidden
                  className="h-6 w-6 translate-x-1/2 rounded-full border border-ink-900/10 bg-[var(--bg)]"
                />
              </div>

              {/* Bottom Stub: Real-looking QR code and "Checked in" pop chip */}
              <div className="relative flex flex-col items-center">
                <div className="anim-qr flex flex-col items-center">
                  <div className="rounded-xl border border-ink-900/10 bg-white p-2 shadow-xs">
                    <RealisticQRCode className="h-28 w-28 sm:h-32 sm:w-32" />
                  </div>
                  <p className="mt-2 font-mono text-[11px] font-semibold tracking-wider text-ink-900/60 uppercase">
                    Pass #CL-88421 · Student QR
                  </p>
                </div>

                <div className="anim-checked-chip absolute -bottom-2 z-30 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white shadow-lg">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  <span>Checked in at door</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

