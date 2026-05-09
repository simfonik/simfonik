import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

// Hard gate: /dev/* routes are dev-only. In a production build this
// returns 404 for the entire subtree. To eventually expose specific
// playgrounds publicly, swap NODE_ENV for an allowlist or env flag.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <>{children}</>;
}
