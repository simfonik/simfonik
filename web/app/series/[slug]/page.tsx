import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSeries, getSeriesBySlug, getTapesBySeries, getCoverImageWithFallback } from "../../../lib/data";

// Shared DJ badge styling (same as DJ page)
const DJ_BADGE_CLASS =
  "rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--text)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] dark:border-[#5e6ad2]/50 dark:bg-[#5e6ad2]/20 dark:hover:bg-[#5e6ad2] dark:hover:text-white transition-all cursor-pointer";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const series = getAllSeries();
  return series.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    return {};
  }

  return {
    title: { absolute: `${series.name} – Series` },
    description: series.description ?? `All tapes in the ${series.name} series.`,
    robots: { index: false, follow: false },
  };
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);
  const tapes = getTapesBySeries(slug);

  if (!series || tapes.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-2 text-sm text-[var(--muted)]">Series</p>
        <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">{series.name}</h1>
        {series.description && (
          <p className="mb-8 text-[var(--muted)]">{series.description}</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => {
            const coverImage = getCoverImageWithFallback(tape);
            const isJpg = coverImage.includes("/media/") && coverImage.endsWith(".jpg");

            let optimizedSrc: string | null = null;
            let optimizedSrcSet: string | null = null;

            if (isJpg) {
              if (tape.images?.cover === coverImage) {
                optimizedSrc = `/optimized/${tape.id}/800.avif`;
                optimizedSrcSet = `/optimized/${tape.id}/400.avif 400w, /optimized/${tape.id}/800.avif 800w, /optimized/${tape.id}/1200.avif 1200w`;
              } else {
                const side = tape.sides.find((s) => s.image === coverImage);
                if (side) {
                  const pos = side.position.toLowerCase();
                  optimizedSrc = `/optimized/${tape.id}/sides/${pos}/800.avif`;
                  optimizedSrcSet = `/optimized/${tape.id}/sides/${pos}/400.avif 400w, /optimized/${tape.id}/sides/${pos}/800.avif 800w, /optimized/${tape.id}/sides/${pos}/1200.avif 1200w`;
                }
              }
            }

            return (
              <article
                key={tape.id}
                className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-all hover:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)] flex flex-col"
              >
                <Link
                  href={`/tapes/${tape.id}`}
                  className="absolute inset-0 rounded-lg"
                  aria-label={`View ${tape.title}`}
                />

                {/* Cover Image */}
                <div className="relative w-full aspect-[3/2] bg-[var(--muted)]/10 pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optimizedSrc || coverImage}
                    srcSet={optimizedSrcSet || undefined}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    alt={`${tape.title} mixtape`}
                    loading="lazy"
                    className={`absolute inset-0 w-full h-full object-contain ${coverImage.includes("/generated/placeholders/") ? "scale-90" : ""}`}
                  />
                </div>

                <div className="relative pointer-events-none p-6 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <h2 className="text-xl font-semibold text-[var(--text)]">{tape.title}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">{tape.released}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tape.djs.map((dj) => {
                      const shouldLink = dj.link !== false && dj.slug !== "unknown";
                      if (shouldLink) {
                        return (
                          <Link
                            key={dj.slug}
                            href={`/djs/${dj.slug}`}
                            className={`relative pointer-events-auto ${DJ_BADGE_CLASS}`}
                          >
                            {dj.name}
                          </Link>
                        );
                      }
                      return (
                        <span
                          key={dj.slug}
                          className="relative pointer-events-auto rounded-full bg-[var(--muted)]/10 border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--muted)] cursor-default"
                        >
                          {dj.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
