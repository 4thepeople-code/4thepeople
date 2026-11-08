'use client';

import React from 'react';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { useTheme } from '@/context/ThemeContext';

export interface PublicLayoutProps {
  children: React.ReactNode;
  collegeSlug?: string;
  collegeName?: string;
}

export function PublicLayout({ children, collegeSlug, collegeName }: PublicLayoutProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`min-h-screen font-sans selection:bg-[#00F0FF] selection:text-black antialiased flex flex-col justify-between overflow-x-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#0B0C10] text-[#F3F4F6]' : 'bg-[#FAF9F5] text-[#0F172A]'
      }`}
    >
      <PublicNavbar collegeSlug={collegeSlug} collegeName={collegeName} />
      <main className="flex-1 w-full pt-20">{children}</main>
      <PublicFooter collegeSlug={collegeSlug} collegeName={collegeName} />
    </div>
  );
}

export default PublicLayout;

