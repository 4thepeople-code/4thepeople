"use client";

import { useRef } from "react";
import Link from "next/link";
import { useCollegeEvents } from "@/lib/landing/queries";
import { getClub, type CampusEvent, type College } from "@/lib/landing/data";

function EventCard({ e, college }: { e: CampusEvent; college: College }) {
  const club = getClub(college, e.clubId);

  return (
    <Link
      href={`/demo/${college.slug}/events/${e.id}`}
      className="snap-start shrink-0 w-[85%] max-w-sm block group"
    >
      <article className="h-full rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] transition-all group-hover:-translate-x-1 group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: e.status === "live" ? "#ff4a3d" : "#241209" }}
          >
            {e.status === "live" ? "● Live now" : e.status}
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-wide text-ink-900/40">{e.weekday}</span>
        </div>

        <div className="mt-5 flex items-end gap-3">
          <span className="font-display text-6xl font-bold leading-none text-warm-ink">{e.day}</span>
          <span className="pb-1 font-display text-xl font-bold uppercase text-ink-900">{e.month}</span>
        </div>

        <h3 className="mt-5 font-display text-2xl font-bold uppercase tracking-tight text-warm-ink group-hover:text-coral transition-colors">{e.title}</h3>
        <p className="mt-2 text-sm font-medium text-ink-900/55">{club?.name} · {club?.category}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-900/70">{e.description}</p>

        <div className="mt-6 grid gap-2 rounded-2xl bg-cream p-4 text-sm font-medium text-ink-900">
          <p>Starts · {e.time}</p>
          <p>Where · {e.location}</p>
          <p>Attending · {e.attendees} students</p>
        </div>
      </article>
    </Link>
  );
}

export default function EventsCarousel({ college }: { college: College }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: events, isLoading } = useCollegeEvents(college.slug);

  const scrollBy = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 680, behavior: "smooth" });
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: college.accent }}>
            The lineup
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-warm-ink sm:text-5xl">
            Events we&apos;re obsessed with
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll events left"
            className="grid h-12 w-12 place-items-center rounded-full border-2 border-warm-ink bg-white transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll events right"
            className="grid h-12 w-12 place-items-center rounded-full border-2 border-warm-ink bg-white transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading && <p className="py-10 text-ink-900/60">Loading the vibe…</p>}
        {events?.map((e) => <EventCard key={e.id} e={e} college={college} />)}
      </div>
    </div>
  );
}

