import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { SpeedInsights } from '@vercel/speed-insights/next';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg)] text-[var(--text)] min-h-screen`}
      >
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-block">
                <h1 className="text-2xl font-bold">simfonik</h1>
                <p className="text-sm text-[var(--muted)]">
                  DJ mixtape archive
                </p>
              </Link>
              <nav className="flex items-center gap-6">
                <Link href="/djs" className="text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium">
                  Browse DJs
                </Link>
                <Link href="/about" className="text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium">
                  About
                </Link>
              </nav>
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-xs text-[var(--muted)]">
              © respective artists and rights holders. Non-commercial archive.{" "}
              <Link href="/rights" className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors underline">
                Rights &amp; Takedown
              </Link>
            </p>
          </div>
        </footer>
        {process.env.VERCEL_ENV === 'production' && <SpeedInsights />}
      </body>
    </html>
  );
}
