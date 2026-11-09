"use client";

import React, { useState } from "react";
import type { College } from "@/lib/landing/data";
import {
  DEMO_MANAGER_CLUBS,
  DEMO_CLUB_ROSTER,
  DemoManagerClub,
  DemoMemberRoster,
} from "@/lib/demo/lbrceDemoData";
import {
  Building2,
  Users,
  Calendar,
  Sparkles,
  PlusCircle,
  Clock,
  MapPin,
  CheckCircle2,
  Layers,
  ArrowRight,
  Shield,
} from "lucide-react";

export interface ManagerViewProps {
  college: College;
}

export default function ManagerView({ college }: ManagerViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "clubs" | "roster">("overview");
  const [notice, setNotice] = useState<string | null>(null);

  // Managed club events
  const managedEvents = college.events.filter(
    (e) => e.clubId === "roborangers" || e.clubId === "hacknorth"
  );

  const totalMembers = DEMO_MANAGER_CLUBS.reduce((acc, c) => acc + c.members, 0);

  const handleSimulateNewEvent = () => {
    setNotice("Demo Mode: Event creation modal is simulated. In read-only mode, no database writes are executed.");
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="bg-cream text-warm-ink min-h-screen py-10 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Header Card */}
        <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 sm:p-8 shadow-[6px_6px_0_0_#241209]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-coral text-white grid place-items-center font-display text-2xl font-bold uppercase shadow-sm">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase text-warm-ink">
                    Club Operations Workspace
                  </h1>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                    Lead Manager
                  </span>
                </div>
                <p className="text-xs text-ink-900/60 mt-1">
                  Active Manager: <span className="font-bold text-warm-ink">Rahul Varma</span> · Assigned Clubs: <span className="font-bold text-coral">RoboRangers, HackNorth</span>
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 rounded-2xl border-2 border-warm-ink bg-cream p-1.5 self-start sm:self-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("clubs")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "clubs"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>My Clubs ({DEMO_MANAGER_CLUBS.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "roster"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Member Roster</span>
              </button>
            </div>
          </div>
        </div>

        {/* Notice Toast */}
        {notice && (
          <div className="p-4 rounded-2xl border-2 border-warm-ink bg-amber-50 text-amber-900 flex items-center justify-between text-xs font-bold shadow-[4px_4px_0_0_#241209]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-coral shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-amber-800 hover:text-black font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Metric KPI Cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-900/50">
              Assigned Charters
            </span>
            <p className="mt-2 font-display text-4xl font-bold text-warm-ink">
              {DEMO_MANAGER_CLUBS.length}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              RoboRangers & HackNorth
            </p>
          </div>

          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-900/50">
              Active Members
            </span>
            <p className="mt-2 font-display text-4xl font-bold text-coral">
              {totalMembers}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              Across managed organizations
            </p>
          </div>

          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-900/50">
              Upcoming Events
            </span>
            <p className="mt-2 font-display text-4xl font-bold text-warm-ink">
              {managedEvents.length}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              Published on college lineup
            </p>
          </div>
        </div>

        {/* 1. Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Managed Events Schedule */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase text-warm-ink">
                    Upcoming Managed Lineups
                  </h2>
                  <p className="text-xs text-ink-900/60">
                    Live events organized by your assigned student clubs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateNewEvent}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-warm-ink px-4 py-2 text-xs font-bold uppercase text-cream hover:bg-ink-900 transition-colors shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-coral" />
                  <span>Draft New Event</span>
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {managedEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-warm-ink px-3 py-1 text-[10px] font-bold uppercase text-cream">
                          {e.clubId === "roborangers" ? "RoboRangers" : "HackNorth"}
                        </span>
                        <span className="text-xs font-bold uppercase text-coral">
                          {e.attendees} Registered
                        </span>
                      </div>

                      <h3 className="mt-4 font-display text-xl font-bold uppercase text-warm-ink">
                        {e.title}
                      </h3>
                      <p className="mt-2 text-xs text-ink-900/70 leading-relaxed line-clamp-2">
                        {e.description}
                      </p>

                      <div className="mt-4 rounded-2xl bg-cream p-3 border border-warm-ink/10 space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-ink-900/75">
                          <Calendar className="w-3.5 h-3.5 text-coral shrink-0" />
                          <span>{e.weekday}, {e.month} {e.day} · {e.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-900/75">
                          <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                          <span>{e.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-warm-ink/10 flex items-center justify-between text-xs font-bold">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        RSVP Queue Active
                      </span>
                      <button
                        type="button"
                        onClick={handleSimulateNewEvent}
                        className="text-coral hover:underline"
                      >
                        Manage RSVPs →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. My Clubs Tab */}
        {activeTab === "clubs" && (
          <div className="grid gap-6 md:grid-cols-2">
            {DEMO_MANAGER_CLUBS.map((c) => (
              <div
                key={c.id}
                className="rounded-3xl border-2 border-warm-ink bg-white p-7 shadow-[6px_6px_0_0_#241209] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: c.color }}>
                      {c.category}
                    </span>
                    <span className="rounded-full border border-warm-ink/20 bg-cream px-3 py-1 text-xs font-bold text-warm-ink">
                      {c.members} Members
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-2xl font-bold uppercase text-warm-ink">
                    {c.name}
                  </h3>
                  <p className="mt-1 text-xs text-ink-900/60 font-semibold">{c.tagline}</p>

                  <div className="mt-6 rounded-2xl bg-cream p-4 border border-warm-ink/10 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-900/60">Your Position:</span>
                      <span className="font-bold text-warm-ink">{c.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-900/60">Next Scheduled Event:</span>
                      <span className="font-bold text-coral">{c.nextEvent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-900/60">Pending Proposals:</span>
                      <span className="font-bold text-warm-ink">{c.activeProposals} in review</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-warm-ink/10 flex items-center justify-between">
                  <span className="text-xs text-ink-900/50">Charter valid for 2026-27</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("roster")}
                    className="text-xs font-bold uppercase text-coral hover:underline"
                  >
                    View Roster →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. Member Roster Tab */}
        {activeTab === "roster" && (
          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 sm:p-8 shadow-[6px_6px_0_0_#241209] space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase text-warm-ink">
                Club Member Roster
              </h2>
              <p className="text-xs text-ink-900/60 mt-0.5">
                Official student leads and members for RoboRangers and HackNorth.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-warm-ink/20 pb-3 text-ink-900/50 uppercase tracking-wider text-[10px]">
                    <th className="py-3 pr-4 font-bold">Student Name</th>
                    <th className="py-3 px-4 font-bold">Roll Number</th>
                    <th className="py-3 px-4 font-bold">Dept</th>
                    <th className="py-3 px-4 font-bold">Club Charter</th>
                    <th className="py-3 px-4 font-bold">Position</th>
                    <th className="py-3 pl-4 font-bold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-ink/10">
                  {DEMO_CLUB_ROSTER.map((m) => (
                    <tr key={m.id} className="hover:bg-cream/50 transition-colors">
                      <td className="py-3.5 pr-4 font-bold text-warm-ink">{m.name}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-ink-900/70">{m.rollNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-coral">{m.department}</td>
                      <td className="py-3.5 px-4 font-semibold uppercase">{m.clubId === "roborangers" ? "RoboRangers" : "HackNorth"}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          m.role === "Lead" ? "bg-coral text-white" :
                          m.role === "Vice Lead" ? "bg-warm-ink text-cream" :
                          "bg-cream border border-warm-ink/20 text-warm-ink"
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-ink-900/60 font-medium">{m.joinedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

