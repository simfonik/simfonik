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
      className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-md text-[var(--text)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
      suppressHydrationWarning
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M12 3l0 18" />
        <path d="M12 9l4.65 -4.65" />
        <path d="M12 14.3l7.37 -7.37" />
        <path d="M12 19.6l8.85 -8.85" />
      </svg>
    </button>
  );
}

// Inline script content — runs synchronously in <head> to set the theme class
// before paint, preventing FOUC. Mirrors the logic in applyTheme above.
export const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'theme-dark':'theme-light');}catch(e){}})();`;
