/**
 * Theme-surface decision: where the global dark theme may apply.
 *
 * The college public side and the student workspace render a single light
 * campus theme, so the "dark" class must never reach <html> there — even when
 * localStorage says dark. Manager and admin dashboards keep their own chrome
 * and toggle, so those two segments are excluded from the block.
 *
 * Two consumers:
 * 1. isCollegeDarkBlockedSurface() — pure TS, used by ThemeProvider on every
 *    client navigation (handles marketing(dark) -> college and back).
 * 2. buildThemeBootScript() — the same decision as an inline pre-hydration
 *    script, so there is no dark flash on first load. Mirrors hostResolver's
 *    hostname rules: prod subdomains of 4thepeople.in; dev subdomains of
 *    localhost/local (dev only); reserved slugs (www/api/admin/...) never count
 *    as a college host; nested subdomains and evil suffixes never match.
 */

const RESERVED_HOST_SLUGS = ['api', 'mail', 'app', 'static', 'assets', 'public', 'auth'];

/**
 * College Admin dashboard areas under /college/<slug>/ that keep their own
 * theme toggle. The manager workspace is permanently light-themed and
 * dark-blocked (like the student workspace and college public pages).
 */
const COLLEGE_DASHBOARD_PATH = /^\/college\/[a-z0-9-]+\/admin(\/|$)/;

/** College Admin dashboard URLs as served from a college subdomain root. */
const TOP_LEVEL_DASHBOARD_PATH = /^\/admin(\/|$)/;

/** Mirrors hostResolver's subdomain rules for the browser (hostname has no port). */
export function isCollegeHost(
  hostname: string,
  options: { isProduction?: boolean } = {}
): boolean {
  const isProduction =
    options.isProduction !== undefined ? options.isProduction : process.env.NODE_ENV === 'production';

  const host = (hostname || '').split(':')[0].trim().toLowerCase().replace(/\.$/, '');

  const prodMatch = host.match(/^([a-z0-9-]+)\.4thepeople\.in$/);
  let slug: string | undefined = prodMatch?.[1];

  if (!slug && !isProduction) {
    slug = host.match(/^([a-z0-9-]+)\.(localhost|local)$/)?.[1];
  }

  if (!slug) return false;
  if (slug === 'www' || slug === 'admin') return false;
  if (RESERVED_HOST_SLUGS.includes(slug)) return false;
  return true;
}

/**
 * True when this path+host is a college PUBLIC surface where dark is never
 * allowed. Dashboard segments return false (their chrome owns the toggle).
 */
export function isCollegeDarkBlockedSurface(
  pathname: string,
  hostname: string,
  options: { isProduction?: boolean } = {}
): boolean {
  const path = (pathname || '').toLowerCase();

  // Dashboards own their theme — dark stays available there.
  if (COLLEGE_DASHBOARD_PATH.test(path)) return false;
  if (TOP_LEVEL_DASHBOARD_PATH.test(path) && isCollegeHost(hostname, options)) return false;

  // Path-based college pages (plain host): /college and /college/**.
  if (path === '/college' || path.startsWith('/college/')) return true;

  // Subdomain-host pages: everything on a college subdomain is college surface.
  return isCollegeHost(hostname, options);
}

/**
 * Pre-hydration script with the same decision, inlined in the root layout so
 * the correct theme class is on <html> before React hydrates (no dark flash).
 *
 * The decision logic here is intentionally a hand-mirrored copy of
 * isCollegeDarkBlockedSurface — keep the two in sync (suite 1C asserts both).
 */
export function buildThemeBootScript(isProduction: boolean): string {
  return `(function () {
  try {
    var theme = null;
    try { theme = localStorage.getItem('yuva_theme'); } catch (e) {}
    var path = location.pathname.toLowerCase();
    var host = location.hostname.toLowerCase().split(':')[0].replace(/\\.$/, '');
    var isProd = ${JSON.stringify(isProduction)};
    var dashOnPath = /^\\/college\\/[a-z0-9-]+\\/admin(\\/|$)/.test(path);
    var hostSlugMatch = host.match(/^([a-z0-9-]+)\\.4thepeople\\.in$/);
    if (!isProd && !hostSlugMatch) hostSlugMatch = host.match(/^([a-z0-9-]+)\\.(localhost|local)$/);
    var slug = hostSlugMatch ? hostSlugMatch[1] : null;
    var collegeHost = !!slug && slug !== 'www' && slug !== 'admin' && ['api','mail','app','static','assets','public','auth'].indexOf(slug) === -1;
    var dashOnHost = collegeHost && /^\\/admin(\\/|$)/.test(path);
    var collegePath = path === '/college' || path.indexOf('/college/') === 0;
    var dark = theme === 'dark' && !((collegePath || collegeHost) && !dashOnPath && !dashOnHost);
    var root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;
}

/** Script injected by the root layout (env resolved at build time). */
export const THEME_BOOT_SCRIPT = buildThemeBootScript(process.env.NODE_ENV === 'production');
