import { Anton, Inter, Sora } from 'next/font/google';

/**
 * Landing fonts for the dashboard shell. The (marketing) and demo layouts load
 * these only inside their own subtrees, so the dashboards load them here and
 * DashboardShell applies the CSS variables on its root element.
 */
export const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

export const sora = Sora({
  weight: '700',
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
