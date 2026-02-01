import type { Metadata } from "next";
import { getAllTapes, getCoverImageWithFallback } from "../lib/data";
import { getRecentComments } from "../lib/comments";
import { TapeGalleryWithSearch } from "../components/TapeGalleryWithSearch";
import { RecentCommentsTicker } from "../components/RecentCommentsTicker";
import { JsonLd } from "../components/JsonLd";
import { generateWebsiteSchema } from "../lib/structured-data";

export const metadata: Metadata = {
  title: {
    absolute: "90s Rave DJ Mixtapes - Los Angeles Underground Archive"
  },
  description: "Curated archive of 90s rave DJ mixes from the early Los Angeles underground scene.",
};

// ISR: Revalidate every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const tapes = getAllTapes();
  const recentComments = await getRecentComments(10);
  
  // Prepare tape data with cover images for client component
  const tapesWithCovers = tapes.map(tape => ({
    ...tape,
    coverImage: getCoverImageWithFallback(tape),
  }));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <JsonLd data={generateWebsiteSchema()} />
      
      {/* Full-bleed hero section */}
      <div className="relative h-[140px] sm:h-[200px] lg:h-[280px] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/optimized/site/1024.webp"
          srcSet="/optimized/site/640.webp 640w, /optimized/site/1024.webp 1024w, /optimized/site/1920.webp 1920w"
          sizes="100vw"
          alt="Cassette tapes from 1990s Los Angeles rave scene"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>

      {/* Recent Comments Ticker */}
      <RecentCommentsTicker comments={recentComments} />

      {/* Existing constrained content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <TapeGalleryWithSearch tapes={tapesWithCovers} />
      </main>
    </div>
  );
}
