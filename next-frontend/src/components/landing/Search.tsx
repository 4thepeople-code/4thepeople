"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colleges } from "@/lib/landing/data";

interface SearchProps {
  id?: string;
  buttonLabel?: string;
}

export default function Search({ id = "college-search", buttonLabel = "Find your college" }: SearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; slug: string; status: "live" | "demo"; homepageUrl: string }[]>([]);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        await new Promise((res) => setTimeout(res, 150));
        const matches = colleges
          .filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => ({ name: c.name, slug: c.slug, status: c.status, homepageUrl: c.homepageUrl }));
        setResults(matches);
        setLoading(false);
        setError(false);
        setActive(-1);
      } catch {
        setLoading(false);
        setError(true);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, retryCount]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (college: { name: string; slug: string; status: "live" | "demo"; homepageUrl: string }) => {
    setSelected(college.name);
    setOpen(false);
    setQuery("");
    if (college.homepageUrl.startsWith("http")) {
      window.location.href = college.homepageUrl;
    } else {
      router.push(college.homepageUrl);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active >= 0 ? active : 0];
      if (target) choose(target);
    }
    if (e.key === "Escape") {
      setOpen(false);
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
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by college name…"
          autoComplete="off"
          className="w-full rounded-2xl border border-ink-900/10 bg-white py-3.5 sm:py-4 pl-11 sm:pl-12 pr-40 sm:pr-44 text-sm sm:text-base text-ink-950 placeholder:text-ink-900/40 shadow-[0_1px_3px_rgb(10_17_40/0.06)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => {
            if (results.length > 0) {
              choose(results[active >= 0 ? active : 0]);
            } else if (query.trim().length > 0) {
              setOpen(true);
            } else {
              const el = document.getElementById(id);
              el?.focus();
              setOpen(true);
            }
          }}
          className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 inline-flex h-10 sm:h-11 items-center justify-center rounded-xl bg-brand-600 px-3.5 sm:px-5 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-brand-500 shadow-xs cursor-pointer"
        >
          {buttonLabel}
        </button>
      </div>

      {open && !selected && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-2xl">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-900/[0.06]" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5">
              <p className="text-sm font-medium text-ink-900">Couldn&apos;t load colleges. Check your connection. Try again.</p>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--primary)" }}
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            <ul id="college-listbox" role="listbox" aria-label="Colleges" className="p-2">
              {results.map((c, i) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: i === active ? "var(--primary-soft)" : "transparent",
                      color: i === active ? "var(--primary-strong)" : "var(--ink)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{c.name}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          c.status === "live"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : "bg-amber-100 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {c.status === "live" ? "Live" : "Demo"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !loading && (
              <div className="p-5">
                <p className="text-sm font-medium text-ink-900">We&apos;re not live at that college yet. Get early access and we&apos;ll set it up.</p>
                <a
                  href="#cta"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-sm font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  Get early access →
                </a>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

