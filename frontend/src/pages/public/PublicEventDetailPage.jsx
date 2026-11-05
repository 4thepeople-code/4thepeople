import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicApi } from '../../api/publicApi';
import PublicLayout from '../../components/public/PublicLayout';
import GalleryLightbox from '../../components/public/GalleryLightbox';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Ticket,
  Users,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

const formatDateParts = (dateString) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const full = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { day, month, full };
};

const formatEventTime = (startStr, endStr) => {
  if (!startStr) return null;
  const d = new Date(startStr);
  if (isNaN(d.getTime())) return null;
  let timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (endStr) {
    const end = new Date(endStr);
    if (!isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeStr = `${timeStr} - ${endTime}`;
    }
  }
  return timeStr;
};

const PublicEventDetailPage = () => {
  const { clubId, eventId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user, token } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [regError, setRegError] = useState(null);

  const [event, setEvent] = useState(null);
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState(null);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      setError(null);

      const upcomingRes = await publicApi.getUpcomingEvents();
      const allUpcoming =
        upcomingRes.data?.events ||
        upcomingRes.events ||
        (Array.isArray(upcomingRes.data) ? upcomingRes.data : Array.isArray(upcomingRes) ? upcomingRes : []);

      let currentEvent = null;
      let currentClub = null;

      if (clubId && eventId) {
        try {
          const singleRes = await publicApi.getPublicEvent(clubId, eventId);
          currentEvent = singleRes.event || singleRes.data?.event;
          currentClub = singleRes.club || singleRes.data?.club;
        } catch (err) {
          console.warn('Could not fetch single event by ID:', err);
        }
      }

      if (!currentEvent && eventId) {
        currentEvent = allUpcoming.find((e) => e.id === eventId);
        if (currentEvent?.club) currentClub = currentEvent.club;
      }

      if (!currentEvent && allUpcoming.length > 0) {
        currentEvent = allUpcoming[0];
        currentClub = currentEvent.club;
      }

      if (currentEvent) {
        setEvent(currentEvent);
        setClub(currentClub || currentEvent.club);
      } else {
        setError('Event details not found.');
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (event?.title) {
      document.title = `${event.title} | 4 THE PEOPLE`;
    } else {
      document.title = 'Event Details | 4 THE PEOPLE';
    }
  }, [event]);

  useEffect(() => {
    fetchEventData();
    window.scrollTo(0, 0);
  }, [clubId, eventId]);
  useEffect(() => {
    const checkRegistration = async () => {
      if (!event?.id || !token) {
        setRegistered(false);
        return;
      }
      try {
        const res = await publicApi.getMyRegistrationStatus(event.id);
        if (res && typeof res.isRegistered === 'boolean') {
          setRegistered(res.isRegistered);
        }
      } catch {
        setRegistered(false);
      }
    };
    checkRegistration();
  }, [event?.id, token]);


  const dateInfo = formatDateParts(event?.startAt || event?.startDate || event?.date);
  const eventTime = formatEventTime(event?.startAt || event?.startDate || event?.date, event?.endAt || event?.endDate);

  // Normalize registration URL ensuring protocol
  const getValidUrl = (url) => {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const rawRegistrationUrl = event?.registrationUrl || event?.url || event?.formUrl || event?.link || event?.externalUrl;
  const validRegistrationUrl = getValidUrl(rawRegistrationUrl);

  const handleRegister = async () => {
    if (validRegistrationUrl) {
      window.open(validRegistrationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!token) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    try {
      setRegistering(true);
      setRegError(null);
      await publicApi.registerForEvent(event.id);
      setRegistered(true);
      setShowModal(true);
      setEvent((prev) => (prev ? { ...prev, registeredCount: (prev.registeredCount || 0) + 1 } : prev));
    } catch (err) {
      setRegError(err.response?.data?.message || err.message || 'Failed to register for event');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!token || !event?.id) return;
    try {
      setCancelling(true);
      setRegError(null);
      await publicApi.cancelRegistration(event.id);
      setRegistered(false);
      setEvent((prev) => (prev ? { ...prev, registeredCount: Math.max(0, (prev.registeredCount || 1) - 1) } : prev));
    } catch (err) {
      setRegError(err.response?.data?.message || err.message || 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title || 'Campus Event',
          text: `Check out ${event?.title} organized by ${club?.name || 'campus clubs'} on 4 THE PEOPLE!`,
          url: window.location.href,
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <PublicLayout>
      <div className="py-8 sm:py-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">

        {/* Back Link & Share Notification Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold uppercase transition cursor-pointer ${
              isDark
                ? 'bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {shareNotice && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-[#00F0FF] animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Event link copied to clipboard!</span>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-3xl text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className={`text-xl font-extrabold font-['Syne',sans-serif] ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Event Not Available</h2>
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={fetchEventData}
              className="px-5 py-2.5 bg-red-500/20 text-red-200 rounded-full text-xs font-bold uppercase cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className={`h-[420px] rounded-3xl animate-pulse border ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
          }`} />
        )}

        {/* Event Main Content */}
        {!loading && !error && event && (
          <>
            {/* 2-Column Responsive Hero: Information Left, Image Poster Right */}
            <div className={`rounded-3xl border overflow-hidden p-6 sm:p-8 lg:p-10 transition-colors ${
              isDark ? 'bg-[#12141C] border-white/15 shadow-2xl' : 'bg-white border-slate-200 shadow-md'
            }`}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

                {/* Left Column (Information First): 7 cols on desktop */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    {/* Badges: Category + Registration Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-[#00F0FF] text-[11px] font-black uppercase tracking-wider">
                        {event.category || 'CAMPUS EVENT'}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                        REGISTRATION OPEN
                      </span>
                      {event.club?.name && (
                        <Link
                          to={`/clubs/${club?.id || clubId}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                            isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{club?.name || event.club?.name}</span>
                        </Link>
                      )}
                    </div>

                    {/* Title */}
                    <h1 className={`font-['Syne',sans-serif] text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-[1.05] ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}>
                      {event.title}
                    </h1>

                    {/* Organizer mention */}
                    <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Presented by{' '}
                      <Link
                        to={`/clubs/${club?.id || clubId}`}
                        className="text-cyan-600 dark:text-[#00F0FF] hover:underline font-bold"
                      >
                        {club?.name || event.club?.name || "Campus Club"}
                      </Link>
                    </p>
                  </div>

                  {/* Structured Info Cards: Date, Time, Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                      isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</span>
                        <span className="font-extrabold text-sm">{dateInfo.full}</span>
                      </div>
                    </div>

                    {eventTime && (
                      <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                        isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Time</span>
                          <span className="font-extrabold text-sm font-mono">{eventTime}</span>
                        </div>
                      </div>
                    )}

                    <div className={`sm:col-span-2 p-3.5 rounded-2xl border flex items-start gap-3 ${
                      isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <div className="p-2 rounded-xl bg-pink-500/15 text-pink-500 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Venue / Location</span>
                        <span className="font-extrabold text-sm">{event.location || "Campus Main Venue"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action CTA Buttons */}
                  <div className="pt-2 flex flex-col gap-2.5">
                    {regError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{regError}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      {validRegistrationUrl ? (
                        <a
                          href={validRegistrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#00F0FF] hover:bg-[#38f2ff] text-black shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]"
                          title="Open official registration form"
                        >
                          <span>Register for Event</span>
                          <ExternalLink className="w-4 h-4 shrink-0" />
                        </a>
                      ) : registered ? (
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <div className="flex-1 min-w-[160px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg bg-emerald-500 text-black flex items-center justify-center gap-2 cursor-default">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>RSVP Confirmed</span>
                          </div>
                          <button
                            onClick={handleCancelRegistration}
                            disabled={cancelling}
                            className="py-3 px-4 rounded-full font-bold text-xs uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                            title="Cancel RSVP"
                          >
                            {cancelling ? 'Cancelling...' : 'Cancel RSVP'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleRegister}
                          disabled={registering || (event.capacity !== null && event.capacity !== undefined && (event.registeredCount || 0) >= event.capacity)}
                          className={`flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            event.capacity !== null && event.capacity !== undefined && (event.registeredCount || 0) >= event.capacity
                              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                              : 'bg-[#00F0FF] hover:bg-[#38f2ff] text-black shadow-cyan-500/30'
                          }`}
                        >
                          {registering ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Registering...</span>
                            </>
                          ) : event.capacity !== null && event.capacity !== undefined && (event.registeredCount || 0) >= event.capacity ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              <span>Event Full (Capacity Reached)</span>
                            </>
                          ) : (
                            <>
                              <span>RSVP / Register Now</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      )}

                      {/* Share Button */}
                      <button
                        onClick={handleShare}
                        className={`p-3.5 rounded-full border transition cursor-pointer ${
                          isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Share Event Link"
                        aria-label="Share Event Link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    {validRegistrationUrl && (
                      <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Redirects to official Google Form / Registration Page</span>
                      </p>
                    )}
                  </div>

                  {/* Registration Count Note */}
                  <div className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`font-extrabold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      {event.capacity !== null && event.capacity !== undefined
                        ? `${event.registeredCount ?? 0} / ${event.capacity} spots filled`
                        : `${event.registeredCount ?? 0} Students registered`}
                    </span>
                    {event.capacity !== null && event.capacity !== undefined && (event.registeredCount ?? 0) >= event.capacity
                      ? ' • Capacity Full'
                      : ' • Direct Club RSVP'}
                  </div>
                </div>

                {/* Right Column (Image Showcase + Organizer): 5 cols on desktop */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                  {/* Event Cover Photo Container */}
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-900 border border-white/10 shadow-lg group">
                    <img
                      src={event.coverImage?.url || event.coverUrl || event.bannerUrl || "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop"}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    {/* Official Poster Badge */}
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Event Poster</span>
                    </div>
                  </div>

                  {/* Quick Host Club Card */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                        {(
                          club?.logo?.url ||
                          event.club?.logo?.url
                        ) ? (
                          <img
                            src={club?.logo?.url || event.club?.logo?.url}
                            alt={`${club?.name || event.club?.name || 'Club'} logo`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 m-auto text-cyan-500" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Host Club</span>
                        <span className={`block font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {club?.name || event.club?.name || "Campus Club"}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/clubs/${club?.id || clubId}`}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-200'
                      }`}
                    >
                      Profile →
                    </Link>
                  </div>
                </div>

              </div>
            </div>

            {/* Description & Venue Details Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className={`lg:col-span-8 rounded-3xl p-6 sm:p-8 border space-y-4 ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h2 className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}>
                  Event <span className="text-cyan-500">Description</span>
                </h2>
                <p className={`text-sm leading-relaxed font-normal whitespace-pre-line ${
                  isDark ? 'text-gray-300' : 'text-slate-600'
                }`}>
                  {event.description || "Join us for an incredible session organized by our active campus club. Bring your enthusiasm and collaborate with passionate peers!"}
                </p>
              </div>

              {/* Organizer Profile Card Sidebar */}
              <div className={`lg:col-span-4 rounded-3xl p-6 border space-y-4 ${
                isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <span className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">
                  About The Organizer
                </span>
                <div className="space-y-2">
                  <h3 className={`font-['Syne',sans-serif] text-xl font-bold ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}>
                    {club?.name || event.club?.name || "Campus Club"}
                  </h3>
                  <p className={`text-xs line-clamp-4 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {club?.description || "Student organization committed to tech innovation, learning, and campus community events."}
                  </p>
                </div>
                <Link
                  to={`/clubs/${club?.id || clubId}`}
                  className={`block w-full text-center py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  View Full Club Profile →
                </Link>
              </div>
            </div>

            {/* Event Photo Gallery (If Available) */}
            {event.gallery && event.gallery.length > 0 && (
              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-cyan-500" />
                  <h2 className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}>
                    Event <span className="text-cyan-500">Gallery</span>
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {event.gallery.map((photo, idx) => (
                    <div
                      key={photo.publicId || idx}
                      onClick={() => setActiveGalleryEvent(event)}
                      className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-900 border border-white/10 cursor-pointer shadow-sm hover:shadow-lg transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={`Event gallery ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Sparkles className="w-6 h-6 text-cyan-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl ${
            isDark ? 'bg-[#12141C] border-white/15 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
          }`}>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className={`font-['Syne',sans-serif] text-2xl font-black uppercase ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}>
              RSVP Confirmed!
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
              Your registration for <strong>{event?.title}</strong> is saved. Event pass details have been sent.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 rounded-full bg-[#00F0FF] text-black text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Gallery Lightbox */}
      {activeGalleryEvent && (
        <GalleryLightbox
          event={activeGalleryEvent}
          onClose={() => setActiveGalleryEvent(null)}
        />
      )}
    </PublicLayout>
  );
};

export default PublicEventDetailPage;
