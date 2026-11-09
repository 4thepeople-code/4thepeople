import Link from "next/link";

export default function CTABand() {
  return (
    <section id="cta" className="scroll-mt-20 relative overflow-hidden bg-ink-900 px-6 py-24 text-center lg:py-32">
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[130px]"
      />
      <div className="relative mx-auto max-w-3xl">
        <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Put your campus events <br />
          <em className="italic font-bold text-amber-400">on the calendar that matters.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
          Join the waitlist for your college. Founding chapters get setup support for launch season.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#cta"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-amber-500 px-8 text-base font-semibold text-white transition-all hover:bg-amber-600"
          >
            Get early access
          </Link>
          <Link
            href="#colleges"
            className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/20 px-8 text-base font-semibold text-white transition-colors hover:bg-white/5"
          >
            Find your college
          </Link>
        </div>
      </div>
    </section>
  );
}
