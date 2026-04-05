import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { headers } from 'next/headers';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Header } from '../components/Header';
import { NewsletterFooter } from '../components/NewsletterSignup';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "simfonik",
  description: "A curated archive of 90's rave DJ mixes.",
  metadataBase: new URL('https://simfonik.com'),
  openGraph: {
    title: "simfonik - DJ mixtape archive",
    description: "A curated archive of 90's rave DJ mixes.",
    url: "https://simfonik.com",
    siteName: "simfonik",
    images: [
      {
        url: "/media/site/og.jpg",
        width: 1200,
        height: 630,
        alt: "simfonik DJ mixtape archive",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "simfonik - DJ mixtape archive",
    description: "A curated archive of 90's rave DJ mixes.",
    images: ["/media/site/og.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const isAdmin = pathname.startsWith('/admin');
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg)] text-[var(--text)] min-h-screen`}
      >
        <Header />
        {children}
        <Analytics />
        {!isAdmin && (
          <footer className="mt-auto">
            <div className="border-t border-[var(--accent)]/20 bg-[var(--accent)]/[0.03]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <NewsletterFooter />
              </div>
            </div>
            <div className="border-t border-[var(--border)]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[var(--muted)]">
                <p>© respective artists and rights holders. Non-commercial archive.</p>
                <div className="flex gap-4">
                  <Link href="/about" className="hover:text-[var(--accent)] transition-colors">About</Link>
                  <Link href="/contribute" className="hover:text-[var(--accent)] transition-colors">Contribute</Link>
                  <Link href="/rights" className="hover:text-[var(--accent)] transition-colors">Rights &amp; Takedown</Link>
                </div>
              </div>
            </div>
          </footer>
        )}
        {process.env.VERCEL_ENV === 'production' && <SpeedInsights />}
      </body>
    </html>
  );
}
