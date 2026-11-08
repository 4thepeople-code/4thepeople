import React from 'react';
import type { Metadata } from 'next';
import PublicLayout from '@/components/public/PublicLayout';
import {
  Sparkles,
  Building2,
  Calendar,
  Users,
  Compass,
  ArrowUpRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: '4 THE PEOPLE | Campus Clubs & Event Directory',
  description:
    'Discover collegiate student clubs, technical hackathons, cultural festivals, and community initiatives across partner institutions.',
  alternates: {
    canonical: 'https://4thepeople.in',
  },
  openGraph: {
    title: '4 THE PEOPLE | Student Campus Events & Clubs',
    description:
      'Collegiate student activity portal connecting verified institutions, student leadership, and campus event schedules.',
    type: 'website',
    url: 'https://4thepeople.in',
  },
};

const partnerColleges = [
  {
    slug: 'lbrce',
    name: 'Lakireddy Bali Reddy College of Engineering',
    shortName: 'LBRCE',
    location: 'Mylavaram, AP',
    clubsCount: '20+ Clubs',
    eventsCount: '15+ Events',
    coverImage:
      'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=800&auto=format&fit=crop',
    accent: '#00F0FF',
  },
  {
    slug: 'vrsec',
    name: 'Velagapudi Ramakrishna Siddhartha Engineering College',
    shortName: 'VRSEC',
    location: 'Vijayawada, AP',
    clubsCount: '18+ Clubs',
    eventsCount: '12+ Events',
    coverImage:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800&auto=format&fit=crop',
    accent: '#3B82F6',
  },
];

export default function PublicDirectoryPage() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-16 md:pb-24 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-purple-500/8 to-pink-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Collegiate Student Life Platform</span>
          </div>

          <h1 className="font-['Syne',sans-serif] text-4xl sm:text-6xl lg:text-7xl font-extrabold uppercase tracking-tight text-[#0F172A] dark:text-white leading-[1.02] max-w-4xl mx-auto">
            WHERE CAMPUS CLUBS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-teal-400 to-[#3B82F6]">
              COME ALIVE.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg max-w-2xl mx-auto text-slate-600 dark:text-gray-300 font-normal leading-relaxed">
            Discover student organizations, technical chapters, and vibrant campus events across registered partner institutions.
          </p>
        </div>
      </section>

      {/* Partner Colleges Directory Grid */}
      <section className="py-12 md:py-16 bg-white/50 dark:bg-[#0F1117] border-y border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-6 border-b border-slate-200 dark:border-white/10 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-2">
                <Building2 className="w-3.5 h-3.5" />
                <span>Partner Institutions</span>
              </div>
              <h2 className="font-['Syne',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#0F172A] dark:text-white">
                SELECT YOUR <span className="text-cyan-500">CAMPUS</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 max-w-sm">
              Each institution operates an isolated tenant portal with dedicated event calendars and student rosters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {partnerColleges.map((col) => {
              const devUrl = `http://${col.slug}.localhost:3000`;
              return (
                <div
                  key={col.slug}
                  className="group relative rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141C] shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    <img
                      src={col.coverImage}
                      alt={col.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-widest text-[#00F0FF]">
                        {col.shortName}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                      <span className="font-semibold text-cyan-200">{col.location}</span>
                      <span className="text-[11px] font-mono text-gray-300">{col.eventsCount}</span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-['Syne',sans-serif] text-2xl font-bold uppercase tracking-tight text-[#0F172A] dark:text-white group-hover:text-cyan-500 transition-colors">
                        {col.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-gray-300 mt-1 leading-relaxed">
                        Access official student activities, departmental clubs, and live event registrations for {col.shortName}.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{col.clubsCount}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          <span>{col.eventsCount}</span>
                        </span>
                      </div>

                      <a
                        href={devUrl}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm"
                      >
                        <span>Open Portal</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Platform Architecture Highlights */}
      <section className="py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141C]">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-[#00F0FF] flex items-center justify-center mb-4">
              <Compass className="w-5 h-5 text-cyan-500" />
            </div>
            <h3 className="font-['Syne',sans-serif] text-xl font-bold uppercase text-[#0F172A] dark:text-white mb-2">
              Multi-Subdomain Isolation
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
              Every college campus operates under its own verified subdomain with strict PostgreSQL Row-Level Security tenant isolation.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141C]">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-['Syne',sans-serif] text-xl font-bold uppercase text-[#0F172A] dark:text-white mb-2">
              Live RSVP & Ticketing
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
              Real-time seat capacity enforcement, student roster verification, and instant confirmation for workshops and hackathons.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141C]">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-['Syne',sans-serif] text-xl font-bold uppercase text-[#0F172A] dark:text-white mb-2">
              Student Leadership
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
              Student managers can publish events, manage registrations, track attendance, and curate club galleries effortlessly.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
