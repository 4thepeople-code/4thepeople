"use client";

import { useState, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";

const ROLE_TABS = [
  {
    id: "student",
    title: "Student",
    jobLine: "Find events. Skip the WhatsApp hunt.",
    badgeColor: "bg-indigo-50 text-brand-600 border-indigo-200/60",
    accentBorder: "border-brand-600",
    accentShadow: "shadow-[0_12px_28px_-6px_rgba(79,70,232,0.22)]",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "manager",
    title: "Club manager",
    jobLine: "Fill seats. Know who's coming.",
    badgeColor: "bg-orange-50 text-orange-600 border-orange-200/60",
    accentBorder: "border-[#ff4a3d]",
    accentShadow: "shadow-[0_12px_28px_-6px_rgba(255,74,61,0.22)]",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
        <circle cx="19" cy="9" r="1" fill="currentColor" />
        <path d="M16 19h3" />
      </svg>
    ),
  },
  {
    id: "admin",
    title: "College admin",
    jobLine: "See every club. Stay in control.",
    badgeColor: "bg-violet-50 text-violet-600 border-violet-200/60",
    accentBorder: "border-violet-600",
    accentShadow: "shadow-[0_12px_28px_-6px_rgba(124,58,237,0.22)]",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

const PANELS: Record<
  string,
  {
    headingBefore: string;
    accent: string;
    headingAfter: string;
    bullets: string[];
  }
> = {
  student: {
    headingBefore: "Find your next ",
    accent: "event",
    headingAfter: ".",
    bullets: [
      "Browse the events your campus clubs are running.",
      "Register with Google or email, then verify against your college.",
      "Get a QR ticket you can show at the door.",
      "See who's attending before you go.",
    ],
  },
  manager: {
    headingBefore: "Run events without the ",
    accent: "chaos",
    headingAfter: ".",
    bullets: [
      "Create events with seat limits in seconds.",
      "Watch seats fill up live.",
      "Check people in with QR codes.",
      "Get RSVPs in one place, not five.",
    ],
  },
  admin: {
    headingBefore: "Run your campus from one ",
    accent: "dashboard",
    headingAfter: ".",
    bullets: [
      "Create a club space for every club on your campus.",
      "Invite managers and assign them to the clubs they run.",
      "Control what each role can do.",
      "Keep each college's data separate.",
    ],
  },
};

function Check() {
  return (
    <svg
      className="mt-1 h-5 w-5 shrink-0 text-brand-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MiniQRCode() {
  return (
    <svg viewBox="0 0 60 60" className="h-24 w-24" fill="currentColor" aria-hidden="true">
      <rect width="60" height="60" fill="#ffffff" />
      {/* Corner blocks */}
      <rect x="4" y="4" width="16" height="16" fill="#070b18" rx="1" />
      <rect x="7" y="7" width="10" height="10" fill="#ffffff" />
      <rect x="9" y="9" width="6" height="6" fill="#070b18" />

      <rect x="40" y="4" width="16" height="16" fill="#070b18" rx="1" />
      <rect x="43" y="7" width="10" height="10" fill="#ffffff" />
      <rect x="45" y="9" width="6" height="6" fill="#070b18" />

      <rect x="4" y="40" width="16" height="16" fill="#070b18" rx="1" />
      <rect x="7" y="43" width="10" height="10" fill="#ffffff" />
      <rect x="9" y="45" width="6" height="6" fill="#070b18" />

      {/* Internal modules */}
      <rect x="24" y="6" width="3" height="3" fill="#070b18" />
      <rect x="30" y="6" width="3" height="3" fill="#070b18" />
      <rect x="24" y="12" width="6" height="3" fill="#070b18" />
      <rect x="33" y="12" width="3" height="6" fill="#070b18" />
      <rect x="6" y="24" width="3" height="3" fill="#070b18" />
      <rect x="12" y="24" width="3" height="3" fill="#070b18" />
      <rect x="24" y="24" width="6" height="6" fill="#070b18" />
      <rect x="34" y="24" width="6" height="3" fill="#070b18" />
      <rect x="44" y="24" width="3" height="6" fill="#070b18" />
      <rect x="52" y="24" width="4" height="4" fill="#070b18" />
      <rect x="24" y="34" width="4" height="6" fill="#070b18" />
      <rect x="32" y="32" width="6" height="4" fill="#070b18" />
      <rect x="42" y="34" width="6" height="4" fill="#070b18" />
      <rect x="50" y="32" width="6" height="6" fill="#070b18" />
      <rect x="24" y="44" width="6" height="4" fill="#070b18" />
      <rect x="34" y="42" width="4" height="6" fill="#070b18" />
      <rect x="42" y="44" width="6" height="6" fill="#070b18" />
      <rect x="52" y="42" width="4" height="8" fill="#070b18" />
    </svg>
  );
}

/* 1. Student Realistic Mini UI: Phone frame with event feed + QR ticket */
function StudentPhoneMini() {
  return (
    <div className="mx-auto w-full max-w-[340px] h-[500px] rounded-[38px] border-4 border-ink-900/80 bg-ink-950 p-2.5 shadow-2xl flex flex-col">
      <div className="relative flex flex-col flex-1 overflow-hidden rounded-[30px] border border-slate-200/60 bg-slate-50 p-4">
        {/* Dynamic Island / Notch */}
        <div className="mx-auto mb-2 h-4 w-24 rounded-full bg-ink-950 shrink-0" aria-hidden />

        {/* Status Row */}
        <div className="flex items-center justify-between px-1 text-xs font-semibold text-ink-900/60 shrink-0">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold">5G</span>
            <div className="h-2 w-4 rounded-sm border border-current p-0.5">
              <div className="h-full w-full bg-current rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Mini App Header */}
        <div className="mt-2.5 flex items-center justify-between border-b border-ink-900/5 pb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <BrandLogo size="sm" variant="dark" />
          </div>
          <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-900/60">
            Sample
          </span>
        </div>

        {/* Mini Event Feed Item */}
        <div className="mt-3 rounded-2xl border border-ink-900/10 bg-white p-3.5 shadow-xs shrink-0">
          <div className="flex items-center justify-between">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
              Music Club
            </span>
            <span className="text-[11px] font-bold text-emerald-600">● RSVP Open</span>
          </div>
          <p className="mt-1.5 font-display text-sm font-bold text-ink-950">
            Midnight Melody: Fall Concert
          </p>
          <p className="text-xs text-ink-900/70">
            Sat · Nov 21 · 7:30 PM · Amphitheatre
          </p>
        </div>

        {/* Mini QR Ticket Card */}
        <div className="mt-3 flex-1 flex flex-col justify-between rounded-2xl border border-brand-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-600">
              Admit One
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              You&apos;re registered ✓
            </span>
          </div>

          <div className="my-auto flex items-center gap-3 py-1">
            <div className="rounded-xl border border-ink-900/10 bg-white p-1.5 shadow-xs shrink-0">
              <MiniQRCode />
            </div>
            <div className="flex-1 min-w-0 text-xs text-ink-900/75">
              <p className="font-semibold text-ink-950 text-sm">Priya S. (Year 2)</p>
              <p className="mt-0.5 text-xs text-ink-900/60">Seat Tier: General</p>
              <p className="mt-2 text-xs font-semibold text-brand-600">Show QR at entry gate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 2. Club Manager Realistic Mini UI: Dashboard card with a seat bar, short registrant list, and "Scan QR" button */
function ManagerDashboardMini() {
  const [scanned, setScanned] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-3xl border border-ink-900/10 bg-white p-6 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
            Robotics Club · Sample
          </span>
          <h4 className="mt-0.5 font-display text-lg font-bold text-ink-950">
            RoboRush &apos;26: Live Check-in
          </h4>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live session
        </span>
      </div>

      {/* Seat Bar */}
      <div className="mt-5 rounded-2xl bg-[#faf7f2] p-4 border border-ink-900/5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-ink-950">148 / 200 seats filled</span>
          <span className="font-semibold text-ink-900/60">74% Capacity</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-600" style={{ width: "74%" }} />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-900/60 font-medium">
          <span>148 registered</span>
          <span>112 checked in</span>
          <span>52 seats left</span>
        </div>
      </div>

      {/* Short Registrant List */}
      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
          Recent Registrants (Sample)
        </p>
        <ul className="mt-2 divide-y divide-ink-900/5 text-xs">
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Aarav Patel</p>
              <p className="text-[11px] text-ink-900/60">CSE · Year 3</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              Checked in 7:15 PM
            </span>
          </li>
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Sneha Rao</p>
              <p className="text-[11px] text-ink-900/60">ECE · Year 2</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              Checked in 7:22 PM
            </span>
          </li>
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Karthik Verma</p>
              <p className="text-[11px] text-ink-900/60">IT · Year 3</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
              Registered
            </span>
          </li>
        </ul>
      </div>

      {/* Sentence-case Button with Verb + Object label */}
      <button
        type="button"
        onClick={() => setScanned(true)}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer shadow-xs"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h.01" />
          <path d="M17 7h.01" />
          <path d="M7 17h.01" />
          <path d="M17 17h.01" />
          <path d="M7 12h10" />
        </svg>
        {scanned ? "QR scanner ready" : "Scan QR ticket"}
      </button>
    </div>
  );
}

/* 3. College Admin Realistic Mini UI: Console card with manager invites and clubs list */
function AdminConsoleMini() {
  const [inviteSent, setInviteSent] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-3xl border border-ink-900/10 bg-white p-6 shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-ink-900/5 pb-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Console · Sample
          </span>
          <h4 className="mt-0.5 font-display text-lg font-bold text-ink-950">
            Campus Administration
          </h4>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-900/70">
          LBRCE Campus
        </span>
      </div>

      {/* Manager Invites Section */}
      <div className="mt-4">
        <label htmlFor="admin-manager-email" className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
          Invite club manager
        </label>
        <div className="mt-2 flex flex-col gap-2 w-full">
          <input
            id="admin-manager-email"
            type="email"
            placeholder="lead@college.edu"
            aria-label="Manager email"
            className="h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3.5 text-xs sm:text-sm text-ink-950 placeholder:text-ink-900/40 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
          />
          <button
            type="button"
            onClick={() => setInviteSent(true)}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-brand-500 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Send manager invite
          </button>
        </div>

        {inviteSent && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-brand-600">
            <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Invite sent — pending manager acceptance
          </p>
        )}
      </div>

      {/* Clubs List */}
      <div className="mt-5 border-t border-ink-900/5 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
            Managed Clubs (Sample)
          </p>
          <span className="text-[11px] font-semibold text-brand-600">3 active spaces</span>
        </div>

        <ul className="mt-2 divide-y divide-ink-900/5 text-xs">
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Robotics & AI Club</p>
              <p className="text-[11px] text-ink-900/60">4 managers · 18 events</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Active
            </span>
          </li>
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Music & Acoustic Society</p>
              <p className="text-[11px] text-ink-900/60">2 managers · 8 events</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Active
            </span>
          </li>
          <li className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-ink-950">Debate & Literary Forum</p>
              <p className="text-[11px] text-ink-900/60">3 managers · 12 events</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Active
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function AudienceSwitcher() {
  const [active, setActive] = useState("student");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = ROLE_TABS.findIndex((t) => t.id === active);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % ROLE_TABS.length;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + ROLE_TABS.length) % ROLE_TABS.length;
    }
    if (nextIndex === -1) return;
    e.preventDefault();
    setActive(ROLE_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const panel = PANELS[active];

  return (
    <section
      aria-labelledby="audience-heading"
      className="scroll-mt-24 bg-[#faf7f2] px-6 py-24 lg:py-32"
    >
      {/* 160ms crossfade animation without layout jump */}
      <style jsx>{`
        @keyframes roleCrossfadeAnim {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .role-crossfade {
          animation: roleCrossfadeAnim 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .role-crossfade {
            animation: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Three roles</p>
          <h2 id="audience-heading" className="mt-5 font-display text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            One platform. Three <em className="italic font-bold text-brand-600">roles</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-900/70">
            Admins, club managers and students each get a setup that fits how they work.
          </p>
        </header>

        {/* Two-column layout at lg and up, single column stacked below lg */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-10 lg:gap-14 items-center">
          {/* Left Column: Role cards row + Capabilities card sharing a single width */}
          <div className="flex flex-col gap-6 w-full">
            {/* Role Cards acting as Tab Selectors (role=tablist, arrow-key navigation, aria-selected) */}
            <div
              role="tablist"
              aria-label="Campus roles"
              className="w-full"
            >
              {/* Mobile: horizontal scroll */}
              <div className="flex gap-4 overflow-x-auto scrollbar-hide md:hidden">
                {ROLE_TABS.map((t, i) => {
                  const isSelected = t.id === active;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`audience-tab-${t.id}`}
                      aria-selected={isSelected}
                      aria-controls={`audience-panel-${t.id}`}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={onTabKeyDown}
                      onClick={() => {
                        setActive(t.id);
                      }}
                      className={`shrink-0 group relative flex flex-col items-start rounded-2xl p-5 min-w-[200px] text-left transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? `bg-white border-2 ${t.accentBorder} ${t.accentShadow}`
                          : "bg-white border border-ink-900/10 shadow-xs hover:border-ink-900/25 hover:shadow-sm"
                      }`}
                    >
                      <div className={`grid h-12 w-12 place-items-center rounded-xl border ${t.badgeColor}`}>
                        {t.icon}
                      </div>
                      <h3 className="mt-4 font-display text-lg font-bold text-ink-950">
                        {t.title}
                      </h3>
                      <p className="mt-1 text-sm text-ink-900/70">
                        {t.jobLine}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Desktop: plain 3-column grid with equal height cards and compact padding */}
              <div className="hidden md:grid grid-cols-3 gap-4 w-full items-stretch">
                {ROLE_TABS.map((t, i) => {
                  const isSelected = t.id === active;
                  return (
                    <button
                      key={`grid-${t.id}`}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`audience-tab-desktop-${t.id}`}
                      aria-selected={isSelected}
                      aria-controls={`audience-panel-${t.id}`}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={onTabKeyDown}
                      onClick={() => {
                        setActive(t.id);
                      }}
                      className={`h-full group relative flex flex-col items-start rounded-2xl p-4 lg:p-5 text-left transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? `bg-white border-2 ${t.accentBorder} ${t.accentShadow}`
                          : "bg-white border border-ink-900/10 shadow-xs hover:border-ink-900/25 hover:shadow-sm"
                      }`}
                    >
                      <div className={`grid h-10 w-10 place-items-center rounded-xl border ${t.badgeColor}`}>
                        {t.icon}
                      </div>
                      <h3 className="mt-3 font-display text-base lg:text-lg font-bold text-ink-950">
                        {t.title}
                      </h3>
                      <p className="mt-1 text-xs lg:text-sm text-ink-900/70">
                        {t.jobLine}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capabilities Card with <200ms crossfade and min-height to prevent layout jump */}
            <div
              id={`audience-panel-${active}`}
              role="tabpanel"
              aria-labelledby={`audience-tab-${active}`}
              key={`panel-${active}`}
              className="role-crossfade rounded-3xl border border-ink-900/10 bg-white p-6 lg:p-7 shadow-sm w-full min-h-[350px] md:min-h-[320px] lg:min-h-[340px]"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Key capabilities · {ROLE_TABS.find((t) => t.id === active)?.title}
              </span>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-ink-950">
                {panel.headingBefore}
                <em className="italic font-bold text-brand-600">{panel.accent}</em>
                {panel.headingAfter}
              </h3>
              <ul className="mt-6 space-y-4">
                {panel.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <Check />
                    <p className="text-[15px] leading-relaxed text-ink-900/80">{b}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Visual Mockup Per Role */}
          <div
            key={`visual-${active}`}
            className="role-crossfade flex items-center justify-center w-full min-h-[500px] mt-8 lg:mt-0"
          >
            {active === "student" && <StudentPhoneMini />}
            {active === "manager" && <ManagerDashboardMini />}
            {active === "admin" && <AdminConsoleMini />}
          </div>
        </div>
      </div>
    </section>
  );
}
