import type { CampusEvent, College } from "@/lib/landing/data";

const monthOrder = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function getLatestEvent(college: College): CampusEvent | undefined {
  const upcoming = college.events.filter((e) => e.status !== "past");
  return upcoming.sort(
    (a, b) => monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month) || Number(b.day) - Number(a.day),
  )[0];
}

export default function CampusHero({ college }: { college: College }) {
  const latest = getLatestEvent(college);

  return (
    <section className="relative overflow-hidden bg-cream text-warm-ink">
      <div
        aria-hidden
        className="absolute -right-14 top-4 hidden h-44 w-44 -rotate-12 place-items-center rounded-full bg-coral text-center font-display text-2xl font-bold uppercase text-white sm:grid lg:block"
      >
        Fall · 2026
      </div>
      <div
        aria-hidden
        className="absolute -left-20 bottom-0 h-96 w-96 rounded-full border-[16px] border-warm-ink/10"
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="flex flex-col gap-12 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-end">
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-warm-ink bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-[3px_3px_0_0_#241209]">
              <span className="h-2.5 w-2.5 rounded-full bg-coral" />
              Now booking · {college.season}
            </span>

            {latest && (
              <>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-ink-900/50">
                  ★ Next up · {latest.weekday}, {latest.month} {latest.day}
                </p>
                <h1 className="mt-4 font-campus text-[52px] leading-[0.9] uppercase tracking-tight text-warm-ink sm:text-[68px] lg:text-[92px]">
                  {latest.title.toUpperCase()}
                </h1>
                <p className="mt-7 max-w-xl text-lg leading-snug text-ink-900/70">{latest.description}</p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-ink-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream">
                    {latest.time}
                  </span>
                  <span className="rounded-full border-2 border-warm-ink bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-warm-ink">
                    {latest.location}
                  </span>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <a
                    href={`/demo/${college.slug}/events/${latest.id}`}
                    className="inline-flex h-14 items-center justify-center rounded-2xl px-8 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: college.accent }}
                  >
                    Get tickets · {latest.attendees} attending
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

          <div className="w-full max-w-sm -rotate-2 rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[8px_8px_0_0_#241209]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-900/50">Season snapshot</p>
            <div className="mt-5 space-y-4">
              {college.stats?.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-4 border-b border-dashed border-warm-ink/15 pb-3 last:border-0 last:pb-0">
                  <span className="font-display text-3xl font-bold text-warm-ink">{s.value}</span>
                  <span className="text-right text-sm font-medium text-ink-900/60">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

