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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen`}
      >
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/" className="inline-block">
              <h1 className="text-2xl font-bold">Simfonik</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                DJ mixtape archive
              </p>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
