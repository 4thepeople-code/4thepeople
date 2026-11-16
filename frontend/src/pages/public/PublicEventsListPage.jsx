import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicApi } from '../../api/publicApi';
import PublicLayout from '../../components/public/PublicLayout';
import { useTheme } from '../../context/ThemeContext';
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Building2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Ticket,
  GraduationCap,
  X,
} from 'lucide-react';
import { getCloudinaryUrl, CLOUDINARY_TRANSFORMS } from '../../utils/cloudinary';

const formatDateParts = (dateString) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', weekday: '', time: '', full: 'Date TBA' };
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return { day: 'TBA', month: 'TBA', weekday: '', time: '', full: 'Date TBA' };
  return {
    day: d.getDate().toString().padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleString('en-US', { weekday: 'short' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  };
};

const PublicEventsListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useTheme();

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [paidFilter, setPaidFilter] = useState(searchParams.get('isPaid') || 'ALL');
  const [modeFilter, setModeFilter] = useState(searchParams.get('mode') || 'ALL');
  const [locationQuery, setLocationQuery] = useState(searchParams.get('location') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  // Data States
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: 12,
      };

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (locationQuery.trim()) params.location = locationQuery.trim();
      if (paidFilter === 'FREE') params.isPaid = 'false';
      if (paidFilter === 'PAID') params.isPaid = 'true';
      if (modeFilter === 'INTERNAL' || modeFilter === 'EXTERNAL') params.registrationMode = modeFilter;

      const res = await publicApi.discoverEvents(params);
      const eventList = res.events || res.data?.events || [];
      setEvents(eventList);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Error discovering public events:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load public events.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, locationQuery, paidFilter, modeFilter]);

  useEffect(() => {
    document.title = 'Discover Public Events | 4 THE PEOPLE';
    fetchEvents();
  }, [fetchEvents]);

  // Sync state to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (locationQuery.trim()) params.set('location', locationQuery.trim());
    if (paidFilter !== 'ALL') params.set('isPaid', paidFilter);
    if (modeFilter !== 'ALL') params.set('mode', modeFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    setSearchParams(params, { replace: true });
  }, [searchQuery, locationQuery, paidFilter, modeFilter, currentPage, setSearchParams]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setLocationQuery('');
    setPaidFilter('ALL');
    setModeFilter('ALL');
    setCurrentPage(1);
  };

  const handleCardClick = (event) => {
    if (event.clubId && event.id) {
      navigate(`/clubs/${event.clubId}/events/${event.id}`);
    } else {
      navigate(`/events/${event.id}`);
    }
  };

  const hasActiveFilters = searchQuery.trim() || locationQuery.trim() || paidFilter !== 'ALL' || modeFilter !== 'ALL';

  return (
    <PublicLayout>
      <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Page Header */}
        <div className={`flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-[#00F0FF] text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Events Directory</span>
            </div>
            <h1 className={`font-['Syne',sans-serif] text-4xl sm:text-5xl font-extrabold uppercase tracking-tight ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}>
              DISCOVER <span className="text-[#00F0FF]">EVENTS.</span>
            </h1>
            <p className={`text-base max-w-xl mt-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Explore upcoming hackathons, workshops, conferences, and cultural festivals hosted across colleges.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className={`self-start md:self-end flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold ${
            isDark ? 'bg-[#12141C] border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
          }`}>
            <Ticket className="w-4 h-4 text-[#00F0FF]" />
            <span>{pagination.total} Public Event{pagination.total === 1 ? '' : 's'} Found</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className={`p-4 sm:p-6 rounded-2xl border space-y-4 ${
          isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            {/* Search Query */}
            <div className="relative flex-1">
              <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-gray-400' : 'text-slate-400'
              }`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search events by title..."
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:border-[#00F0FF] ${
                  isDark
                    ? 'bg-[#181B24] border-white/10 text-white placeholder-gray-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Location Query */}
            <div className="relative w-full md:w-64">
              <MapPin className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-gray-400' : 'text-slate-400'
              }`} />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Location or venue..."
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:border-[#00F0FF] ${
                  isDark
                    ? 'bg-[#181B24] border-white/10 text-white placeholder-gray-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Clear Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border ${
                  isDark
                    ? 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
                    : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </form>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-white/10">
            <span className={`text-xs font-bold uppercase tracking-wider mr-2 ${
              isDark ? 'text-gray-400' : 'text-slate-500'
            }`}>
              Filters:
            </span>

            {/* Pricing Filter */}
            {['ALL', 'FREE', 'PAID'].map((option) => (
              <button
                key={option}
                onClick={() => {
                  setPaidFilter(option);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  paidFilter === option
                    ? 'bg-[#00F0FF] text-black font-bold shadow-xs'
                    : isDark
                      ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option === 'ALL' ? 'All Prices' : option === 'FREE' ? 'Free Events' : 'Paid Events'}
              </button>
            ))}

            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

            {/* Mode Filter */}
            {['ALL', 'INTERNAL', 'EXTERNAL'].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setModeFilter(mode);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  modeFilter === mode
                    ? 'bg-purple-500 text-white font-bold shadow-xs'
                    : isDark
                      ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode === 'ALL' ? 'All Modes' : mode === 'INTERNAL' ? 'Campus Native' : 'External Allowed'}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section: Loading, Error, Empty, or Cards */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
            <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Discovering public campus events...
            </p>
          </div>
        ) : error ? (
          <div className={`p-8 rounded-2xl border text-center space-y-4 max-w-lg mx-auto ${
            isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
            <div>
              <h3 className="font-bold text-lg">Unable to load events</h3>
              <p className="text-sm mt-1 opacity-90">{error}</p>
            </div>
            <button
              onClick={fetchEvents}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className={`py-20 px-4 rounded-3xl border text-center space-y-4 ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <Calendar className={`w-12 h-12 mx-auto ${isDark ? 'text-gray-600' : 'text-slate-300'}`} />
            <div className="max-w-md mx-auto">
              <h3 className={`font-['Syne',sans-serif] text-xl font-bold uppercase ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                No Public Events Found
              </h3>
              <p className={`text-sm mt-1.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {hasActiveFilters
                  ? 'No events match your current filter criteria. Try clearing search terms or selecting different filters.'
                  : 'There are no public upcoming events currently scheduled. Check back soon!'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#00F0FF] text-black text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Event Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const dateParts = formatDateParts(event.startAt);
                const rawCover = event.coverImage?.url || event.coverImageUrl;
                const coverUrl = getCloudinaryUrl(rawCover, CLOUDINARY_TRANSFORMS.COVER);

                return (
                  <div
                    key={event.id}
                    onClick={() => handleCardClick(event)}
                    className={`group relative flex flex-col rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      isDark
                        ? 'bg-[#12141C] border-white/10 hover:border-cyan-500/40 hover:shadow-cyan-500/5'
                        : 'bg-white border-slate-200/80 hover:border-cyan-500/40 hover:shadow-slate-900/10'
                    }`}
                  >
                    {/* Event Cover Image Box */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-900/60 via-purple-900/50 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
                          <Sparkles className="w-8 h-8 text-cyan-400 opacity-60 mb-2 group-hover:rotate-12 transition-transform" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-200">
                            {event.club?.name || 'CAMPUS EVENT'}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Date Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-center shadow-md">
                        <span className="block font-['Syne',sans-serif] text-base font-black leading-none text-white">
                          {dateParts.day}
                        </span>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                          {dateParts.month}
                        </span>
                      </div>

                      {/* Pricing / Mode Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${
                          event.isPaid
                            ? 'bg-amber-400 text-black'
                            : 'bg-emerald-500 text-white'
                        }`}>
                          {event.isPaid ? `${event.currency || 'INR'} ${event.fee || 0}` : 'FREE'}
                        </span>
                      </div>

                      {/* Organizing Club & College Banner */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white">
                        <div className="inline-flex items-center gap-1.5 truncate max-w-[65%]">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-semibold text-cyan-200 truncate text-[11px]">
                            {event.club?.name || 'Campus Club'}
                          </span>
                        </div>
                        {event.college && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-gray-300 font-mono truncate max-w-[32%]">
                            <GraduationCap className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{event.college.name || event.college.slug}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className={`font-['Syne',sans-serif] text-lg font-bold uppercase tracking-tight line-clamp-1 transition-colors ${
                          isDark ? 'text-white group-hover:text-[#00F0FF]' : 'text-slate-900 group-hover:text-cyan-600'
                        }`} title={event.title}>
                          {event.title}
                        </h3>

                        {/* Metadata Rows */}
                        <div className="mt-2 space-y-1.5 text-xs">
                          <div className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="truncate font-mono">{dateParts.weekday}, {dateParts.month} {dateParts.day} • {dateParts.time}</span>
                          </div>

                          <div className={`flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="truncate font-semibold">{event.location || 'Campus Venue'}</span>
                          </div>
                        </div>

                        {/* Description snippet */}
                        <p className={`text-xs mt-2.5 line-clamp-2 leading-relaxed ${
                          isDark ? 'text-gray-400' : 'text-slate-600'
                        }`}>
                          {event.description}
                        </p>
                      </div>

                      {/* Card Footer */}
                      <div className={`pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                        isDark ? 'border-white/5 text-cyan-400' : 'border-slate-100 text-cyan-600'
                      }`}>
                        <span className="inline-flex items-center gap-1">
                          <span>View Details</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase ${
                          event.registrationMode === 'EXTERNAL'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {event.registrationMode || 'INTERNAL'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Showing page <span className="font-bold text-[#00F0FF]">{pagination.page}</span> of{' '}
                  <span className="font-bold">{pagination.totalPages}</span> ({pagination.total} events)
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'border-white/10 bg-[#12141C] text-gray-300 hover:bg-white/5'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'border-white/10 bg-[#12141C] text-gray-300 hover:bg-white/5'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </PublicLayout>
  );
};

export default PublicEventsListPage;
