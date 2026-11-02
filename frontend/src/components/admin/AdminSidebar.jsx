import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LogOut, X } from 'lucide-react';

const AdminSidebar = ({ mobileOpen, setMobileOpen, onOpenInviteManager }) => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  const navSections = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin', end: true },
        { label: 'My Profile', path: '/admin/profile' },
      ],
    },
    {
      title: 'Users',
      items: [
        { label: 'All Users', path: '/admin/users' },
      ],
    },
    {
      title: 'Clubs',
      items: [
        { label: 'All Clubs', path: '/admin/clubs', end: true },
        { label: 'Create Club', path: '/admin/clubs/create' },
      ],
    },
    {
      title: 'Departments',
      items: [
        { label: 'All Departments', path: '/admin/departments' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col justify-between transition-transform duration-300 ease-in-out transform border-r ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDark
            ? 'bg-[#1C1B1F] text-[#F5F3EF] border-[#2D2C30]'
            : 'bg-white text-[#1C1B1F] border-[#E8E6DF] shadow-xs'
        }`}
      >
        <div>
          {/* Header Branding */}
          <div className={`h-16 px-6 flex items-center justify-between border-b ${
            isDark ? 'border-[#2D2C30]' : 'border-[#E8E6DF]'
          }`}>
            <div>
              <h1 className={`text-base font-semibold leading-tight font-serif tracking-tight ${
                isDark ? 'text-[#F5F3EF]' : 'text-[#1C1B1F]'
              }`}>
                Admin Portal
              </h1>
              <p className={`text-[11px] font-sans ${isDark ? 'text-[#A8A5A0]' : 'text-[#64748B]'}`}>Club Event Manager</p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className={`lg:hidden p-1 transition-colors ${
                isDark ? 'text-[#A8A5A0] hover:text-[#F5F3EF]' : 'text-[#64748B] hover:text-[#1C1B1F]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="py-6 px-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] font-sans">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className={`px-3 text-xs font-medium ${isDark ? 'text-[#8E8B85]' : 'text-[#827F79]'}`}>
                  {section.title}
                </p>
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `block px-3.5 py-2 text-sm transition-colors border-l-2 rounded-r-md ${isActive
                        ? isDark
                          ? 'border-[#B08D57] text-[#F5F3EF] font-semibold bg-[#252429]/60'
                          : 'border-[#B08D57] text-[#1C1B1F] font-semibold bg-[#F5F3EF]'
                        : isDark
                          ? 'border-transparent text-[#C5C2BC] hover:text-[#F5F3EF] hover:bg-[#252429]/30'
                          : 'border-transparent text-[#64748B] hover:text-[#1C1B1F] hover:bg-[#FAF9F5]'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}

            {/* Managers Section */}
            <div className="space-y-1 pt-2">
              <p className={`px-3 text-xs font-medium ${isDark ? 'text-[#8E8B85]' : 'text-[#827F79]'}`}>
                Managers
              </p>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  if (onOpenInviteManager) onOpenInviteManager();
                }}
                className={`w-full text-left px-3.5 py-2 text-sm border-l-2 border-transparent rounded-r-md transition-colors ${
                  isDark
                    ? 'text-[#C5C2BC] hover:text-[#F5F3EF] hover:bg-[#252429]/30'
                    : 'text-[#64748B] hover:text-[#1C1B1F] hover:bg-[#FAF9F5]'
                }`}
              >
                Create Manager
              </button>
            </div>
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className={`p-4 border-t space-y-3 font-sans ${
          isDark ? 'border-[#2D2C30]' : 'border-[#E8E6DF]'
        }`}>
          {user && (
            <div className={`px-3 py-2 rounded border flex items-center gap-2.5 ${
              isDark ? 'bg-[#252429] border-[#2D2C30]' : 'bg-[#FAF9F5] border-[#E8E6DF]'
            }`}>
              {user.avatar?.url ? (
                <img src={user.avatar.url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-[#B08D57] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {(user.name || 'Admin User').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isDark ? 'text-[#F5F3EF]' : 'text-[#1C1B1F]'}`}>{user.name || 'Admin User'}</p>
                <p className={`text-[11px] truncate ${isDark ? 'text-[#A8A5A0]' : 'text-[#64748B]'}`}>{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#252429] hover:bg-[#2D2C30] text-[#D4D1CB] border-[#2D2C30]'
                : 'bg-[#FAF9F5] hover:bg-[#F0EEE6] text-[#64748B] hover:text-[#1C1B1F] border-[#E8E6DF]'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

