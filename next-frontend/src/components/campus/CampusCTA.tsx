import Link from "next/link";

export default function CampusCTA() {
  return (
    <section className="bg-cream px-6 py-24 text-center lg:py-32">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-4xl font-bold tracking-tight text-warm-ink sm:text-5xl">
          Your club should be on the calendar.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-900/60">
          Launch your first event this month. 4 the people sets your club up in a day — planning,
          promotions and attendance, handled.
        </p>
        <div className="mt-10">
          <Link
            href="/#cta"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-warm-ink px-8 text-base font-bold text-cream transition-transform hover:-translate-y-0.5"
          >
            Start your club — it’s free
          </Link>
        </div>
      </div>
    </section>
  );
}

