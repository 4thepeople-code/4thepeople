import { permanentRedirect } from 'next/navigation';

export interface AdminLoginRedirectProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Old admin-login path → the real tenant login. Permanent (308) so bookmarks
 * and search engines update; every query param (e.g. ?returnUrl=…) is carried
 * across so post-login navigation still returns to the original screen.
 */
export default async function AdminLoginRedirectPage({
  params,
  searchParams,
}: AdminLoginRedirectProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  const search = qs.toString();

  permanentRedirect(`/college/${slug}/login/admin${search ? `?${search}` : ''}`);
}
