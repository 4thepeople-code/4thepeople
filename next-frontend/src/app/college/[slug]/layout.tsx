import type { ReactNode } from 'react';
import { Anton, Inter, Sora } from 'next/font/google';

/**
 * Loads the campus type stack (Anton display, Sora headings, Inter body) as CSS
 * variables for everything under /college/[slug]. Applying the variables here is
 * visual-neutral; the `.college-scope` class that consumes them is applied on the
 * college home page root (and its not-found page) only, so the student, manager
 * and admin dashboards are untouched.
 */
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
});

const sora = Sora({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-sora',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function CollegeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${anton.variable} ${sora.variable} ${inter.variable}`}>
      {children}
    </div>
  );
}
