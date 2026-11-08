'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMyClubsQuery, fetchClubDashboard, fetchManagedClubEvents } from '@/lib/api/manager';
import type { Club, Event } from '@/types/models';
import ManagerLayout from '@/components/manager/ManagerLayout';
import {
  Building2,
  Users,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export interface ManagerDashboardClientProps {
  slug: string;
}

export function ManagerDashboardClient({ slug }: ManagerDashboardClientProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'MY CLUBS' | 'EVENTS'>('OVERVIEW');

  // Subdomain / path helper
  const getPath = (subPath: string) => `/college/${slug}${subPath}`;

  // Fetch Manager's Assigned Clubs
  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsError,
    error: clubsErrObj,
    refetch: refetchClubs,
  } = useMyClubsQuery(slug);

  // Aggregated data state for detailed member count and club events
  const [detailedClubs, setDetailedClubs] = useState<Club[]>([]);
  const [allEvents, setAllEvents] = useState<Array<Event & { clubName?: string; clubId: string }>>([]);
  const [totalMembers, setTotalMembers] = useState(0);

  // When clubs load, fetch details and events in parallel
  React.useEffect(() => {
    let isSubscribed = true;
    if (clubs.length === 0) {
      return;
    }

    void Promise.all(
      clubs.map(async (c) => {
        try {
          const detail = await fetchClubDashboard(c.id);
          let clubEvents: Event[] = [];
          try {
            clubEvents = await fetchManagedClubEvents(c.id);
          } catch {
            // Non-fatal
          }
          return { club: detail || c, events: clubEvents };
        } catch {
          return { club: c, events: [] };
        }
      })
    ).then((results) => {
      if (!isSubscribed) return;
      let memberCount = 0;
      const aggregatedEvents: Array<Event & { clubName?: string; clubId: string }> = [];
      const updatedClubs: Club[] = [];

      for (const res of results) {
        updatedClubs.push(res.club);
        if (Array.isArray(res.club.members)) {
          memberCount += res.club.members.length;
        } else if (typeof res.club.memberCount === 'number') {
          memberCount += res.club.memberCount;
        }

        for (const evt of res.events) {
          aggregatedEvents.push({
            ...evt,
            clubName: res.club.name,
            clubId: res.club.id,
          });
        }
      }

      setDetailedClubs(updatedClubs);
      setTotalMembers(memberCount);
      setAllEvents(aggregatedEvents);
    });

    return () => {
      isSubscribed = false;
    };
  }, [clubs]);

  const loading = clubsLoading || (clubs.length > 0 && detailedClubs.length === 0);
  const managerName = user?.name || user?.email?.split('@')[0] || 'Manager';
  const displayClubs = detailedClubs.length > 0 ? detailedClubs : clubs;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ManagerLayout slug={slug}>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* WORKSPACE WELCOME HEADER */}
        <div
          className={`rounded-3xl p-6 sm:p-8 border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] text-[10px] font-black uppercase tracking-wider border border-[#00F0FF]/25">
                Manager Workspace
              </span>
              <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Welcome back, <strong className={isDark ? 'text-white' : 'text-slate-900'}>{managerName}</strong>
              </span>
            </div>

            <h1
              className={`font-['Syne',sans-serif] text-3xl sm:text-4xl font-black uppercase tracking-tight ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              What&apos;s happening with <span className="text-[#00F0FF]">my clubs?</span>
            </h1>

            <p className={`text-xs font-medium max-w-xl ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Oversee your assigned clubs, publish upcoming campus events, monitor member activity, and manage registrations.
            </p>
          </div>

          {/* Quick Action */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={getPath('/manager/clubs')}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-full border font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#00F0FF]" />
              <span>Manage Clubs ({clubs.length})</span>
            </Link>
          </div>
        </div>

        {/* ERROR ALERT */}
        {clubsError && (
          <div className="p-4 rounded-2xl border flex items-center justify-between text-xs font-bold bg-rose-500/10 border-rose-500/30 text-rose-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>
                {(clubsErrObj as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                  'Failed to load manager dashboard.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetchClubs()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-black uppercase rounded-xl transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div
            className={`rounded-3xl p-6 border relative overflow-hidden group hover:border-cyan-500/50 transition-all ${
              isDark ? 'bg-[#12141C] border-white/10 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Managed Clubs
            </span>
            <div className={`font-['Syne',sans-serif] text-4xl font-black mt-1 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              {loading ? '...' : clubs.length}
            </div>
            <p className="text-[11px] text-[#00F0FF] font-bold mt-1">Assigned manager access</p>
            <div
              className={`absolute right-4 bottom-4 p-3 rounded-2xl border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Building2 className="w-5 h-5 text-[#00F0FF]" />
            </div>
          </div>

          <div
            className={`rounded-3xl p-6 border relative overflow-hidden group hover:border-blue-500/50 transition-all ${
              isDark ? 'bg-[#12141C] border-white/10 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Total Club Members
            </span>
            <div className="font-['Syne',sans-serif] text-4xl font-black text-blue-400 mt-1">
              {loading ? '...' : totalMembers > 0 ? totalMembers : '—'}
            </div>
            <p className="text-[11px] text-emerald-400 font-bold mt-1">Enrolled students across clubs</p>
            <div
              className={`absolute right-4 bottom-4 p-3 rounded-2xl border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div
            className={`rounded-3xl p-6 border relative overflow-hidden group hover:border-cyan-500/50 transition-all ${
              isDark ? 'bg-[#12141C] border-white/10 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Total Club Events
            </span>
            <div className="font-['Syne',sans-serif] text-4xl font-black text-[#00F0FF] mt-1">
              {loading ? '...' : allEvents.length}
            </div>
            <p className={`text-[11px] font-bold mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Active & upcoming events
            </p>
            <div
              className={`absolute right-4 bottom-4 p-3 rounded-2xl border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Calendar className="w-5 h-5 text-[#00F0FF]" />
            </div>
          </div>
        </div>

        {/* DASHBOARD TAB SELECTOR */}
        <div className={`flex items-center gap-2 border-b pb-3 overflow-x-auto ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {(['OVERVIEW', 'MY CLUBS', 'EVENTS'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveSection(tab)}
              className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeSection === tab
                  ? 'bg-[#00F0FF] text-black shadow-md shadow-cyan-500/20'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* OVERVIEW OR CLUBS TAB */}
        {(activeSection === 'OVERVIEW' || activeSection === 'MY CLUBS') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className={`font-['Syne',sans-serif] text-2xl font-black uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  My Managed Clubs
                </h2>
                <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Select any club to update information, upload logos, manage events, and view details.
                </p>
              </div>

              {clubs.length > 0 && (
                <Link
                  href={getPath('/manager/clubs')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#00F0FF] hover:underline uppercase tracking-wider"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-48 rounded-3xl animate-pulse border ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
                    }`}
                  />
                ))}
              </div>
            )}

            {!loading && !clubsError && displayClubs.length === 0 && (
              <div
                className={`text-center py-16 rounded-3xl border space-y-3 ${
                  isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
                }`}
              >
                <Building2 className="w-12 h-12 text-gray-500 mx-auto" />
                <h3 className="font-['Syne',sans-serif] text-lg font-bold uppercase">No Managed Clubs Assigned</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  You are not currently assigned to manage any clubs. Please contact your college administrator to get access.
                </p>
              </div>
            )}

            {!loading && !clubsError && displayClubs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayClubs.map((club) => {
                  const logoUrl = club.logoUrl || club.logo?.url;
                  const initials = club.name ? club.name.slice(0, 2).toUpperCase() : 'CL';
                  const clubHref = getPath(`/manager/clubs/${club.id}`);

                  return (
                    <Link
                      key={club.id}
                      href={clubHref}
                      className={`group border rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                        isDark
                          ? 'bg-[#12141C] hover:bg-[#161922] border-white/10 hover:border-cyan-500/50'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={club.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-xs group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-blue-600 flex items-center justify-center text-black font-['Syne',sans-serif] font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-['Syne',sans-serif] text-lg font-bold group-hover:text-[#00F0FF] transition truncate ${
                                isDark ? 'text-white' : 'text-[#0F172A]'
                              }`}
                            >
                              {club.name}
                            </h3>
                            <span className="text-[10px] text-[#00F0FF] font-black uppercase tracking-wider bg-[#00F0FF]/10 px-2.5 py-0.5 rounded-full inline-block mt-0.5 border border-[#00F0FF]/25">
                              Manager Access
                            </span>
                          </div>
                        </div>

                        <p className={`text-xs line-clamp-3 leading-relaxed font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                          {club.description || 'No description provided for this campus club.'}
                        </p>
                      </div>

                      <div className={`pt-4 mt-6 border-t flex items-center justify-between text-xs ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          {club.members ? `${club.members.length} Members` : 'Manage Details'}
                        </span>
                        <div className="flex items-center gap-1 font-extrabold text-[#00F0FF] group-hover:translate-x-1 transition-transform uppercase text-[11px] tracking-wider">
                          <span>Open Club</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EVENTS SECTION */}
        {(activeSection === 'EVENTS' || (activeSection === 'OVERVIEW' && allEvents.length > 0)) && (
          <div
            className={`rounded-3xl p-6 border shadow-sm space-y-4 ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <h3
                  className={`font-['Syne',sans-serif] text-xl font-black uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Published Events ({allEvents.length})
                </h3>
                <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  All events created across your managed clubs.
                </p>
              </div>
            </div>

            {allEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No published events yet for your managed clubs.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b uppercase font-black tracking-wider ${isDark ? 'border-white/10 text-gray-400' : 'border-slate-200 text-slate-500'}`}>
                      <th className="py-3 px-3">Event Title</th>
                      <th className="py-3 px-3">Club</th>
                      <th className="py-3 px-3">Start Date</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                    {allEvents.map((e) => (
                      <tr
                        key={e.id}
                        className={`transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      >
                        <td className={`py-3.5 px-3 font-extrabold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                          {e.title}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#00F0FF]">{e.clubName || 'My Club'}</td>
                        <td className={`py-3.5 px-3 font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          {formatDate(e.startAt)}
                        </td>
                        <td className={`py-3.5 px-3 font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          {e.location || 'TBA'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <Link
                            href={getPath(`/manager/clubs/${e.clubId}/events/${e.id}`)}
                            className="inline-block px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#00F0FF] text-black shadow-xs hover:bg-cyan-300 transition"
                          >
                            Manage Event
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

export default ManagerDashboardClient;
