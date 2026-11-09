const tools = [
  { name: "WhatsApp groups", before: "Chats get buried. Nobody knows who's in." },
  { name: "Google Forms", before: "Sign-ups vanish into a spreadsheet nobody checks." },
  { name: "Excel sheets", before: "Manually track who's coming. It's always wrong." },
  { name: "Instagram posters", before: "Dead links, no capacity, no RSVP." },
  { name: "Paper sign-ups", before: "Lost paper lists, no show count." },
];

const benefits = [
  { name: "Campus feed", after: "Every club event in one place. No more WhatsApp hunting." },
  { name: "Event pages", after: "Clean pages with seat limits and one-tap registration." },
  { name: "Digital QR tickets", after: "Instant pass on the student's phone to show at the door." },
  { name: "Scan at the door", after: "Scan QR tickets in seconds. No lost paper lists." },
  { name: "Live dashboard", after: "Real-time attendance roster so organisers know who's in." },
];

export default function BeforeAfter() {
  return (
    <section
      id="before-after"
      aria-labelledby="before-after-heading"
      className="scroll-mt-24 bg-ink-900 text-white px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-500">
            Before and after
          </p>
          <h2 id="before-after-heading" className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            From scattered tools <em className="italic font-bold text-brand-500">to one home.</em>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            See how event organising changes when everything lives in one place.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 items-stretch">
          {/* Before column: 5 tools */}
          <div className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg">
            <div>
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/60"
                >
                  Before
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  Event organising across five tools
                </h3>
              </div>
              <ul className="mt-6 space-y-4">
                {tools.map((t) => (
                  <li key={t.name} className="flex gap-3">
                    <span className="shrink-0 text-secondary flex items-start pt-0.5" aria-hidden>
                      ✕
                    </span>
                    <div>
                      <p className="text-[15px] leading-relaxed text-white font-medium">
                        {t.name}
                      </p>
                      <p className="text-sm leading-relaxed text-white/60">
                        {t.before}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* After column: 5 matching benefits */}
          <div className="flex h-full flex-col justify-between rounded-3xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-8 shadow-lg ring-1 ring-[var(--primary)]/20">
            <div>
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 rounded-full border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--primary-strong)]"
                >
                  After
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  One dashboard for events, registrations and QR check-ins
                </h3>
              </div>
              <ul className="mt-6 space-y-4">
                {benefits.map((b) => (
                  <li key={b.name} className="flex gap-3">
                    <span className="shrink-0 text-emerald-400 flex items-start pt-0.5" aria-hidden>
                      ✓
                    </span>
                    <div>
                      <p className="text-[15px] leading-relaxed text-white font-medium">
                        {b.name}
                      </p>
                      <p className="text-sm leading-relaxed text-white/60">
                        {b.after}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
