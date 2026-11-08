'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import InviteManagerModal from './InviteManagerModal';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';

export interface AdminLayoutProps {
  slug: string;
  children: React.ReactNode;
}

export function AdminLayout({ slug, children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const loginHref = getCanonicalPath('/login/admin');

  // Auth Guard: Only users with COLLEGE_ADMIN or ADMIN role are authorized
  const isAuthorized = user && (user.role === 'COLLEGE_ADMIN' || user.role === 'ADMIN');

  if (authLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#FAF9F7] text-[#1C1B1F]'
        }`}
      >
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#B08D57] animate-spin mx-auto" />
          <p className="text-xs font-semibold tracking-wider text-[#6B6966]">
            Validating Administrator Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#FAF9F7] text-[#1C1B1F]'
        }`}
      >
        <div className="max-w-md w-full bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-8 rounded-xl shadow-lg text-center space-y-4 font-sans">
          <div className="w-12 h-12 rounded-full bg-[#FAF4E8] dark:bg-amber-950/40 border border-[#EEDFA8] dark:border-amber-900/60 text-[#8A6421] dark:text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
            Authentication Required
          </h2>
          <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] leading-relaxed">
            Please log in with your institutional administrator account to access the college management portal.
          </p>
          <div className="pt-2">
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-semibold rounded transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Go to Admin Login</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#FAF9F7] text-[#1C1B1F]'
        }`}
      >
        <div className="max-w-md w-full bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-8 rounded-xl shadow-lg text-center space-y-4 font-sans">
          <div className="w-12 h-12 rounded-full bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
            Access Denied
          </h2>
          <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] leading-relaxed">
            Your account ({user.email}) does not hold college administrator privileges for this campus.
          </p>
          <div className="pt-2">
            <button
              onClick={() => router.push(getCanonicalPath('/'))}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-semibold rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
            >
              Back to Campus Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex font-sans antialiased transition-colors duration-300 ${
        isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#FAF9F7] text-[#1C1B1F]'
      }`}
    >
      {/* Sidebar */}
      <AdminSidebar
        slug={slug}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenInviteManager={() => setInviteModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Invite Manager Modal */}
      <InviteManagerModal
        slug={slug}
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />
    </div>
  );
}

export default AdminLayout;
