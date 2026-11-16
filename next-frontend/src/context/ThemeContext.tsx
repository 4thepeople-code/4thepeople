'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isCollegeDarkBlockedSurface } from '@/lib/routing/themeSurface';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // pathname re-runs the class effect on client navigation, so moving from a
  // dark marketing page into a college page (and back) re-applies the decision.
  const pathname = usePathname();

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem('yuva_theme') as Theme | null;
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'light';
  });

  // The college public side is single-theme: consumers there must render light
  // even when the saved preference is dark (mirrors the DOM class decision and
  // keeps SSR light rendering consistent, avoiding hydration mismatches).
  const onCollegeSurface =
    typeof window !== 'undefined' &&
    isCollegeDarkBlockedSurface(pathname, window.location.hostname);

  useEffect(() => {
    try {
      localStorage.setItem('yuva_theme', theme);
      localStorage.removeItem('yuva_manager_theme');
    } catch {
      // Ignore
    }

    const root = document.documentElement;
    const dark = theme === 'dark' && !onCollegeSurface;
    if (dark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }, [theme, pathname, onCollegeSurface]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark' && !onCollegeSurface;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'light',
      isDark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

export default ThemeContext;
