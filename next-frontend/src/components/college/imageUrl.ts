/**
 * First non-empty image URL from a list of candidate fields. Shared by the
 * campus public cards (club cover, event poster); mirrors the helper that used
 * to live inline in CollegeHomePageClient.
 */
export function resolveImageUrl(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    if (typeof url === 'string' && url.trim() !== '') return url;
  }
  return null;
}
