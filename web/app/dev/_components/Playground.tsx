import Link from 'next/link';
import type { ReactNode } from 'react';

// Minimal wrapper for /dev/* playgrounds. Adds a floating back-to-index
// link without intruding on the playground's own layout — pages keep
// full control of their canvas / sidebar / chrome.
export function Playground({ children }: { children: ReactNode }) {
  return (
    <>
      <Link
        href="/dev"
        className="fixed top-3 left-3 z-50 text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-50 hover:opacity-100 transition-opacity"
      >
        ← /dev
      </Link>
      {children}
    </>
  );
}
