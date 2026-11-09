import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { colleges, getClub, getCollege } from "@/lib/landing/data";
import CampusNav from "@/components/campus/CampusNav";
import EventRegistration from "@/components/campus/EventRegistration";
import CampusCTA from "@/components/campus/CampusCTA";

interface EventPageProps {
  params: Promise<{ college: string; eventId: string }>;
}

export function generateStaticParams() {
  const pairs: { college: string; eventId: string }[] = [];
  for (const c of colleges.filter((col) => col.status === "demo" || col.slug === "lbrce")) {
    for (const e of c.events) {
      pairs.push({ college: c.slug, eventId: e.id });
    }
  }
  return pairs;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { college: collegeSlug, eventId } = await params;
  const college = getCollege(collegeSlug);
  const event = college?.events.find((e) => e.id === eventId);

  if (!college || !event) {
    return { title: "Event Not Found · 4 the people" };
  }

  return {
    title: `${event.title} · ${college.name} Demo`,
    description: event.description,
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { college: collegeSlug, eventId } = await params;
  const college = getCollege(collegeSlug);
  const event = college?.events.find((e) => e.id === eventId);

  if (!college || !event || (college.status !== "demo" && college.slug !== "lbrce")) {
    notFound();
  }

  const club = getClub(college, event.clubId);

  return (
    <div className="flex min-h-screen flex-col bg-cream text-warm-ink">
      <CampusNav college={college} />
      <main className="flex-1">
        <section className="relative overflow-hidden px-6 py-16 lg:px-8 lg:py-20">
          <div
            aria-hidden
            className="absolute -right-16 top-0 h-72 w-72 rounded-full border-[14px] border-warm-ink/10"
          />
          <div className="relative mx-auto max-w-5xl">
            <Link
              href={`/demo/${college.slug}`}
              className="text-sm font-bold uppercase tracking-wider text-ink-900/60 transition-colors hover:text-warm-ink"
            >
              ← Back to {college.shortName}
            </Link>

            <span
              className="mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white"
              style={{ backgroundColor: event.status === "live" ? "#ff4a3d" : college.accent }}
            >
              {event.status === "live" ? "● Live now" : event.status}
            </span>

            <h1 className="mt-6 font-campus text-[52px] leading-[0.9] uppercase text-warm-ink sm:text-[68px]">
              {event.title.toUpperCase()}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-snug text-ink-900/70">{event.description}</p>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border-2 border-warm-ink bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">Host club</p>
                <p className="mt-1 font-display text-xl font-bold uppercase text-warm-ink">{club?.name ?? "—"}</p>
              </div>
              <div className="rounded-2xl border-2 border-warm-ink bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">Date</p>
                <p className="mt-1 font-display text-xl font-bold uppercase text-warm-ink">
                  {event.weekday}, {event.month} {event.day}
                </p>
              </div>
              <div className="rounded-2xl border-2 border-warm-ink bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">Time</p>
                <p className="mt-1 font-display text-xl font-bold uppercase text-warm-ink">{event.time}</p>
              </div>
              <div className="rounded-2xl border-2 border-warm-ink bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">Venue</p>
                <p className="mt-1 font-display text-xl font-bold uppercase text-warm-ink">{event.location}</p>
              </div>
              <div className="rounded-2xl border-2 border-warm-ink bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-900/50">Attending</p>
                <p className="mt-1 font-display text-xl font-bold uppercase text-warm-ink">{event.attendees} students</p>
              </div>
            </div>

            <div className="mt-10">
              <a
                href="#register"
                className="inline-flex h-14 items-center justify-center rounded-2xl px-8 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: college.accent }}
              >
                Register now
              </a>
            </div>
          </div>
        </section>

        <EventRegistration event={event} college={college} />

        {club && (
          <section className="border-t-2 border-dashed border-warm-ink/15 bg-cream px-6 py-16 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-900/50">Hosted by</p>
              <Link
                href={`/demo/${college.slug}/clubs/${club.id}`}
                className="mt-3 inline-block font-display text-3xl font-bold uppercase tracking-tight text-warm-ink transition-colors hover:text-coral"
              >
                {club.name}
              </Link>
              <p className="mt-2 text-ink-900/60">{club.tagline}</p>
            </div>
          </section>
        )}

        <CampusCTA />
      </main>
    </div>
  );
}

