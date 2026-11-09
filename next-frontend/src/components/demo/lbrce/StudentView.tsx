"use client";

import React, { useState } from "react";
import type { College } from "@/lib/landing/data";
import {
  DEMO_STUDENT_PROFILE,
  INITIAL_DEMO_TICKETS,
  DemoTicket,
} from "@/lib/demo/lbrceDemoData";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  User,
  Search,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Sparkles,
  QrCode,
  AlertCircle,
  Building2,
  X,
} from "lucide-react";

export interface StudentViewProps {
  college: College;
}

export default function StudentView({ college }: StudentViewProps) {
  const [activeTab, setActiveTab] = useState<"registrations" | "discover" | "profile">("registrations");
  const [tickets, setTickets] = useState<DemoTicket[]>(INITIAL_DEMO_TICKETS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedTicket, setSelectedTicket] = useState<DemoTicket | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filter events from college.events
  const filteredEvents = college.events.filter((ev) => {
    const q = searchQuery.toLowerCase().trim();
    const club = college.clubs.find((c) => c.id === ev.clubId);
    const matchesSearch =
      !q ||
      ev.title.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      ev.location.toLowerCase().includes(q) ||
      club?.name.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "ALL" ||
      club?.category.toUpperCase() === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ["ALL", "ROBOTICS", "MUSIC", "DEBATE", "DANCE", "CINEMA", "HACKATHON"];

  const handleSimulateCancel = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, status: "CANCELLED" } : t))
    );
    setFeedbackMessage("Simulated RSVP cancellation. In Demo Mode, no database record was modified.");
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleSimulateRegister = (event: typeof college.events[0]) => {
    const club = college.clubs.find((c) => c.id === event.clubId);
    const existing = tickets.find((t) => t.eventId === event.id);

    if (existing && existing.status === "CONFIRMED") {
      setFeedbackMessage(`You are already registered for ${event.title}!`);
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    const newTicket: DemoTicket = {
      ticketId: `TKT-LBRCE-${Math.floor(1000 + Math.random() * 9000)}`,
      eventId: event.id,
      eventTitle: event.title,
      clubName: club?.name || "Campus Club",
      date: `${event.weekday}, ${event.month} ${event.day}, 2026`,
      time: event.time,
      venue: event.location,
      status: "CONFIRMED",
      registeredAt: "Just now (Demo)",
    };

    setTickets((prev) => [newTicket, ...prev.filter((t) => t.eventId !== event.id)]);
    setFeedbackMessage(`🎉 Registration simulated for ${event.title}! Your demo ticket is ready.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  return (
    <div className="bg-cream text-warm-ink min-h-screen py-10 px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Header Card */}
        <div className="rounded-3xl border-2 border-warm-ink bg-white p-6 sm:p-8 shadow-[6px_6px_0_0_#241209]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-warm-ink text-cream grid place-items-center font-display text-2xl font-bold uppercase shadow-sm">
                {DEMO_STUDENT_PROFILE.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase text-warm-ink">
                    {DEMO_STUDENT_PROFILE.name}
                  </h1>
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                    Active Student
                  </span>
                </div>
                <p className="text-xs text-ink-900/60 mt-1">
                  Roll No: <span className="font-mono font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.rollNumber}</span> · {DEMO_STUDENT_PROFILE.department}
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1.5 rounded-2xl border-2 border-warm-ink bg-cream p-1.5 self-start sm:self-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("registrations")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "registrations"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>My RSVPs ({tickets.filter((t) => t.status === "CONFIRMED").length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("discover")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "discover"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Discover Events</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-warm-ink text-cream shadow-xs"
                    : "text-ink-900/70 hover:text-warm-ink hover:bg-white"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Student ID</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackMessage && (
          <div className="p-4 rounded-2xl border-2 border-warm-ink bg-amber-50 text-amber-900 flex items-center justify-between text-xs font-bold shadow-[4px_4px_0_0_#241209]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-coral shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-amber-800 hover:text-black font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. My Registrations Tab */}
        {activeTab === "registrations" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-warm-ink">
                  Event Passes & Registrations
                </h2>
                <p className="text-xs text-ink-900/60 mt-0.5">
                  Your official passes with verification QR codes for LBRCE campus activities.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((t) => (
                <div
                  key={t.ticketId}
                  className={`rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] flex flex-col justify-between transition-all ${
                    t.status === "CANCELLED" ? "opacity-60 bg-gray-50" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold uppercase text-coral">
                        {t.ticketId}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          t.status === "CONFIRMED"
                            ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border border-rose-300 bg-rose-50 text-rose-800"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <h3 className="mt-3 font-display text-xl font-bold uppercase text-warm-ink line-clamp-1">
                      {t.eventTitle}
                    </h3>
                    <p className="text-xs text-ink-900/60 font-semibold mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-coral" />
                      {t.clubName}
                    </p>

                    <div className="mt-4 rounded-2xl bg-cream p-3 border border-warm-ink/10 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-ink-900/80">
                        <Calendar className="w-3.5 h-3.5 text-coral shrink-0" />
                        <span className="font-medium truncate">{t.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink-900/80">
                        <Clock className="w-3.5 h-3.5 text-coral shrink-0" />
                        <span className="font-medium truncate">{t.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink-900/80">
                        <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                        <span className="font-medium truncate">{t.venue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-warm-ink/10 flex items-center gap-2">
                    {t.status === "CONFIRMED" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(t)}
                          className="flex-1 rounded-xl bg-warm-ink py-2 text-xs font-bold uppercase text-cream flex items-center justify-center gap-1.5 hover:bg-ink-900 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View Ticket</span>
                        </button>
                        <button
                          type="button"
                          title="Simulate Cancel RSVP"
                          onClick={() => handleSimulateCancel(t.ticketId)}
                          className="rounded-xl border border-rose-300 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-ink-900/50 italic py-2">
                        RSVP cancelled for this event.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Discover Events Tab */}
        {activeTab === "discover" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-warm-ink">
                  Upcoming Campus Events
                </h2>
                <p className="text-xs text-ink-900/60 mt-0.5">
                  Browse official workshops, hackathons, and cultural fests scheduled at LBRCE.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events or clubs..."
                  className="w-full rounded-2xl border-2 border-warm-ink bg-white py-2 pl-9 pr-4 text-xs font-semibold focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-ink-900/40 absolute left-3 top-2.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-xs text-ink-900/50"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border ${
                    selectedCategory === cat
                      ? "bg-warm-ink text-cream border-warm-ink"
                      : "bg-white text-ink-900/70 border-warm-ink/20 hover:border-warm-ink"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Events Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => {
                const club = college.clubs.find((c) => c.id === ev.clubId);
                const isRegistered = tickets.some(
                  (t) => t.eventId === ev.id && t.status === "CONFIRMED"
                );

                return (
                  <div
                    key={ev.id}
                    className="rounded-3xl border-2 border-warm-ink bg-white p-6 shadow-[6px_6px_0_0_#241209] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: club?.color || "#ff5a3c" }}
                        >
                          {club?.category}
                        </span>
                        <span className="font-display text-sm font-bold uppercase text-ink-900/40">
                          {ev.month} {ev.day}
                        </span>
                      </div>

                      <h3 className="mt-3 font-display text-xl font-bold uppercase text-warm-ink">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-ink-900/60 font-semibold mt-0.5">
                        Host: {club?.name}
                      </p>

                      <p className="mt-3 text-xs text-ink-900/70 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>

                      <div className="mt-4 rounded-2xl bg-cream p-3 border border-warm-ink/10 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-ink-900/75">
                          <Clock className="w-3.5 h-3.5 text-coral shrink-0" />
                          <span>{ev.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-900/75">
                          <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                          <span>{ev.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-warm-ink/10">
                      {isRegistered ? (
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 px-3 text-center text-xs font-bold uppercase text-emerald-800 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>RSVP Confirmed</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSimulateRegister(ev)}
                          className="w-full rounded-xl bg-coral py-2.5 px-4 text-xs font-bold uppercase text-white hover:bg-secondary transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                          <span>Simulate Register</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Student Profile Tab */}
        {activeTab === "profile" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-3xl border-2 border-warm-ink bg-white p-8 shadow-[8px_8px_0_0_#241209]">
              <div className="flex items-center justify-between border-b border-warm-ink/15 pb-6 mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-coral">
                    Student Profile Record
                  </span>
                  <h2 className="font-display text-3xl font-bold uppercase text-warm-ink mt-1">
                    {DEMO_STUDENT_PROFILE.name}
                  </h2>
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-warm-ink bg-cream font-display text-2xl font-bold text-warm-ink">
                  {DEMO_STUDENT_PROFILE.name.charAt(0)}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs font-semibold">
                <div className="rounded-2xl border border-warm-ink/15 bg-cream p-4">
                  <p className="text-[10px] uppercase text-ink-900/50">University Roll Number</p>
                  <p className="mt-1 font-mono text-sm font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.rollNumber}</p>
                </div>

                <div className="rounded-2xl border border-warm-ink/15 bg-cream p-4">
                  <p className="text-[10px] uppercase text-ink-900/50">Official Student Email</p>
                  <p className="mt-1 font-mono text-sm font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.email}</p>
                </div>

                <div className="rounded-2xl border border-warm-ink/15 bg-cream p-4">
                  <p className="text-[10px] uppercase text-ink-900/50">Academic Department</p>
                  <p className="mt-1 text-sm font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.department}</p>
                </div>

                <div className="rounded-2xl border border-warm-ink/15 bg-cream p-4">
                  <p className="text-[10px] uppercase text-ink-900/50">Current Cohort</p>
                  <p className="mt-1 text-sm font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.year} · {DEMO_STUDENT_PROFILE.section}</p>
                </div>

                <div className="rounded-2xl border border-warm-ink/15 bg-cream p-4 sm:col-span-2">
                  <p className="text-[10px] uppercase text-ink-900/50">Affiliated Institution</p>
                  <p className="mt-1 text-sm font-bold text-warm-ink">{DEMO_STUDENT_PROFILE.college}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-warm-ink/15 flex items-center justify-between text-xs text-ink-900/60">
                <span>Account Status: <strong className="text-emerald-700">{DEMO_STUDENT_PROFILE.status}</strong></span>
                <span>Enrolled: {DEMO_STUDENT_PROFILE.joinedDate}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket QR Modal */}
      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border-2 border-warm-ink bg-white p-7 text-warm-ink shadow-[8px_8px_0_0_#241209] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-xs font-bold text-coral">
                {selectedTicket.ticketId}
              </span>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="text-warm-ink font-bold hover:text-coral"
              >
                ✕
              </button>
            </div>

            <div className="aspect-square w-48 mx-auto rounded-2xl border-2 border-dashed border-warm-ink/30 bg-cream flex flex-col items-center justify-center p-4">
              <QrCode className="w-24 h-24 text-warm-ink" />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-900/60">
                Scan for Campus Check-in
              </p>
            </div>

            <h3 className="mt-4 font-display text-xl font-bold uppercase text-warm-ink">
              {selectedTicket.eventTitle}
            </h3>
            <p className="text-xs text-ink-900/60 mt-1">
              Host: {selectedTicket.clubName}
            </p>

            <div className="mt-4 text-xs font-semibold text-ink-900/80 space-y-1">
              <p>{selectedTicket.date} · {selectedTicket.time}</p>
              <p>{selectedTicket.venue}</p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="mt-6 w-full rounded-xl bg-warm-ink py-2.5 text-xs font-bold uppercase text-cream hover:bg-ink-900 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

