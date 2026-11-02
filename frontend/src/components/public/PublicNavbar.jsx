import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Compass, Menu, X, ArrowUpRight, LogIn, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const PublicNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? isDark
            ? 'bg-[#0B0C10]/90 backdrop-blur-md border-b border-white/10 py-3 shadow-2xl shadow-black/60'
            : 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 py-3 shadow-md shadow-slate-900/5'
          : isDark
            ? 'bg-[#0B0C10]/80 backdrop-blur-sm py-5 border-b border-white/5'
            : 'bg-white/80 backdrop-blur-sm py-5 border-b border-slate-200/50'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link
            to="/"
            className="group flex items-center gap-2.5 font-extrabold tracking-tight text-xl sm:text-2xl"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-[#3B82F6] flex items-center justify-center text-black font-black shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
              <span className="font-['Syne',sans-serif] text-2xl font-black leading-none">4</span>
            </div>
            <div className="flex flex-col justify-center leading-none">
              <span className="text-[10px] font-black tracking-[0.25em] text-[#00F0FF] uppercase leading-none mb-0.5">
                THE
              </span>
              <span className={`font-['Syne',sans-serif] text-xl font-black tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}>
                PEOPLE<span className="text-[#00F0FF]">.</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider">
            <Link
              to="/"
              className={`transition-colors ${
                location.pathname === '/'
                  ? isDark ? 'text-[#00F0FF]' : 'text-cyan-600 font-extrabold'
                  : isDark ? 'text-gray-300 hover:text-[#00F0FF]' : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Home
            </Link>

            <a
              href="/#upcoming-events"
              onClick={(e) => {
                if (location.pathname === '/') {
                  e.preventDefault();
                  document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className={`transition-colors ${
                isDark ? 'text-gray-300 hover:text-[#00F0FF]' : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Events
            </a>

            <Link
              to="/clubs"
              className={`transition-colors ${
                location.pathname.startsWith('/clubs')
                  ? isDark ? 'text-[#00F0FF]' : 'text-cyan-600 font-extrabold'
                  : isDark ? 'text-gray-300 hover:text-[#00F0FF]' : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Clubs Directory
            </Link>

            <Link
              to="/departments"
              className={`transition-colors ${
                location.pathname.startsWith('/departments')
                  ? isDark ? 'text-[#00F0FF]' : 'text-cyan-600 font-extrabold'
                  : isDark ? 'text-gray-300 hover:text-[#00F0FF]' : 'text-slate-600 hover:text-cyan-600'
              }`}
            >
              Departments
            </Link>
          </nav>

          {/* Right Action, Theme Toggle & Portal Links */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>

            <Link
              to="/login"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                isDark
                  ? 'text-gray-300 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Login</span>
            </Link>

            <Link
              to="/clubs"
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider overflow-hidden hover:bg-[#38f2ff] transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-black group-hover:rotate-45 transition-transform" />
              <span>Explore Clubs</span>
              <ArrowUpRight className="w-4 h-4 text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile Hamburger Toggle & Mobile Theme Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
              aria-label="Toggle theme mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className={`md:hidden border-b overflow-hidden ${
              isDark ? 'bg-[#0F1117] border-white/10' : 'bg-white border-slate-200 shadow-xl'
            }`}
          >
            <div className="px-4 pt-4 pb-6 space-y-3">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  location.pathname === '/'
                    ? isDark ? 'text-[#00F0FF] bg-white/5' : 'text-cyan-600 bg-slate-100 font-bold'
                    : isDark
                      ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
                }`}
              >
                Home
              </Link>
              <a
                href="/#upcoming-events"
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  if (location.pathname === '/') {
                    e.preventDefault();
                    document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  isDark
                    ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
                }`}
              >
                Events
              </a>
              <Link
                to="/clubs"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  location.pathname.startsWith('/clubs')
                    ? isDark ? 'text-[#00F0FF] bg-white/5' : 'text-cyan-600 bg-slate-100 font-bold'
                    : isDark
                      ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
                }`}
              >
                Clubs Directory
              </Link>
              <Link
                to="/departments"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  location.pathname.startsWith('/departments')
                    ? isDark ? 'text-[#00F0FF] bg-white/5' : 'text-cyan-600 bg-slate-100 font-bold'
                    : isDark
                      ? 'text-gray-200 hover:bg-white/5 hover:text-[#00F0FF]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-600'
                }`}
              >
                Departments
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 px-3 rounded-lg font-semibold transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Portal Login
              </Link>

              {/* Mobile Drawer Theme Switch */}
              <div className={`pt-3 border-t flex items-center justify-between px-3 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-gray-400' : 'text-slate-600'
                }`}>
                  Theme Mode
                </span>
                <button
                  onClick={toggleTheme}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </div>

              <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <Link
                  to="/clubs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#00F0FF] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20"
                >
                  <Compass className="w-4 h-4 text-black" />
                  <span>Explore Clubs</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default PublicNavbar;
