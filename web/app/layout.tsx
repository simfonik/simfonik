import type { Metadata } from "next";
import { Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { themeInitScript } from '../components/ThemeToggle';

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Default content; themeInitScript updates it synchronously
            before paint based on stored/OS theme. ThemeToggle keeps it
            in sync on manual toggles. Drives iOS Safari browser
            chrome color (and Android Chrome status bar). */}
        <meta name="theme-color" content="#f7f7f7" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistMono.variable} ${anton.variable} antialiased bg-[var(--bg)] text-[var(--text)] min-h-screen`}
      >
        <Header />
        {children}
        <Analytics />
        <SiteFooter />
        {process.env.VERCEL_ENV === 'production' && <SpeedInsights />}
      </body>
    </html>
  );
}
