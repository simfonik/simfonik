import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Header } from '../components/Header';

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
      <head>
        {/* Preload hero image to eliminate CSS-blocking discovery delay on LCP */}
        <link
          rel="preload"
          as="image"
          href="/optimized/site/800.webp"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - imagesrcset/imagesizes are valid preload attributes
          imagesrcset="/optimized/site/400.webp 400w, /optimized/site/640.webp 640w, /optimized/site/800.webp 800w, /optimized/site/1024.webp 1024w"
          imagesizes="(max-width: 640px) 800px, 100vw"
          fetchPriority="high"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg)] text-[var(--text)] min-h-screen`}
      >
        <Header />
        {children}
        <Analytics />
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
