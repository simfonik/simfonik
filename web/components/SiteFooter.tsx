'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewsletterFooter } from './NewsletterSignup';

// Reads the path on the client so the root layout stays static. Reading
// request headers there made every page render on each request.
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="mt-16 sm:mt-24">
      <div className="border-t-[1.5px] border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <NewsletterFooter />
        </div>
      </div>
      <div className="border-t-[1.5px] border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <p>© respective artists &amp; rights holders · non-commercial</p>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-[var(--accent-text)] transition-colors">About</Link>
            <Link href="/contribute" className="hover:text-[var(--accent-text)] transition-colors">Contribute</Link>
            <Link href="/rights" className="hover:text-[var(--accent-text)] transition-colors">Rights &amp; Takedown</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
