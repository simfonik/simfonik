import Image from "next/image";
import { getAllTapes, getCoverImageWithFallback } from "../lib/data";
import { TapeGalleryWithSearch } from "../components/TapeGalleryWithSearch";

// Hero configuration
const HERO_TITLE = "";
const HERO_SUBTITLE = "";

export default function Home() {
  const tapes = getAllTapes();
  
  // Prepare tape data with cover images for client component
  const tapesWithCovers = tapes.map(tape => ({
    ...tape,
    coverImage: getCoverImageWithFallback(tape),
  }));
  
  const showHeroText = Boolean(HERO_TITLE || HERO_SUBTITLE);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Full-bleed hero section */}
      <div className="relative h-[140px] sm:h-[200px] lg:h-[280px] w-full overflow-hidden">
        <Image
          src="/media/site/home-hero.jpg"
          alt="Mixtape Archive Hero"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* Overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
        
        {/* Optional centered text */}
        {showHeroText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {HERO_TITLE && (
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
                {HERO_TITLE}
              </h2>
            )}
            {HERO_SUBTITLE && (
              <p className="mt-3 text-lg sm:text-xl text-white/90 drop-shadow-md">
                {HERO_SUBTITLE}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Existing constrained content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <TapeGalleryWithSearch tapes={tapesWithCovers} />
      </main>
    </div>
  );
}
