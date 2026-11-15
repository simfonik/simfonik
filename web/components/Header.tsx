'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NewsletterInline, useNewsletterForm } from './NewsletterSignup';
import { ThemeToggle } from './ThemeToggle';
import { SimfonikLockup } from './SimfonikLockup';

const NAV_LINK_CLASSES =
  'font-mono text-[12px] uppercase tracking-[0.1em] font-semibold text-[var(--text)] hover:underline underline-offset-[6px] decoration-[1.5px] transition-colors';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // The sign-up, where the header shows it: at the bottom of the phone menu, and in a panel under the
  // Subscribe button on wider screens. One state for both.
  const signup = useNewsletterForm();
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const subscribeRef = useRef<HTMLDivElement>(null);
  const subscribeButtonRef = useRef<HTMLButtonElement>(null);
  const subscribeFieldRef = useRef<HTMLInputElement>(null);

  // Escape shuts whichever is open and gives the keyboard back to the button that opened it.
  useEffect(() => {
    if (!mobileMenuOpen && !subscribeOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      (mobileMenuOpen ? menuButtonRef : subscribeButtonRef).current?.focus();
      setMobileMenuOpen(false);
      setSubscribeOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen, subscribeOpen]);

  // The Subscribe panel: the field takes the keyboard as it opens, and a press anywhere else shuts it.
  useEffect(() => {
    if (!subscribeOpen) return;
    subscribeFieldRef.current?.focus();
    function handlePressOutside(event: PointerEvent) {
      if (!subscribeRef.current?.contains(event.target as Node)) setSubscribeOpen(false);
    }
    document.addEventListener('pointerdown', handlePressOutside);
    return () => document.removeEventListener('pointerdown', handlePressOutside);
  }, [subscribeOpen]);

  return (
    // Above the page, so the phone menu and the dimming behind it lie over what follows. Tabbing on past the
    // menu's last link shuts it: the page it would land on is under the dimming.
    <header
      className="relative z-40"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          setMobileMenuOpen(false);
        }
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="wordmark-link inline-flex"
            onClick={() => setMobileMenuOpen(false)}
          >
            <SimfonikLockup />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/djs" className={NAV_LINK_CLASSES}>
              Browse DJs
            </Link>
            <Link href="/about" className={NAV_LINK_CLASSES}>
              About
            </Link>
            <Link href="/contribute" className={NAV_LINK_CLASSES}>
              Contribute
            </Link>
            <ThemeToggle />
            {/* Subscribe opens a small panel under itself, over the page, with the sign-up in it. Tabbing
                on out of the panel shuts it. */}
            <div
              ref={subscribeRef}
              className="relative"
              onBlur={(event) => {
                if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
                  setSubscribeOpen(false);
                }
              }}
            >
              <button
                ref={subscribeButtonRef}
                type="button"
                onClick={() => setSubscribeOpen(!subscribeOpen)}
                className="poster-btn"
                aria-expanded={subscribeOpen}
                aria-controls="subscribe-panel"
              >
                Subscribe
              </button>
              {subscribeOpen && (
                <div
                  id="subscribe-panel"
                  role="dialog"
                  aria-label="Subscribe"
                  className="absolute right-0 top-full mt-3 w-[26rem] bg-[var(--bg)] border-[1.5px] border-[var(--text)] px-5 pt-5 pb-3"
                >
                  <NewsletterInline form={signup} fieldRef={subscribeFieldRef} />
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Navigation - ThemeToggle + Hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              ref={menuButtonRef}
              type="button"
              className="relative before:absolute before:-inset-0.5 before:content-[''] inline-flex items-center justify-center p-2 text-[var(--text)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Phone menu: a panel over the page, hung from the header's bottom edge, with the page dimmed and
          held still behind it (see .menu-scrim). A press on the dimming shuts it. */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="menu-scrim absolute inset-x-0 top-full h-dvh" onClick={() => setMobileMenuOpen(false)} />
          <nav
            id="mobile-menu"
            className="absolute inset-x-0 top-full bg-[var(--bg)] border-y-[1.5px] border-[var(--border)] overscroll-contain"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col gap-1">
              <Link
                href="/djs"
                className={`block px-3 py-[13px] ${NAV_LINK_CLASSES}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse DJs
              </Link>
              <Link
                href="/about"
                className={`block px-3 py-[13px] ${NAV_LINK_CLASSES}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/contribute"
                className={`block px-3 py-[13px] ${NAV_LINK_CLASSES}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
              </Link>
              <div className="mt-2 border-t-[1.5px] border-[var(--border)] px-3 pt-5 pb-1">
                <NewsletterInline form={signup} />
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
