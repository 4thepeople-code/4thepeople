"use client";

import Link from "next/link";
import { useState } from "react";
import { colleges } from "@/lib/landing/data";

type RegState = "idle" | "loading" | "registered" | "error";

const CATEGORY_STYLES: Record<string, { bg: string; dot: string }> = {
  Tech: { bg: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  Cultural: { bg: "border-coral-200 bg-coral-50 text-coral-700", dot: "bg-coral-500" },
  Sports: { bg: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Tech: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
  Cultural: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 60%, #ff4a3d 100%)",
  Sports: "linear-gradient(135deg, #064e3b 0%, #047857 60%, #22c55e 100%)",
};

const categoryForEvent = (title: string): "Tech" | "Cultural" | "Sports" => {
  const t = title.toLowerCase();
  if (t.includes("bot") || t.includes("hack") || t.includes("makers") || t.includes("synth") || t.includes("circuit") || t.includes("game")) return "Tech";
  if (t.includes("concert") || t.includes("dance") || t.includes("jam") || t.includes("slam") || t.includes("theatre") || t.includes("poetry") || t.includes("beat")) return "Cultural";
  return "Sports";
};

// Defined capacities for demo events to ensure valid seat limits (seatsLeft === 0 for waitlist events)
const DEMO_CAPACITIES: Record<string, { capacity: number; attendees: number }> = {
  "northwood-e1": { capacity: 200, attendees: 186 }, // 14 seats left -> Register
  "northwood-e2": { capacity: 342, attendees: 342 }, // 0 seats left -> Join waitlist
  "northwood-e3": { capacity: 100, attendees: 74 },  // 26 seats left -> Register
  "northwood-e4": { capacity: 300, attendees: 298 }, // 2 seats left -> Register

  "crestview-e1": { capacity: 210, attendees: 210 }, // 0 seats left -> Join waitlist
  "crestview-e2": { capacity: 200, attendees: 188 }, // 12 seats left -> Register
  "crestview-e3": { capacity: 60, attendees: 52 },   // 8 seats left -> Register
  "crestview-e4": { capacity: 150, attendees: 133 }, // 17 seats left -> Register

  "bellavista-e1": { capacity: 100, attendees: 96 }, // 4 seats left -> Register
  "bellavista-e2": { capacity: 50, attendees: 44 },   // 6 seats left -> Register
  "bellavista-e3": { capacity: 200, attendees: 176 }, // 24 seats left -> Register
  "bellavista-e4": { capacity: 88, attendees: 88 },   // 0 seats left -> Join waitlist

  "westbrook-e1": { capacity: 450, attendees: 421 }, // 29 seats left -> Register
  "westbrook-e2": { capacity: 80, attendees: 73 },   // 7 seats left -> Register
  "westbrook-e3": { capacity: 40, attendees: 34 },   // 6 seats left -> Register
  "westbrook-e4": { capacity: 58, attendees: 58 },   // 0 seats left -> Join waitlist
};

// Demo colleges only; if LBRCE has no real events, LBRCE has no cards in this feed
const demoColleges = colleges.filter((c) => c.status === "demo" && c.slug !== "lbrce");

const allUpcomingEvents = demoColleges.flatMap((c) =>
  c.events
    .filter((e) => e.status === "upcoming")
    .map((e) => {
      const key = `${c.slug}-${e.id}`;
      const capData = DEMO_CAPACITIES[key] || { capacity: 200, attendees: e.attendees };
      const seatsLeft = Math.max(0, capData.capacity - capData.attendees);
      return {
        ...e,
        college: c,
        capacity: capData.capacity,
        attendees: capData.attendees,
        seatsLeft,
      };
    })
);

// Curated 6 initial events showcasing all demo colleges (Northwood, Crestview, Bellavista, Westbrook)
const curatedSixIds = [
  "northwood-e1", // 14 seats left -> Register
  "crestview-e1", // 0 seats left -> Join waitlist
  "bellavista-e1", // 4 seats left -> Register
  "westbrook-e1", // 29 seats left -> Register
  "northwood-e2", // 0 seats left -> Join waitlist
  "crestview-e2", // 12 seats left -> Register
];

const curatedSixEvents = curatedSixIds
  .map((key) => {
    const [cSlug, eId] = key.split("-");
    const found = allUpcomingEvents.find((e) => e.college.slug === cSlug && e.id === eId);
    return found;
  })
  .filter((e): e is (typeof allUpcomingEvents)[number] => Boolean(e));

function EventCard({
  event,
}: {
  event: (typeof allUpcomingEvents)[number];
}) {
  const [regState, setRegState] = useState<RegState>("idle");
  const [waitlist, setWaitlist] = useState(false);

  const category = categoryForEvent(event.title);
  const styles = CATEGORY_STYLES[category];
  const isLbrce = event.college.slug === "lbrce";
  const seatsLeft = event.seatsLeft;
  const isFull = seatsLeft === 0;
  const truncatedTitle =
    event.title.length > 45 ? `${event.title.slice(0, 45)}…` : event.title;

  const handleRegister = async () => {
    setRegState("loading");
    try {
      await new Promise((r) => setTimeout(r, 600));
      setRegState("registered");
    } catch {
      setRegState("error");
    }
  };

  const handleWaitlist = () => {
    setWaitlist(true);
  };

  const handleUndo = () => {
    setRegState("idle");
    setWaitlist(false);
  };

  const handleRetry = () => {
    setRegState("idle");
  };

  return (
    <article
      className="group rounded-3xl border border-ink-900/10 bg-white p-6 shadow-sm transition-all hover:border-brand-600 focus-within:border-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2"
    >
      {/* Demo college chip + small DEMO tag */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            isLbrce
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${isLbrce ? "bg-emerald-600" : "bg-amber-600"}`} />
          {isLbrce ? "LBRCE" : event.college.shortName}
        </span>
        {!isLbrce && (
          <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-100/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            DEMO
          </span>
        )}
      </div>

      {/* Single category chip (Tech / Cultural / Sports only) */}
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          styles.bg
        }`}
        aria-hidden="true"
      >
        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${styles.dot}`} />
        {category}
      </span>

      {/* Gradient poster header */}
      <div className="mt-3 relative overflow-hidden rounded-2xl border border-ink-900/10 p-5 shadow-sm mb-4" style={{ background: CATEGORY_GRADIENTS[category] }}>
        <div aria-hidden="true" className="absolute inset-0 bg-black/25 pointer-events-none" />
        <div className="relative z-10">
          <h3
            className="mt-1 font-campus text-xl font-bold leading-tight tracking-wide text-white line-clamp-2"
            style={{ WebkitLineClamp: 2, WebkitBoxOrient: "vertical", display: "-webkit-box", overflow: "hidden" }}
            aria-label={event.title}
          >
            {truncatedTitle}
          </h3>
          <p className="mt-1 text-xs font-semibold text-white/95">
            {event.weekday} · {event.month} {event.day} · {event.time}
          </p>
        </div>
      </div>

      {/* Meta text (location, seats left): 13px, text colour at least 4.5:1 on white */}
      <div className="flex items-center justify-between mb-3 text-[13px]">
        <p className="font-medium text-slate-700">{event.location}</p>
        <span className={`font-semibold ${seatsLeft === 0 ? "text-brand-600" : "text-slate-700"}`}>
          {seatsLeft === 0 ? "0 seats left" : `${seatsLeft} seats left`}
        </span>
      </div>

      {/* Seat bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-3">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${Math.min((event.attendees / event.capacity) * 100, 100)}%` }}
        />
      </div>

      {/* Register / Waitlist button state machine */}
      <div className="flex flex-col gap-2">
        {waitlist ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
              Joined waitlist
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="text-xs font-semibold text-slate-600 hover:text-brand-600 underline underline-offset-4 cursor-pointer"
            >
              Undo
            </button>
          </div>
        ) : regState === "idle" ? (
          isFull ? (
            <button
              type="button"
              onClick={handleWaitlist}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-transparent px-4 text-xs sm:text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 cursor-pointer"
            >
              Join waitlist
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
            >
              Register
            </button>
          )
        ) : regState === "loading" ? (
          <button type="button" disabled className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold bg-slate-100 text-slate-500 cursor-not-allowed">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.071-6.071 9 9 0 0 1 6.071 6.071" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Registering…
          </button>
        ) : regState === "registered" ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Registered
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="text-xs font-semibold text-slate-600 hover:text-brand-600 underline underline-offset-4 cursor-pointer"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700">
              Error
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="text-xs font-semibold text-brand-600 underline underline-offset-4 hover:text-brand-700 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function LiveFeed() {
  const [activeCategory, setActiveCategory] = useState("All");

  const visibleEvents =
    activeCategory === "All"
      ? curatedSixEvents
      : allUpcomingEvents
          .filter((e) => categoryForEvent(e.title) === activeCategory)
          .slice(0, 6);

  return (
    <section
      id="live-feed"
      aria-labelledby="live-feed-heading"
      className="scroll-mt-24 bg-mist px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Demo data
          </p>
          <h2 id="live-feed-heading" className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
            Events happening <em className="italic font-bold text-brand-600">on campus</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Upcoming club events from demo colleges. All data shown is sample.
          </p>
        </div>

        {/* Filter chips (All / Tech / Cultural / Sports, aria-pressed) above grid */}
        <div className="mt-10 flex flex-wrap gap-2">
          {["All", "Tech", "Cultural", "Sports"].map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "bg-brand-600 text-white shadow-xs"
                  : "border border-ink-900/10 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Event grid: 6 cards */}
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((e) => (
            <EventCard key={`${e.college.slug}-${e.id}`} event={e} />
          ))}
        </div>

        {/* See all events link */}
        <div className="mt-12 text-center">
          <Link
            href="#live-feed"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            See all events <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
