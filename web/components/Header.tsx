'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NewsletterInline, useNewsletterForm } from './NewsletterSignup';
import { ThemeToggle } from './ThemeToggle';
import { SimfonikLockup } from './SimfonikLockup';

const NAV_LINK_CLASSES =
  'font-mono text-[12px] uppercase tracking-[0.1em] font-semibold text-[var(--text)] hover:underline underline-offset-[6px] decoration-[1.5px] transition-colors';

/** A row of the phone menu: the whole row is the link, and it darkens under a press. */
const MENU_ROW_CLASSES = `block px-3 py-[13px] active:bg-[var(--bg-hover)] ${NAV_LINK_CLASSES}`;

type Panel = 'menu' | 'subscribe';

export function Header() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const subscribeRef = useRef<HTMLDivElement>(null);
  const subscribeButtonRef = useRef<HTMLButtonElement>(null);

  // The header has two things that open over the page: the phone menu, and the panel under the Subscribe
  // button on wider screens. What is open is remembered with the page it was opened on, so going anywhere
  // else, by a link, by Back, by any road, leaves it shut. The header itself is never rebuilt between pages.
  const [opened, setOpened] = useState<{ panel: Panel; on: string } | null>(null);
  const open = opened?.on === pathname ? opened.panel : null;
  const menuOpen = open === 'menu';
  const subscribeOpen = open === 'subscribe';
  const toggle = (panel: Panel) => setOpened(open === panel ? null : { panel, on: pathname });
  const close = () => setOpened(null);

  // The sign-up, in whichever of the two is showing it. One state for both.
  const signup = useNewsletterForm();
  const signupField = signup.fieldRef;

  // Escape shuts whichever is open and gives the keyboard back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      (open === 'menu' ? menuButtonRef : subscribeButtonRef).current?.focus();
      setOpened(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // The phone menu takes the page over. While it is open the rest of the page is out of reach: of the
  // keyboard, and of a screen reader, which would otherwise read on into what is dimmed. And it shuts if the
  // window grows to where the header shows its links in a row, where there is no menu to be open.
  useEffect(() => {
    if (!menuOpen) return;
    const rest = [...document.body.children].filter(
      (el) => el !== headerRef.current && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName) && !el.tagName.includes('-'),
    );
    rest.forEach((el) => el.setAttribute('inert', ''));
    const wide = window.matchMedia('(min-width: 48rem)');
    const handleWide = () => wide.matches && setOpened(null);
    wide.addEventListener('change', handleWide);
    return () => {
      rest.forEach((el) => el.removeAttribute('inert'));
      wide.removeEventListener('change', handleWide);
    };
  }, [menuOpen]);

  // The Subscribe panel: the field takes the keyboard as it opens, and a press anywhere else shuts it.
  useEffect(() => {
    if (!subscribeOpen) return;
    signupField.current?.focus();
    function handlePressOutside(event: PointerEvent) {
      if (!subscribeRef.current?.contains(event.target as Node)) setOpened(null);
    }
    document.addEventListener('pointerdown', handlePressOutside);
    return () => document.removeEventListener('pointerdown', handlePressOutside);
  }, [subscribeOpen, signupField]);

  return (
    // Above the page, so the phone menu and the dimming behind it lie over what follows.
    <header ref={headerRef} className="relative z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="wordmark-link inline-flex" onClick={close}>
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
            {/* Subscribe opens a small panel under itself, over the page, with the sign-up in it. Tabbing on
                out of the panel shuts it. */}
            <div
              ref={subscribeRef}
              className="relative"
              onBlur={(event) => {
                if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close();
              }}
            >
              <button
                ref={subscribeButtonRef}
                type="button"
                onClick={() => toggle('subscribe')}
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
                  <NewsletterInline form={signup} />
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
              className="relative before:absolute before:-inset-0.5 before:content-[''] inline-flex items-center justify-center p-2 text-[var(--text)] active:opacity-60 transition-opacity cursor-pointer"
              onClick={() => toggle('menu')}
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Phone menu: a panel over the page, hung from the header's bottom edge, with the page dimmed and held
          still behind it (see .menu-scrim). A press on the dimming shuts it. On a screen too short for it,
          a phone on its side, the panel scrolls within itself. */}
      {menuOpen && (
        <div className="md:hidden">
          <div className="menu-scrim absolute inset-x-0 top-full h-dvh" onClick={close} />
          <nav
            id="mobile-menu"
            aria-label="Menu"
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.75rem)] overflow-y-auto overscroll-contain bg-[var(--bg)] border-y-[1.5px] border-[var(--border)]"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col gap-1">
              <Link href="/djs" className={MENU_ROW_CLASSES} onClick={close}>
                Browse DJs
              </Link>
              <Link href="/about" className={MENU_ROW_CLASSES} onClick={close}>
                About
              </Link>
              <Link href="/contribute" className={MENU_ROW_CLASSES} onClick={close}>
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
