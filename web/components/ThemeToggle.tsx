'use client';

import { useEffect, useState } from 'react';

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('theme-dark', dark);
  root.classList.toggle('theme-light', !dark);
}

function readStored(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return 'system';
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const initial = readStored();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const dark = mounted
    ? document.documentElement.classList.contains('theme-dark')
    : false;

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('theme', next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? 'Switch to light' : 'Switch to dark') : 'Toggle theme'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
      suppressHydrationWarning
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <clipPath id="theme-moon-left">
            <path d="M12 3 A9 9 0 0 0 12 21 Z" />
          </clipPath>
        </defs>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2} />
        <path d="M12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" />
        <g clipPath="url(#theme-moon-left)" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <line x1="-2" y1="22" x2="22" y2="-2" />
          <line x1="-2" y1="17" x2="22" y2="-7" />
          <line x1="-2" y1="27" x2="22" y2="3" />
          <line x1="-2" y1="32" x2="22" y2="8" />
        </g>
      </svg>
    </button>
  );
}

// Inline script content — runs synchronously in <head> to set the theme class
// before paint, preventing FOUC. Mirrors the logic in applyTheme above.
export const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'theme-dark':'theme-light');}catch(e){}})();`;
