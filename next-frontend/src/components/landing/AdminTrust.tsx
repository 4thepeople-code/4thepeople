export default function AdminTrust() {
  return (
    <section
      id="admin-trust"
      aria-labelledby="admin-trust-heading"
      className="scroll-mt-24 bg-[var(--surface)] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Your campus, your control
          </p>
          <h2 id="admin-trust-heading" className="mt-4 font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
            Your campus, <em className="italic font-bold text-brand-600">your control</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--ink-soft)]">
            College administrators get full oversight without micromanaging every club.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Own space and link",
              body: "Every college gets its own domain-linked space. Clubs live under the college, not in a shared pool.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
            },
            {
              title: "Isolated data between colleges",
              body: "Each college&rsquo;s clubs, events and registrations are stored separately. No cross-college data leakage.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              ),
            },
            {
              title: "Role-based access",
              body: "Admins, club managers and students each see only what they need. Permissions are set once and enforced everywhere.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
            {
              title: "Verified students",
              body: "Student registrations are verified against the college directory. Only real students get QR tickets.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="4" />
                  <line x1="23" y1="8" x2="18" y2="4" />
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6 shadow-sm transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand-200 bg-brand-soft text-brand-600">
                  {item.icon}
                </span>
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]" dangerouslySetInnerHTML={{ __html: item.body }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
