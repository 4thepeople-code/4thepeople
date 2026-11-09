"use client";

import { useState, type FormEvent } from "react";
import type { CampusEvent, College } from "@/lib/landing/data";

export default function EventRegistration({
  event,
  college,
}: {
  event: CampusEvent;
  college: College;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) setSubmitted(true);
  };

  return (
    <section id="register" className="bg-cream px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border-2 border-warm-ink bg-white p-8 shadow-[8px_8px_0_0_#241209]">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#241209" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="mt-6 font-display text-3xl font-bold text-warm-ink">You&apos;re in!</h2>
              <p className="mx-auto mt-3 max-w-md text-ink-900/70">
                Ticket reserved for <span className="font-bold text-warm-ink">{event.title}</span> at{" "}
                <span className="font-bold text-warm-ink">{event.location}</span>. We&apos;ve sent the
                confirmation to <span className="font-bold text-warm-ink">{email}</span>.
              </p>
              <a
                href={`/demo/${college.slug}`}
                className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-warm-ink px-6 text-sm font-bold text-cream"
              >
                Back to {college.shortName}
              </a>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: college.accent }}>
                Secure your spot
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-warm-ink">Register for this event</h2>
              <p className="mt-2 text-sm text-ink-900/60">
                {event.attendees} students are planning to attend · free for students · no card required.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="ev-name" className="text-xs font-bold uppercase tracking-wider text-ink-900/60">
                    Full name
                  </label>
                  <input
                    id="ev-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Student"
                    className="mt-2 w-full rounded-xl border-2 border-warm-ink bg-white px-4 py-3 text-ink-900 placeholder:text-ink-900/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="ev-email" className="text-xs font-bold uppercase tracking-wider text-ink-900/60">
                    Email
                  </label>
                  <input
                    id="ev-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="mt-2 w-full rounded-xl border-2 border-warm-ink bg-white px-4 py-3 text-ink-900 placeholder:text-ink-900/30 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!valid}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-coral text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Register now
                </button>
                <p className="text-center text-xs text-ink-900/50">Registration is free · instant confirmation</p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

