'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalApplicationError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 bg-[#0B0C10] text-white font-sans antialiased">
        <div className="max-w-md w-full p-8 rounded-3xl border border-rose-500/20 bg-[#12141C] shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight text-white">
              Application Error
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We encountered an unexpected error while loading this page.
              Please try refreshing or navigate back to the main portal.
            </p>
            {error?.message && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono text-left break-all max-h-24 overflow-y-auto">
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
              <span>Reload Page</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-white/10 hover:border-[#FF5733] text-slate-300 hover:text-[#FF5733] font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Go to Home</span>
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
