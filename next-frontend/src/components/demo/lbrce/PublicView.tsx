"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { College } from "@/lib/landing/data";
import CampusNav from "@/components/campus/CampusNav";
import CampusHero from "@/components/campus/CampusHero";
import Marquee from "@/components/campus/Marquee";
import EventsCarousel from "@/components/campus/EventsCarousel";
import SpotlightEvent from "@/components/campus/SpotlightEvent";
import ClubsSection from "@/components/campus/ClubsSection";
import CampusCTA from "@/components/campus/CampusCTA";
import { LBRCE_DEPARTMENTS, DemoDepartment } from "@/lib/demo/lbrceDemoData";
import { Building2, Users, Layers, ArrowUpRight, GraduationCap } from "lucide-react";

export interface PublicViewProps {
  college: College;
  onSelectRole?: (role: "student" | "manager" | "admin") => void;
}

export default function PublicView({ college, onSelectRole }: PublicViewProps) {
  const [selectedDept, setSelectedDept] = useState<DemoDepartment | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-cream text-warm-ink">
      <CampusNav college={college} />

      <main className="flex-1">
        <CampusHero college={college} />
        <Marquee />

        {/* 1. Lineup Carousel */}
        <section id="lineup" className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <EventsCarousel college={college} />
        </section>

        {/* 2. Spotlight Event */}
        <SpotlightEvent college={college} />

        {/* 3. Clubs Directory Section */}
        <ClubsSection collegeId={college.slug} />

        {/* 4. Academic Departments Section (From Real LBRCE Structure) */}
        <section id="departments" className="border-t-2 border-dashed border-warm-ink/15 bg-cream px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: college.accent }}>
                  Academic Divisions
                </p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-warm-ink sm:text-5xl uppercase">
                  Departments & Chapters
                </h2>
                <p className="mt-3 max-w-xl text-ink-900/70 text-sm sm:text-base leading-relaxed">
                  Academic divisions across {college.name} anchor active departmental clubs, student hackathons, and technical symposiums.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border-2 border-warm-ink bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-warm-ink shadow-[2px_2px_0_0_#241209]">
                  {LBRCE_DEPARTMENTS.length} Accredited Depts
                </span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {LBRCE_DEPARTMENTS.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDept(dept)}
                  className="group rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] transition-all hover:-translate-x-1 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-xl border border-warm-ink/20 bg-cream px-3 py-1 text-xs font-black uppercase tracking-wider text-warm-ink">
                        {dept.shortCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-coral uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" />
                        {dept.studentCount}+ Students
                      </span>
                    </div>

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-warm-ink group-hover:text-coral transition-colors">
                      {dept.name}
                    </h3>

                    <p className="mt-2 text-xs text-ink-900/65 line-clamp-3 leading-relaxed">
                      {dept.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-warm-ink/10 flex items-center justify-between text-xs font-bold text-warm-ink">
                    <span className="flex items-center gap-1.5 text-ink-900/60">
                      <Building2 className="w-3.5 h-3.5" />
                      {dept.clubCount} Clubs Associated
                    </span>
                    <span className="inline-flex items-center gap-1 text-coral uppercase tracking-wider text-[11px] group-hover:translate-x-1 transition-transform">
                      <span>Explore</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Role Switcher Callout Banner (Prompt to try Student / Manager / Admin views) */}
        {onSelectRole && (
          <section className="bg-warm-ink text-cream px-6 py-16 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="rounded-3xl border border-cream/20 bg-cream/5 p-8 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-coral bg-coral/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-coral">
                    ★ Interactive Demo
                  </span>
                  <h3 className="mt-4 font-campus text-3xl sm:text-4xl uppercase tracking-tight text-cream">
                    Explore Authenticated Portals (No Login Required)
                  </h3>
                  <p className="mt-3 text-sm text-cream/75 leading-relaxed">
                    Test the complete student experience, manager operations workspace, or the college admin command center in read-only sandbox mode.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectRole("student")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-warm-ink transition-all hover:bg-cream hover:scale-105 cursor-pointer shadow-md"
                  >
                    <GraduationCap className="w-4 h-4 text-coral" />
                    <span>Student View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectRole("manager")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:opacity-95 hover:scale-105 cursor-pointer shadow-md"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Club Manager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectRole("admin")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cream/30 bg-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-cream transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-coral" />
                    <span>College Admin</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <CampusCTA />
      </main>

      {/* Department Detail Modal (Sample detail preview) */}
      {selectedDept && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedDept(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border-2 border-warm-ink bg-white p-7 text-warm-ink shadow-[8px_8px_0_0_#241209]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-lg border border-warm-ink/20 bg-cream px-3 py-1 text-xs font-black uppercase text-warm-ink">
                  {selectedDept.shortCode}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold uppercase text-warm-ink">
                  {selectedDept.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-warm-ink/20 bg-cream text-warm-ink font-bold hover:bg-warm-ink hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="mt-4 text-sm text-ink-900/70 leading-relaxed">
              {selectedDept.description}
            </p>

            <div className="mt-6 rounded-2xl bg-cream p-4 border border-warm-ink/10 space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-ink-900/60">Enrolled Undergraduates:</span>
                <span className="font-bold text-warm-ink">{selectedDept.studentCount} students</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-900/60">Chartered Student Clubs:</span>
                <span className="font-bold text-warm-ink">{selectedDept.clubCount} active clubs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-900/60">Affiliated Clubs:</span>
                <span className="font-bold text-coral">{selectedDept.associatedClubs.join(", ")}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className="rounded-xl bg-warm-ink px-5 py-2.5 text-xs font-bold uppercase text-cream hover:bg-ink-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

