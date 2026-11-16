/**
 * Slugs of colleges that exist on the platform today.
 *
 * The backend does not expose a public college-by-slug endpoint yet, so the college
 * home page validates incoming slugs against this list and renders the styled 404
 * (app/college/[slug]/not-found.tsx) for anything else — including landing-page demo
 * slugs like northwood.
 *
 * TODO: replace this static list with a public college-by-slug API check once the
 * backend provides one (see backend follow-ups).
 */
export const REAL_COLLEGE_SLUGS: readonly string[] = ['lbrce'];

export function isRealCollegeSlug(slug: string): boolean {
  return REAL_COLLEGE_SLUGS.includes(slug.toLowerCase());
}
