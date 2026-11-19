'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error('[RootApplicationError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF9F5] dark:bg-[#0B0C10] text-[#0F172A] dark:text-white">
      <div className="max-w-md w-full p-8 rounded-3xl border border-rose-500/20 bg-white dark:bg-[#12141C] shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight">
            Application Error
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            An unexpected error occurred while processing your request.
            Please try reloading the page or return to the main platform.
          </p>
          {error?.message && (
            <div className="mt-3 p-3 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono text-left break-all max-h-24 overflow-y-auto">
              {error.message}
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#FF5733] hover:bg-[#E64A26] text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-slate-200 dark:border-white/10 hover:border-[#FF5733] text-slate-700 dark:text-slate-300 hover:text-[#FF5733] font-extrabold text-xs uppercase tracking-wider transition"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
