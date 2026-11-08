'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/Button';

export interface HeaderProps {
  collegeName?: string;
  collegeSlug?: string;
  isPlatformAdmin?: boolean;
}

export function Header({ collegeName, collegeSlug, isPlatformAdmin }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
              4thepeople
            </span>
            {collegeName && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-2">
                {collegeName}
              </span>
            )}
            {isPlatformAdmin && (
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold tracking-wider">
                Platform Ops
              </span>
            )}
          </Link>
        </div>

        <nav className="flex items-center space-x-4">
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user.name || user.email}
              </span>
              <Button size="sm" variant="outline" onClick={logout}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link href={collegeSlug ? `/college/${collegeSlug}/login` : '/login'}>
                <Button size="sm" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;

