'use client';

import React from 'react';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { useTheme } from '@/context/ThemeContext';

export interface PublicLayoutProps {
  children: React.ReactNode;
  collegeSlug?: string;
  collegeName?: string;
  collegeLogo?: string;
}

export function PublicLayout({ children, collegeSlug, collegeName, collegeLogo }: PublicLayoutProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`min-h-screen font-sans antialiased flex flex-col justify-between overflow-x-hidden transition-colors duration-300 ${
        collegeSlug
          ? 'college-scope bg-[var(--surface-page)] text-[var(--text-primary)] selection:bg-[#ff4a3d] selection:text-white'
          : isDark
          ? 'bg-[#0B0C10] text-[#F3F4F6] selection:bg-[#00F0FF] selection:text-black'
          : 'bg-[#FAF9F5] text-[#0F172A] selection:bg-[#00F0FF] selection:text-black'
      }`}
    >
      <PublicNavbar collegeSlug={collegeSlug} collegeName={collegeName} collegeLogo={collegeLogo} />
      <main className="flex-1 w-full pt-24 sm:pt-28">{children}</main>
      <PublicFooter collegeSlug={collegeSlug} collegeName={collegeName} collegeLogo={collegeLogo} />
    </div>
  );
}

export default PublicLayout;
