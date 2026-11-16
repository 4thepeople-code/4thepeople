import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/shared/Providers';
import { THEME_BOOT_SCRIPT } from '@/lib/routing/themeSurface';

export const metadata: Metadata = {
  applicationName: '4 the people',
  title: '4thepeople — Multi-College Club & Event Platform',
  description: 'Unified platform for collegiate clubs, student engagement, and events across institutions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Theme decision before hydration: never dark on college public surfaces. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-white text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
