'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

export interface PublicFooterProps {
  collegeSlug?: string;
  collegeName?: string;
}

export function PublicFooter({ collegeSlug, collegeName }: PublicFooterProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();

  const getPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${collegeSlug}`)) {
      return `/college/${collegeSlug}${subPath === '/' ? '' : subPath}`;
    }
    return subPath;
  };

  const homeHref = getPath('/');
  const clubsHref = getPath('/clubs');
  const loginHref = getPath('/login');

  return (
    <footer
      className={`mt-auto py-16 border-t relative transition-colors duration-300 ${
        isDark ? 'bg-[#08090C] text-gray-400 border-white/10' : 'bg-white text-slate-600 border-slate-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          {/* Brand Info */}
          <div className="md:col-span-6 space-y-4">
            <div
              className={`flex items-center gap-2.5 font-extrabold tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-[#3B82F6] flex items-center justify-center text-black font-black shadow-lg shadow-cyan-500/20 shrink-0">
                <span className="font-['Syne',sans-serif] text-2xl font-black leading-none">4</span>
              </div>
              <div className="flex flex-col justify-center leading-none font-['Syne',sans-serif]">
                <span className="text-[10px] font-black tracking-[0.25em] text-[#00F0FF] uppercase leading-none mb-0.5">
                  THE
                </span>
                <span className="text-xl font-black tracking-tight leading-none">
                  PEOPLE<span className="text-[#00F0FF]">.</span>
                </span>
                {collegeName && (
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest mt-0.5">
                    {collegeName}
                  </span>
                )}
              </div>
            </div>

            <p className={`text-sm max-w-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Discover campus clubs, manage vibrant events, and empower student leadership with 4 THE PEOPLE.
            </p>
          </div>

          {/* Nav Links */}
          <div className="md:col-span-3 space-y-3">
            <h4
              className={`font-['Syne',sans-serif] text-xs font-extrabold uppercase tracking-widest ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Navigation
            </h4>
            <ul className="space-y-2 text-xs font-semibold">
              <li>
                <Link href={homeHref} className="hover:text-[#00F0FF] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href={clubsHref} className="hover:text-[#00F0FF] transition-colors">
                  Clubs Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals Link */}
          <div className="md:col-span-3 space-y-3">
            <h4
              className={`font-['Syne',sans-serif] text-xs font-extrabold uppercase tracking-widest ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Manager Access
            </h4>
            <ul className="space-y-2 text-xs font-semibold">
              <li>
                <Link href={loginHref} className="hover:text-[#00F0FF] transition-colors">
                  Manager Portal Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Bottom Bar */}
        <div
          className={`pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
            isDark ? 'text-gray-500' : 'text-slate-400'
          }`}
        >
          <p>© {new Date().getFullYear()} 4 THE PEOPLE. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <span className="hover:underline cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;

