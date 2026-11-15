'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NewsletterModal, useNewsletterModal } from './NewsletterSignup';
import { ThemeToggle } from './ThemeToggle';
import { SimfonikLockup } from './SimfonikLockup';

const NAV_LINK_CLASSES =
  'font-mono text-[12px] uppercase tracking-[0.1em] font-semibold text-[var(--text)] hover:underline underline-offset-[6px] decoration-[1.5px] transition-colors';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { open, onOpen, onClose } = useNewsletterModal();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header ref={menuRef}>
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
              <button onClick={onOpen} className="poster-btn">
                Subscribe
              </button>
            </nav>

            {/* Mobile Navigation - ThemeToggle + Hamburger */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <button
                ref={menuButtonRef}
                type="button"
                className="relative before:absolute before:-inset-0.5 before:content-[''] inline-flex items-center justify-center p-2 text-[var(--text)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pt-4 border-t-[1.5px] border-[var(--border)] flex flex-col gap-1">
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
              <button
                type="button"
                onClick={() => {
                  // This button goes when the menu shuts. The menu button takes the keyboard first, so it is
                  // where focus comes back to when the Subscribe window is closed.
                  menuButtonRef.current?.focus();
                  setMobileMenuOpen(false);
                  onOpen();
                }}
                className={`block px-3 py-[13px] text-left ${NAV_LINK_CLASSES}`}
              >
                Subscribe
              </button>
            </nav>
          )}
        </div>
      </header>
      <NewsletterModal open={open} onClose={onClose} />
    </>
  );
}
