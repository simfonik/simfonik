"use client";

import { useEffect, useState } from "react";

function getInitial() {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("mock-theme");
  if (stored === "dark" || stored === "light") return stored;
  return "system";
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("mock-dark", dark);
  root.classList.toggle("mock-light", !dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitial();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const dark = mounted
    ? document.documentElement.classList.contains("mock-dark")
    : false;

  const toggle = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("mock-theme", next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? "Switch to light" : "Switch to dark") : "Toggle theme"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[var(--mock-text)] hover:bg-[var(--mock-bg-hover)] transition-colors cursor-pointer"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <clipPath id="mock-moon-left">
            <path d="M12 3 A9 9 0 0 0 12 21 Z" />
          </clipPath>
        </defs>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2} />
        <path d="M12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" />
        <g clipPath="url(#mock-moon-left)" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <line x1="-2" y1="22" x2="22" y2="-2" />
          <line x1="-2" y1="17" x2="22" y2="-7" />
          <line x1="-2" y1="27" x2="22" y2="3" />
          <line x1="-2" y1="32" x2="22" y2="8" />
        </g>
      </svg>
    </button>
  );
}
