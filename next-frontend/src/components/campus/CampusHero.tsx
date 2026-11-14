import type { CampusEvent, College } from "@/lib/landing/data";
import { formatEventDate, getHeroEvent, type HeroPosterEvent } from "@/lib/landing/featured";
import HeroPoster from "@/components/campus/HeroPoster";

function toPosterEvent(college: College, event: CampusEvent): HeroPosterEvent | undefined {
  if (!event.startAt) return undefined;
  return {
    id: event.id,
    title: event.title,
    posterUrl: event.posterUrl,
    posterAlt: event.posterAlt,
    startAt: event.startAt,
    venue: event.location,
    attending: event.attendees,
    href: `/demo/${college.slug}/events/${event.id}`,
  };
}

export default function CampusHero({ college }: { college: College }) {
  const featured = getHeroEvent(college);
  const posterEvent = featured ? toPosterEvent(college, featured) : undefined;

  return (
    <section className="relative overflow-hidden bg-cream text-warm-ink">
      <div
        aria-hidden
        className="absolute -right-14 top-4 hidden h-44 w-44 place-items-center rounded-full bg-coral text-center font-display text-2xl font-bold uppercase text-white sm:grid lg:block"
      >
        Fall · 2026
      </div>
      <div
        aria-hidden
        className="absolute -left-20 bottom-0 h-96 w-96 rounded-full border-[16px] border-warm-ink/10"
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="flex flex-col gap-12 min-[900px]:grid min-[900px]:grid-cols-[1.4fr_1fr] min-[900px]:items-end min-[900px]:gap-16">
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-warm-ink bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-[3px_3px_0_0_#241209]">
              <span className="h-2.5 w-2.5 rounded-full bg-coral" />
              Now booking · {college.season}
            </span>

            {featured && (
              <>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-ink-900/50">
                  ★ Next up ·{" "}
                  {featured.startAt
                    ? formatEventDate(featured.startAt)
                    : `${featured.weekday}, ${featured.month} ${featured.day}`}
                </p>
                <h1 className="mt-4 font-campus text-[52px] leading-[0.9] uppercase tracking-tight text-warm-ink sm:text-[68px] lg:text-[92px]">
                  {featured.title.toUpperCase()}
                </h1>
                <p className="mt-7 max-w-xl text-lg leading-snug text-ink-900/70">{featured.description}</p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-ink-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream">
                    {featured.time}
                  </span>
                  <span className="rounded-full border-2 border-warm-ink bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-warm-ink">
                    {featured.location}
                  </span>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <a
                    href={`/demo/${college.slug}/events/${featured.id}`}
                    className="inline-flex h-14 items-center justify-center rounded-2xl px-8 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: college.accent }}
                  >
                    Get tickets · {featured.attendees} attending
                  </a>
                  <a
                    href="#lineup"
                    className="inline-flex h-14 items-center justify-center rounded-2xl border-2 border-warm-ink bg-white px-8 text-base font-bold text-warm-ink transition-transform hover:-translate-y-0.5"
                  >
                    Browse the lineup
                  </a>
                </div>
              </>
            )}
          </div>

          {posterEvent && <HeroPoster event={posterEvent} accent={college.accent} />}
        </div>
      </div>
    </section>
  );
}

