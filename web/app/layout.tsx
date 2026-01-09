import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simfonik",
  description: "A curated archive of DJ mixtapes and sets",
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
                <h1 className="text-2xl font-bold">Simfonik</h1>
                <p className="text-sm text-[var(--muted)]">
                  DJ mixtape archive
                </p>
              </Link>
              <nav>
                <Link href="/djs" className="text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium">
                  Browse DJs
                </Link>
              </nav>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
