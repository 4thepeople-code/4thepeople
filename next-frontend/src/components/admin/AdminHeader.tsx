'use client';

import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

export interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();

  const getBreadcrumbs = () => {
    if (pathname.endsWith('/admin')) return 'Dashboard';
    if (pathname.includes('/admin/profile')) return 'My Profile';
    if (pathname.includes('/admin/roster')) return 'Student Roster';
    if (pathname.includes('/admin/users/')) return 'User Details';
    if (pathname.includes('/admin/users')) return 'Users';
    if (pathname.includes('/admin/clubs/create')) return 'Clubs / Create';
    if (pathname.includes('/admin/clubs/')) return 'Club Details';
    if (pathname.includes('/admin/clubs')) return 'Clubs';
    if (pathname.includes('/admin/departments')) return 'Departments';
    return 'Admin';
  };

  return (
    <header
      className={`h-16 px-6 sm:px-8 border-b flex items-center justify-between sticky top-0 z-30 font-sans transition-colors ${
        isDark
          ? 'bg-[#151D2A] border-slate-800 text-slate-100'
          : 'bg-[#FAF9F7] border-[#E7E5E4] text-[#1C1B1F]'
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className={`lg:hidden p-2 rounded transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-[#6B6966] hover:text-[#1C1B1F] hover:bg-[#F2F0EC]'
          }`}
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div
          className={`flex items-center gap-2 text-xs sm:text-sm ${
            isDark ? 'text-slate-400' : 'text-[#6B6966]'
          }`}
        >
          <span>Admin</span>
          <span className={isDark ? 'text-slate-600' : 'text-[#A8A5A0]'}>/</span>
          <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-[#1C1B1F]'}`}>
            {getBreadcrumbs()}
          </span>
        </div>
      </div>

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          isDark
            ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700'
            : 'bg-white border-[#E7E5E4] text-slate-700 hover:bg-[#F2F0EC]'
        }`}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle theme mode"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600" />
        )}
        <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    </header>
  );
}

export default AdminHeader;

