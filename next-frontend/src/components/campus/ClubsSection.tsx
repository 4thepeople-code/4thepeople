"use client";

import Link from "next/link";
import { useCollegeClubs } from "@/lib/landing/queries";
import { getCollege, type Club } from "@/lib/landing/data";

function ClubCard({ club, collegeId }: { club: Club; collegeId: string }) {
  return (
    <Link
      href={`/demo/${collegeId}/clubs/${club.id}`}
      className="block group"
    >
      <article className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] transition-all hover:-translate-x-1 hover:-translate-y-1">
        <div className="aspect-[4/3] rounded-2xl border border-warm-ink/10 grid place-items-center" style={{ backgroundColor: club.color }}>
          <span className="font-display text-6xl font-bold text-white/90">{club.name.charAt(0)}</span>
        </div>
        <div className="mt-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-warm-ink group-hover:text-coral transition-colors">{club.name}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: club.color }}>
              {club.category}
            </p>
          </div>
          <span className="shrink-0 rounded-full border-2 border-warm-ink px-3 py-1 text-xs font-bold text-warm-ink">
            {club.members} members
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-ink-900/60">{club.tagline}</p>
      </article>
    </Link>
  );
}

export default function ClubsSection({ collegeId }: { collegeId: string }) {
  const { data: clubs, isLoading } = useCollegeClubs(collegeId);
  const college = getCollege(collegeId);

  return (
    <section id="clubs" className="bg-cream px-6 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: college?.accent }}>
              The clubhouse
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-warm-ink sm:text-5xl">
              Meet the clubs
            </h2>
          </div>
          <p className="max-w-md text-ink-900/60">
            Every registered student club on {college?.name}. Pick one. Show up. Belong.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && <p className="text-ink-900/60">Loading the clubhouse…</p>}
          {clubs?.map((c) => <ClubCard key={c.id} club={c} collegeId={collegeId} />)}
        </div>
      </div>
    </section>
  );
}

