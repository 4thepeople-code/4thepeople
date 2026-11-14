import type { CSSProperties } from "react";
import type { HeroPosterEvent } from "@/lib/landing/featured";
import { formatPosterBadge } from "@/lib/landing/featured";

/**
 * Hover lift (rotate to 0 + rise 4px) — gated to hover-capable devices that
 * haven't asked for reduced motion, so touch users and reduced-motion users
 * never see it fire. Nothing animates on load.
 */
const HOVER_LIFT =
  "group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:rotate-0 group-hover:[@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:-translate-y-1";

export default function HeroPoster({
  event,
  accent,
}: {
  event: HeroPosterEvent;
  /** College accent color for the typographic fallback + Register button. */
  accent?: string;
}) {
  const badge = formatPosterBadge(event.startAt);
  const fallbackStyle: CSSProperties | undefined = event.posterUrl
    ? undefined
    : { backgroundColor: accent ?? "var(--color-coral)" };

  return (
    <div className="w-full max-w-sm min-[900px]:justify-self-end">
      <a
        href={event.href}
        className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-ink"
      >
        <div
          className={`relative aspect-[4/5] rotate-2 rounded-2xl border-[3px] border-warm-ink bg-cream shadow-[8px_8px_0_0_#241209] transition-transform duration-200 will-change-transform ${HOVER_LIFT}`}
        >
          {event.posterUrl ? (
            <img
              src={event.posterUrl}
              alt={event.posterAlt ?? `Poster for ${event.title}`}
              width={600}
              height={750}
              fetchPriority="high"
              className="h-full w-full rounded-[13px] object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col justify-end rounded-[13px] p-6"
              style={fallbackStyle}
            >
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-white/80">
                ★ Featured event
              </span>
              <p className="mt-3 font-campus text-4xl uppercase leading-[0.95] text-white">
                {event.title}
              </p>
            </div>
          )}
          <span className="absolute -left-2 -top-3 rounded-xl border-[3px] border-warm-ink bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-warm-ink shadow-[4px_4px_0_0_#241209]">
            {badge}
          </span>
        </div>
      </a>

      <div className="mt-5 flex flex-col items-start gap-1.5">
        <p className="text-sm font-semibold text-ink-900/70">{event.venue}</p>
        {typeof event.attending === "number" && (
          <p className="text-sm text-ink-900/60">{event.attending} students going</p>
        )}
        <a
          href={event.href}
          className="mt-2 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-bold uppercase tracking-wider text-white shadow-[4px_4px_0_0_#241209] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-ink"
          style={{ backgroundColor: accent ?? "var(--color-coral)" }}
        >
          Register
        </a>
      </div>
    </div>
  );
}
