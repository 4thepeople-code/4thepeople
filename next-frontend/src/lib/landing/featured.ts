import type { CampusEvent, College } from "./data";

/**
 * Shape consumed by the HeroPoster component. Mirrors the spec'd poster props;
 * `attending` is optional so "N students going" only renders for real numbers.
 */
export interface HeroPosterEvent {
  id: string;
  title: string;
  posterUrl?: string;
  posterAlt?: string;
  startAt: string;
  venue: string;
  attending?: number;
  href: string;
}

const DAY_MS = 86_400_000;

function eventTime(event: CampusEvent): number {
  if (!event.startAt) return Number.POSITIVE_INFINITY;
  const time = new Date(event.startAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function isUpcoming(event: CampusEvent): boolean {
  return event.status !== "past" && !event.cancelled;
}

/**
 * Hero feature order:
 * 1. An event pinned for the hero by a club lead/admin (`pinned`).
 * 2. The soonest upcoming, non-cancelled event that has a poster.
 * 3. The soonest upcoming, non-cancelled event (typographic poster fallback).
 */
export function getHeroEvent(college: College): CampusEvent | undefined {
  const soonest = college.events.filter(isUpcoming).sort((a, b) => eventTime(a) - eventTime(b));
  return soonest.find((event) => event.pinned) ?? soonest.find((event) => event.posterUrl) ?? soonest[0];
}

/** Spotlight event, skipping the hero's featured event so the two never duplicate. */
export function getSpotlightEvent(college: College, heroEventId?: string): CampusEvent | undefined {
  const pool = college.events.filter((event) => event.id !== heroEventId);
  return pool.find(isUpcoming) ?? pool[0] ?? college.events[0];
}

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Sat, 21 Nov" — always derived from the ISO timestamp, never from mock strings. */
export function formatEventDate(startAt: string): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "";
  const parts = shortDateFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** "Today" / "Tomorrow" / short date, computed against the viewer's local day. */
export function formatPosterBadge(startAt: string): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return formatEventDate(startAt);
}
