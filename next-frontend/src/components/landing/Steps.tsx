const steps = [
  {
    n: "01",
    title: "Apply",
    body: "College applies to join 4 the people. We review and set up the campus space.",
  },
  {
    n: "02",
    title: "Invite managers",
    body: "Admins invite club managers who then create and run their own clubs.",
  },
  {
    n: "03",
    title: "Students join",
    body: "Students register, browse events and check in with QR tickets.",
  },
];

export default function Steps() {
  return (
    <section
      id="steps"
      aria-labelledby="steps-heading"
      className="scroll-mt-24 bg-[var(--bg)] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            How it works
          </p>
          <h2 id="steps-heading" className="mt-4 font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
            Get a college running in <em className="italic font-bold text-brand-600">three steps</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
            From application to active clubs — no committee required.
          </p>
        </div>

        {/* Connected stepper */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 h-0.5 bg-[var(--line)]" aria-hidden />
          <div className="relative grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className="relative flex flex-col items-center z-10"
              >
                <span className="relative z-10 h-14 w-14 rounded-full border-2 border-[var(--line)] bg-[var(--surface)] flex items-center justify-center font-display text-2xl font-bold text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-[var(--ink)] text-center">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)] text-center max-w-xs mx-auto">
                  {s.body}
                </p>
                {i < steps.length - 1 && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-brand-600" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
