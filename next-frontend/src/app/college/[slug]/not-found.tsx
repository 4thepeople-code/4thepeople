import Link from 'next/link';

export default function CollegeNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-24 text-center text-warm-ink">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-coral">
        404 · Page not found
      </p>
      <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
        There is no college page at this address
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-warm-ink/70">
        The link may be mistyped, or the college is not on 4 the people yet. Check the address,
        or pick a college from the directory.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-warm-ink px-5 text-sm font-semibold text-cream transition-colors hover:bg-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-ink focus-visible:ring-offset-2"
        >
          Back to homepage
        </Link>
        <Link
          href="/directory"
          className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-warm-ink bg-white px-5 text-sm font-semibold text-warm-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-ink focus-visible:ring-offset-2"
        >
          Browse colleges
        </Link>
      </div>
    </main>
  );
}
