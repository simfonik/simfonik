import Link from "next/link";
import Image from "next/image";
import { getAllTapes, getCoverImageWithFallback } from "../lib/data";

// Hero configuration
const HERO_TITLE = "";
const HERO_SUBTITLE = "";

export default function Home() {
  const tapes = getAllTapes();
  const showHeroText = Boolean(HERO_TITLE || HERO_SUBTITLE);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Full-bleed hero section */}
      <div className="relative h-[220px] sm:h-[260px] lg:h-[320px] w-full overflow-hidden">
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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">
          Mixtapes
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => (
            <article
              key={tape.id}
              className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-[border-color,box-shadow] duration-500 hover:border-[var(--accent)]/40 hover:shadow-[0_0_20px_rgba(94,106,210,0.15)] dark:hover:shadow-[0_0_20px_rgba(168,174,245,0.1)] focus-within:ring-2 focus-within:ring-[var(--accent)] flex flex-col"
            >
              <Link
                href={`/tapes/${tape.id}`}
                className="absolute inset-0 rounded-lg"
                aria-label={`View ${tape.title}`}
              />
              
              {/* Cover Image */}
              <div className="relative w-full aspect-[3/2] bg-[var(--muted)]/10 pointer-events-none">
                <Image
                  src={getCoverImageWithFallback(tape)}
                  alt={`${tape.title} cover`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              
              <div className="relative pointer-events-none p-6 flex flex-col flex-grow">
                <div className="flex-grow">
                  <h2 className="text-xl font-semibold text-[var(--text)]">
                    {tape.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted)] min-h-[1.25rem]">
                    {tape.released}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tape.djs.map((dj) => {
                    const shouldLink = dj.link !== false && dj.slug !== "unknown";
                    
                    if (shouldLink) {
                      return (
                        <Link
                          key={dj.slug}
                          href={`/djs/${dj.slug}`}
                          className="relative pointer-events-auto rounded-md bg-[#5e6ad2]/10 px-2.5 py-1 text-sm font-medium text-[#5e6ad2] hover:bg-[#5e6ad2]/20 dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5] dark:hover:bg-[#5e6ad2]/40 transition-colors"
                        >
                          {dj.name}
                        </Link>
                      );
                    }
                    
                    return (
                      <span
                        key={dj.slug}
                        className="relative pointer-events-auto rounded-md bg-[var(--muted)]/20 border border-[var(--border)] px-2.5 py-1 text-sm font-medium text-[var(--muted)] cursor-default"
                      >
                        {dj.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
