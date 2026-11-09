"use client";

import React, { useState } from "react";
import type { College } from "@/lib/landing/data";
import {
  DEMO_ADMIN_OVERVIEW,
  DEMO_AUDIT_LOG,
  LBRCE_DEPARTMENTS,
} from "@/lib/demo/lbrceDemoData";
import {
  ShieldAlert,
  Users,
  Building2,
  Calendar,
  UserPlus,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Shield,
  FileCheck,
} from "lucide-react";

export interface AdminViewProps {
  college: College;
}

export default function AdminView({ college }: AdminViewProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteClub, setInviteClub] = useState(college.clubs[0]?.name || "RoboRangers");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSimulateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    setInviteModalOpen(false);
    setToastMessage(`Simulated manager invitation dispatched to ${inviteEmail} for ${inviteClub}. (Read-Only Demo: No database record written)`);
    setInviteEmail("");
    setInviteName("");
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="bg-cream text-warm-ink min-h-screen py-10 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Header Banner */}
        <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 sm:p-8 shadow-[6px_6px_0_0_#241209]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-warm-ink text-cream grid place-items-center font-display text-2xl font-bold uppercase shadow-sm">
                <Shield className="w-8 h-8 text-coral" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase text-warm-ink">
                    College Admin Command Center
                  </h1>
                  <span className="rounded-full border border-purple-300 bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-800">
                    Full Authority
                  </span>
                </div>
                <p className="text-xs text-ink-900/60 mt-1">
                  Tenant: <span className="font-bold text-warm-ink">Lakireddy Bali Reddy College of Engineering (LBRCE)</span> · Domain: <span className="font-mono text-coral">lbrce.ac.in</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-secondary transition-all hover:scale-105 cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Manager</span>
            </button>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="p-4 rounded-2xl border-2 border-warm-ink bg-emerald-50 text-emerald-900 flex items-center justify-between text-xs font-bold shadow-[4px_4px_0_0_#241209]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-800 hover:text-black font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Metric KPI Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <div className="flex items-center justify-between text-ink-900/50">
              <span className="text-[10px] font-bold uppercase tracking-wider">Students</span>
              <Users className="w-4 h-4 text-coral" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-warm-ink">
              {DEMO_ADMIN_OVERVIEW.totalStudents.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              Verified LBRCE accounts
            </p>
          </div>

          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <div className="flex items-center justify-between text-ink-900/50">
              <span className="text-[10px] font-bold uppercase tracking-wider">Active Clubs</span>
              <Building2 className="w-4 h-4 text-coral" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-coral">
              {college.clubs.length}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              Chartered organizations
            </p>
          </div>

          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <div className="flex items-center justify-between text-ink-900/50">
              <span className="text-[10px] font-bold uppercase tracking-wider">Club Managers</span>
              <UserPlus className="w-4 h-4 text-coral" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-warm-ink">
              {DEMO_ADMIN_OVERVIEW.clubManagers}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              Student & faculty leads
            </p>
          </div>

          <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[5px_5px_0_0_#241209]">
            <div className="flex items-center justify-between text-ink-900/50">
              <span className="text-[10px] font-bold uppercase tracking-wider">Semester Events</span>
              <Calendar className="w-4 h-4 text-coral" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-warm-ink">
              {DEMO_ADMIN_OVERVIEW.eventsThisSemester}
            </p>
            <p className="mt-1 text-xs text-ink-900/60 font-medium">
              {DEMO_ADMIN_OVERVIEW.totalRegistrations} total RSVPs
            </p>
          </div>
        </div>

        {/* 2-Column Section: Chartered Clubs & Audit Activity */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Chartered Clubs Table */}
          <div className="lg:col-span-7 rounded-3xl border-2 border-warm-ink bg-white p-6 sm:p-7 shadow-[6px_6px_0_0_#241209] space-y-4">
            <div className="flex items-center justify-between border-b border-warm-ink/10 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold uppercase text-warm-ink">
                  Chartered Campus Clubs
                </h2>
                <p className="text-xs text-ink-900/60">
                  Approved organizations operating at LBRCE.
                </p>
              </div>
              <span className="text-xs font-bold text-coral">
                {college.clubs.length} Clubs
              </span>
            </div>

            <div className="divide-y divide-warm-ink/10">
              {college.clubs.map((c) => (
                <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl font-display text-lg font-bold text-white uppercase"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name.charAt(0)}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-warm-ink uppercase">{c.name}</h3>
                      <p className="text-[11px] text-ink-900/50 font-semibold">{c.category} · {c.members} members</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                      Chartered
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Institutional Audit Stream & Divisions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Audit Stream */}
            <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] space-y-4">
              <div className="border-b border-warm-ink/10 pb-3">
                <h3 className="font-display text-lg font-bold uppercase text-warm-ink">
                  Campus Activity Log
                </h3>
                <p className="text-[11px] text-ink-900/60">
                  Real-time club charter and event dispatches.
                </p>
              </div>

              <div className="space-y-3">
                {DEMO_AUDIT_LOG.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-cream p-3 border border-warm-ink/10 text-xs">
                    <p className="font-semibold text-warm-ink">{log.text}</p>
                    <span className="mt-1 block font-mono text-[10px] text-ink-900/50">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Summary Badge Strip */}
            <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] space-y-3">
              <h3 className="font-display text-lg font-bold uppercase text-warm-ink">
                Affiliated Departments
              </h3>
              <div className="flex flex-wrap gap-2">
                {LBRCE_DEPARTMENTS.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-xl border border-warm-ink/20 bg-cream px-3 py-1 text-xs font-bold uppercase text-warm-ink"
                  >
                    {d.shortCode} ({d.clubCount} Clubs)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Manager Modal */}
      {inviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border-2 border-warm-ink bg-white p-7 text-warm-ink shadow-[8px_8px_0_0_#241209]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-warm-ink/10 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
                  Demo Simulated Action
                </span>
                <h3 className="font-display text-2xl font-bold uppercase text-warm-ink mt-0.5">
                  Invite Club Manager
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-warm-ink font-bold hover:text-coral"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-ink-900/70 mb-1">
                  Manager Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Dr. K. Srinivasa Rao"
                  className="w-full rounded-xl border-2 border-warm-ink bg-cream p-2.5 text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink-900/70 mb-1">
                  Institutional Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="manager@lbrce.ac.in"
                  className="w-full rounded-xl border-2 border-warm-ink bg-cream p-2.5 text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink-900/70 mb-1">
                  Assign Club Charter
                </label>
                <select
                  value={inviteClub}
                  onChange={(e) => setInviteClub(e.target.value)}
                  className="w-full rounded-xl border-2 border-warm-ink bg-cream p-2.5 text-xs font-semibold focus:outline-hidden"
                >
                  {college.clubs.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl border border-warm-ink/15 bg-amber-50 text-[11px] text-amber-900 leading-snug">
                🔒 <strong>Read-Only Demo:</strong> Submitting will simulate sending an invitation token without executing any backend database mutations.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-xl border border-warm-ink/30 px-4 py-2 text-xs font-bold uppercase text-ink-900 hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-coral px-5 py-2 text-xs font-bold uppercase text-white hover:bg-secondary shadow-sm"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

