import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { colleges, getCollege } from "@/lib/landing/data";
import CampusNav from "@/components/campus/CampusNav";
import CampusCTA from "@/components/campus/CampusCTA";

interface ClubPageProps {
  params: Promise<{ college: string; clubId: string }>;
}

export function generateStaticParams() {
  const pairs: { college: string; clubId: string }[] = [];
  for (const c of colleges.filter((col) => col.status === "demo" || col.slug === "lbrce")) {
    for (const club of c.clubs) {
      pairs.push({ college: c.slug, clubId: club.id });
    }
  }
  return pairs;
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { college: collegeSlug, clubId } = await params;
  const college = getCollege(collegeSlug);
  const club = college?.clubs.find((c) => c.id === clubId);

  if (!college || !club) {
    return { title: "Club Not Found · 4 the people" };
  }

  return {
    title: `${club.name} · ${college.name} Demo`,
    description: club.tagline,
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { college: collegeSlug, clubId } = await params;
  const college = getCollege(collegeSlug);
  const club = college?.clubs.find((c) => c.id === clubId);

  if (!college || !club || (college.status !== "demo" && college.slug !== "lbrce")) {
    notFound();
  }

  const clubEvents = college.events
    .filter((e) => e.clubId === clubId && e.status !== "past")
    .sort((a, b) => {
      const order = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return order.indexOf(b.month) - order.indexOf(a.month) || Number(b.day) - Number(a.day);
    });

  return (
    <div className="flex min-h-screen flex-col bg-cream text-warm-ink">
      <CampusNav college={college} />
      <main className="flex-1">
        {/* club header band */}
        <section className="relative overflow-hidden px-6 py-20 lg:px-8 lg:py-24" style={{ backgroundColor: club.color }}>
          <div
            aria-hidden
            className="absolute -right-16 top-0 h-72 w-72 rounded-full bg-white/10"
          />
          <div className="relative mx-auto max-w-5xl">
            <Link
              href={`/demo/${college.slug}`}
              className="text-sm font-bold uppercase tracking-wider text-white/80 transition-colors hover:text-white"
            >
              ← Back to {college.shortName}
            </Link>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-white/70">{club.category}</p>
            <h1 className="mt-3 font-display text-5xl font-bold uppercase tracking-tight text-white sm:text-6xl">
              {club.name}
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-white/85">{club.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur border border-white/30">
                {club.members} members
              </span>
              <Link
                href={`/demo/${college.slug}#lineup`}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-warm-ink"
              >
                All events
              </Link>
            </div>
          </div>
        </section>

        {/* club details + its events */}
        <section className="bg-cream px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-3xl font-bold text-warm-ink sm:text-4xl">The story behind the club</h2>
            <p className="mt-4 max-w-2xl text-ink-900/70">
              From late-night jams to sold-out shows — <span className="font-bold text-warm-ink">{club.name}</span> has
              been turning student passion into unforgettable lineups. Here&apos;s what&apos;s coming up.
            </p>

            <div className="mt-12 grid gap-6">
              {clubEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/demo/${college.slug}/events/${e.id}`}
                  className="group rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] transition-all hover:-translate-x-1 hover:-translate-y-1 block"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream font-display text-2xl font-bold text-warm-ink">
                      {e.day}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
                        {e.weekday} · {e.month}
                      </p>
                      <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-warm-ink group-hover:text-coral transition-colors">
                        {e.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-ink-900/60">
                        {e.time} · {e.location} · {e.attendees} attending
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-warm-ink px-3 py-1 text-xs font-bold text-warm-ink">
                      {e.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {clubEvents.length === 0 && (
              <p className="mt-10 text-ink-900/60">No upcoming events from this club right now — stay tuned.</p>
            )}
          </div>
        </section>

        <CampusCTA />
      </main>
    </div>
  );
}

