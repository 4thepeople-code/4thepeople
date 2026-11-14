import type { College } from "@/lib/landing/data";
import { getSpotlightEvent } from "@/lib/landing/featured";

export default function SpotlightEvent({
  college,
  heroEventId,
}: {
  college: College;
  /** Id of the event featured in the hero poster — skipped so the sections never duplicate. */
  heroEventId?: string;
}) {
  const featured = getSpotlightEvent(college, heroEventId);

  if (!featured) return null;

  return (
    <section id="spotlight" className="bg-warm-ink text-cream">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-cream/25 bg-cream/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cream/80">
          ★ Crowd favourite
        </span>

        <h2 className="mt-7 font-campus text-[52px] leading-[0.92] uppercase tracking-tight text-cream sm:text-[76px]">
          {featured.title}
        </h2>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-display text-7xl font-bold leading-none text-cream">{featured.day}</p>
            <p className="mt-2 font-display text-xl font-bold uppercase text-coral">{featured.month}</p>
            <p className="mt-8 text-lg leading-relaxed text-cream/70">{featured.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cream/15 bg-cream/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Starts</p>
                <p className="mt-1 font-semibold text-cream">{featured.time}</p>
              </div>
              <div className="rounded-2xl border border-cream/15 bg-cream/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Where</p>
                <p className="mt-1 font-semibold text-cream">{featured.location}</p>
              </div>
              <div className="rounded-2xl border border-cream/15 bg-cream/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Host club</p>
                <p className="mt-1 font-semibold text-cream">{college.clubs.find((c) => c.id === featured.clubId)?.name}</p>
              </div>
              <div className="rounded-2xl border border-cream/15 bg-cream/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Attending</p>
                <p className="mt-1 font-semibold text-cream">{featured.attendees} students</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -rotate-3 rounded-[2rem] bg-coral" />
            <div className="relative rounded-[2rem] border-2 border-cream/20 bg-ink-900 px-8 py-12 text-center">
              <p className="font-display text-6xl font-bold text-cream">{featured.attendees}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-cream/50">Students are going</p>
              <a
                href={`/demo/${college.slug}/events/${featured.id}`}
                className="mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-coral px-8 text-base font-bold text-white transition-transform hover:-rotate-1"
              >
                Grab your spot
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

