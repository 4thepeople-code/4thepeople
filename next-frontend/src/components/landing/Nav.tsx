"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND_NAME } from "@/lib/landing/constants";
import BrandLogo from "@/components/BrandLogo";

const links = [
  { href: "/", label: "Home" },
  { href: "#colleges", label: "Colleges" },
  { href: "#steps", label: "How it works" },
  { href: "#live-feed", label: "Events" },
  { href: "#cta", label: "Contact" },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile panel on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 motion-reduce:transition-none ${
        solid
          ? "border-[var(--line)] bg-[var(--bg)]/85 shadow-[0_1px_12px_rgba(7,11,24,0.07)] backdrop-blur-md"
          : "border-transparent bg-transparent shadow-none backdrop-blur-none"
      }`}
    >
      <div
        className={`mx-auto flex h-16 max-w-7xl items-center justify-between px-6 transition-[padding] duration-200 motion-reduce:transition-none lg:px-8 ${
          solid ? "py-3" : "py-4"
        }`}
      >
        <Link
          href="/"
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg"
          aria-label={`${BRAND_NAME} home`}
        >
          <BrandLogo size="md" variant="dark" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="py-2 text-sm font-medium transition-colors hover:text-[var(--ink)]"
              style={{ color: "var(--ink-soft)" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hardcoded to LBRCE until more colleges go live */}
          <Link
            href="/college/lbrce/login"
            className="inline-flex h-11 items-center justify-center rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors hover:text-[var(--primary)] sm:px-4 sm:text-sm"
            style={{ color: "var(--ink)" }}
          >
            Log in
          </Link>

          <Link
            href="#cta"
            className="inline-flex h-11 items-center justify-center rounded-xl px-3.5 text-[13px] font-semibold text-white transition-colors sm:px-5 sm:text-sm"
            style={{ backgroundColor: "var(--primary)" }}
          >
            List your campus
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="grid h-11 w-11 place-items-center rounded-xl border md:hidden"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span className={`h-0.5 w-5 transition-transform ${open ? "rotate-45 translate-y-[7px]" : ""}`} style={{ backgroundColor: "var(--ink)" }} />
              <span className={`h-0.5 w-5 transition-opacity ${open ? "opacity-0" : ""}`} style={{ backgroundColor: "var(--ink)" }} />
              <span className={`h-0.5 w-5 transition-transform ${open ? "rotate-[-45deg] translate-y-[-7px]" : ""}`} style={{ backgroundColor: "var(--ink)" }} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile panel: renders directly under the header, pinned with it */}
      {open && (
        <div
          id="mobile-menu"
          className="border-t md:hidden"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium"
                style={{ color: "var(--ink-soft)" }}
              >
                {l.label}
              </a>
            ))}
            {/* Hardcoded to LBRCE until more colleges go live */}
            <Link
              href="/college/lbrce/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-semibold"
              style={{ color: "var(--primary)" }}
            >
              Log in →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

