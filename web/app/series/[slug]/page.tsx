import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSeries, getSeriesBySlug, getTapesBySeries, getCoverImageWithFallback } from "../../../lib/data";

const DJ_BADGE_CLASS = "dj-pill";

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
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--muted)] mb-2">
          Series
        </p>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-4">
          {series.name}
        </h1>
        {series.description && (
          <p className="text-[var(--muted)] mb-10 max-w-3xl leading-relaxed">{series.description}</p>
        )}

        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
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
              <article key={tape.id} className="group relative cursor-pointer">
                <Link
                  href={`/tapes/${tape.id}`}
                  className="absolute inset-0 z-10"
                  aria-label={`View ${tape.title}`}
                />
                <div className="relative w-full aspect-[3/2] mb-5 overflow-hidden pointer-events-none">
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
                <div className="flex items-baseline justify-between gap-3 mb-3 pointer-events-none">
                  {tape.released && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)]">
                      {tape.released}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl leading-[1.05] text-[var(--text)] mb-3 group-hover:text-[var(--accent-text)] transition-colors pointer-events-none">
                  {tape.title}
                </h2>
                <div className="flex flex-wrap gap-2 relative z-20">
                  {tape.djs.map((dj) => {
                    const shouldLink = dj.link !== false && dj.slug !== "unknown";
                    if (shouldLink) {
                      return (
                        <Link
                          key={dj.slug}
                          href={`/djs/${dj.slug}`}
                          className={DJ_BADGE_CLASS}
                        >
                          {dj.name}
                        </Link>
                      );
                    }
                    return (
                      <span
                        key={dj.slug}
                        className="dj-pill cursor-default"
                      >
                        {dj.name}
                      </span>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
