'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <header className="border-b border-[var(--border)] bg-[var(--surface)]" ref={menuRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-block" onClick={() => setMobileMenuOpen(false)}>
            <div className="text-2xl font-bold">simfonik</div>
            <p className="text-sm text-[var(--muted)]">
              DJ mixtape archive
            </p>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/djs" className="text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium">
              Browse DJs
            </Link>
            <Link href="/about" className="text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium">
              About
            </Link>
            <Link href="/contribute" className="rounded-md bg-[var(--accent)] px-4 py-2 text-white font-medium hover:bg-[var(--accent-hover)] transition-colors">
              Contribute
            </Link>
          </nav>

          {/* Mobile Navigation - Button + Hamburger */}
          <div className="md:hidden flex items-center gap-3">
            <Link href="/contribute" className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-white font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap" onClick={() => setMobileMenuOpen(false)}>
              Contribute
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
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
          <nav className="md:hidden mt-4 pt-4 border-t border-[var(--border)] space-y-2">
            <Link 
              href="/djs" 
              className="block px-3 py-2 rounded-md text-[var(--text)] hover:bg-[var(--bg)] transition-colors font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse DJs
            </Link>
            <Link 
              href="/about" 
              className="block px-3 py-2 rounded-md text-[var(--text)] hover:bg-[var(--bg)] transition-colors font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
