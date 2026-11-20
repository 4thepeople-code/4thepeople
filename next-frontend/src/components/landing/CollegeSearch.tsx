'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { COLLEGES, CollegeInfo } from './data';

interface CollegeSearchProps {
  id?: string;
  buttonLabel?: string;
}

export default function CollegeSearch({
  id = 'college-search',
  buttonLabel = 'Find your college',
}: CollegeSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CollegeInfo[]>([]);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      try {
        const matches = COLLEGES.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.shortName.toLowerCase().includes(q) ||
            c.city.toLowerCase().includes(q)
        );
        setResults(matches);
        setLoading(false);
        setError(false);
        setSelectedIndex(-1);
      } catch {
        setLoading(false);
        setError(true);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, retryCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (college: CollegeInfo) => {
    setIsOpen(false);
    setQuery('');
    if (college.homepageUrl.startsWith('http')) {
      window.location.href = college.homepageUrl;
    } else {
      router.push(college.homepageUrl);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-ink-900/40"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>

        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && results.length > 0) {
              e.preventDefault();
              setIsOpen(true);
              setSelectedIndex((prev) => (prev + 1) % results.length);
            } else if (e.key === 'ArrowUp' && results.length > 0) {
              e.preventDefault();
              setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const target = results[selectedIndex >= 0 ? selectedIndex : 0];
              if (target) handleSelect(target);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder="Search by college name…"
          autoComplete="off"
          className="w-full rounded-2xl border border-ink-900/10 bg-white py-3.5 sm:py-4 pl-11 sm:pl-12 pr-40 sm:pr-44 text-sm sm:text-base text-ink-950 placeholder:text-ink-900/40 shadow-[0_1px_3px_rgb(10_17_40/0.06)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />

        <button
          type="button"
          onClick={() => {
            if (results.length > 0) {
              handleSelect(results[selectedIndex >= 0 ? selectedIndex : 0]);
            } else if (query.trim().length > 0) {
              setIsOpen(true);
            } else {
              const el = document.getElementById(id);
              el?.focus();
              setIsOpen(true);
            }
          }}
          className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 inline-flex h-10 sm:h-11 items-center justify-center rounded-xl bg-brand-600 px-3.5 sm:px-5 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-brand-500 shadow-xs cursor-pointer"
        >
          {buttonLabel}
        </button>
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-2xl">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-900/[0.06]" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5">
              <p className="text-sm font-medium text-ink-900">
                Couldn&apos;t load colleges. Check your connection. Try again.
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            <ul id="college-listbox" role="listbox" aria-label="Colleges" className="p-2">
              {results.map((college, idx) => (
                <li key={college.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(college)}
                    className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: idx === selectedIndex ? 'var(--primary-soft)' : 'transparent',
                      color: idx === selectedIndex ? 'var(--primary-strong)' : 'var(--ink)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{college.name}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          college.status === 'live'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {college.status === 'live' ? 'Live' : 'Demo'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <p className="text-sm font-medium text-ink-900">
                We&apos;re not live at that college yet. Get early access and we&apos;ll set it up.
              </p>
              <a
                href="#cta"
                onClick={() => setIsOpen(false)}
                className="mt-3 inline-block text-sm font-semibold"
                style={{ color: 'var(--primary)' }}
              >
                Get early access →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
