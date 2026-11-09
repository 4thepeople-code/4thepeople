"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { College } from "@/lib/landing/data";
import PublicView from "./lbrce/PublicView";
import StudentView from "./lbrce/StudentView";
import ManagerView from "./lbrce/ManagerView";
import AdminView from "./lbrce/AdminView";
import {
  Globe,
  GraduationCap,
  Building2,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export type DemoViewMode = "public" | "student" | "manager" | "admin";

export interface LbrceDemoDashboardProps {
  college: College;
  initialView?: DemoViewMode;
}

export default function LbrceDemoDashboard({
  college,
  initialView = "public",
}: LbrceDemoDashboardProps) {
  const [activeView, setActiveView] = useState<DemoViewMode>(initialView);

  return (
    <div className="min-h-screen flex flex-col bg-cream text-warm-ink selection:bg-coral selection:text-white">
      {/* 🔴 Top Demo Banner & View Switcher */}
      <aside aria-label="Demo mode navigation" className="sticky top-0 z-50 w-full border-b-2 border-warm-ink bg-white/95 px-4 py-3 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Left: Demo Badge and College Info */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden />
              Demo Mode
            </span>
            <div className="hidden sm:block">
              <span className="text-xs font-bold uppercase tracking-wide text-warm-ink">
                {college.name}
              </span>
              <span className="text-[11px] text-ink-900/60 ml-2">
                (Read-Only · No Login Required)
              </span>
            </div>
          </div>

          {/* Center: Interactive Role / View Switcher */}
          <nav aria-label="Demo views" className="flex items-center gap-1 rounded-2xl border-2 border-warm-ink bg-cream p-1 text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveView("public")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeView === "public"
                  ? "bg-warm-ink text-cream shadow-xs"
                  : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Public Portal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("student")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeView === "student"
                  ? "bg-warm-ink text-cream shadow-xs"
                  : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student View</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("manager")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeView === "manager"
                  ? "bg-warm-ink text-cream shadow-xs"
                  : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Manager</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("admin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeView === "admin"
                  ? "bg-warm-ink text-cream shadow-xs"
                  : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </nav>

          {/* Right: Back to Landing link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-warm-ink/20 bg-cream px-3 py-1.5 text-xs font-bold uppercase text-warm-ink hover:bg-warm-ink hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Landing</span>
          </Link>
        </div>
      </aside>

      {/* 🔴 Active View Container */}
      <main className="flex-1">
        {activeView === "public" && (
          <PublicView
            college={college}
            onSelectRole={(role) => setActiveView(role)}
          />
        )}
        {activeView === "student" && <StudentView college={college} />}
        {activeView === "manager" && <ManagerView college={college} />}
        {activeView === "admin" && <AdminView college={college} />}
      </main>
    </div>
  );
}

