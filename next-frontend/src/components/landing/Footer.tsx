import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

import { EMAIL_ADDRESS } from "@/config/site";

export default function Footer() {
  return (
    <footer className="bg-ink-950 text-white/60">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Link
            href="/"
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            aria-label="4 the people home"
          >
            <BrandLogo size="md" variant="light" />
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            The operations platform for student clubs — plan, launch and measure campus life at scale.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Product</h4>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              { label: "How it works", href: "#steps" },
              { label: "Before & after", href: "#before-after" },
              { label: "Admin trust", href: "#admin-trust" },
              { label: "Live feed", href: "#live-feed" },
            ].map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Colleges</h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <Link href="/college/lbrce" className="transition-colors hover:text-white">
                LBRCE
              </Link>
            </li>
            {["Northwood University", "Crestview College", "Bellavista Institute", "Westbrook University"].map((l) => (
              <li key={l}>
                <Link href={`/demo/${l.split(" ")[0].toLowerCase()}`} className="transition-colors hover:text-white">
                  {l} <span className="text-white/40">(demo)</span>
                </Link>
              </li>
            ))}
            <li className="pt-2 border-t border-white/10">
              <Link href="/directory" className="font-semibold text-white/90 transition-colors hover:text-white">
                All colleges →
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              {/* TODO: replace with real domain/email */}
              <a href={`mailto:${EMAIL_ADDRESS}`} className="transition-colors hover:text-white">
                {EMAIL_ADDRESS}
              </a>
            </li>
            <li>
              <a href="#cta" className="transition-colors hover:text-white">
                Book a 15-minute setup call
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm lg:flex-row lg:px-8">
          <p>© 2026 4 the people. Built for the people who run the parties.</p>
          <p>Made with ♥ for student orgs everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
