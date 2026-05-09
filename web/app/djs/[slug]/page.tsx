import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { getAllTapes, getTapesByDJSlug, getDJ, getDJLinks, getDJBio, getCoverImageWithFallback } from "../../../lib/data";
import { DJBio } from "./DJBio";
import { JsonLd } from "../../../components/JsonLd";
import { generateDJSchema } from "../../../lib/structured-data";

// Shared DJ pill class — same hover-reveal outline as home grid
const DJ_BADGE_CLASS = "dj-pill";

// Helper to extract domain from URL
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export async function generateStaticParams() {
  const tapes = getAllTapes();
  const slugs = new Set<string>();
  for (const tape of tapes) {
    for (const dj of tape.djs) {
      // Skip "unknown" - no page should be generated for it
      if (dj.slug !== 'unknown') {
        slugs.add(dj.slug);
      }
    }
  }
  return Array.from(slugs).map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dj = getDJ(slug);

  if (!dj) {
    return {};
  }

  return {
    title: {
      absolute: `${dj.name} mixtape archive`
    },
    description: `DJ mixes and recordings by ${dj.name}`,
  };
}

export default async function DJPage({ params }: Props) {
  const { slug } = await params;
  const dj = getDJ(slug);
  const tapes = getTapesByDJSlug(slug);
  const links = getDJLinks(slug);
  const bio = getDJBio(slug);

  if (tapes.length === 0 || !dj) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={generateDJSchema(dj, bio, links)} />
      
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-4">
          {dj.name}
        </h1>

        {dj.aka && dj.aka.length > 0 && (
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            <span>AKA</span>
            <div className="flex flex-wrap gap-2">
              {dj.aka.map((alias) => (
                <Link
                  key={alias.slug}
                  href={`/djs/${alias.slug}`}
                  className={DJ_BADGE_CLASS}
                >
                  {alias.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.22em]">
            {links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[var(--text)] hover:text-[var(--accent-text)] inline-flex items-center gap-1 transition-colors"
              >
                {extractDomain(link)}
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}

        {bio && <DJBio bio={bio} />}

        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => {
            const coverImage = getCoverImageWithFallback(tape);
            const isJpg = coverImage.includes('/media/') && coverImage.endsWith('.jpg');

            let optimizedSrc = null;
            let optimizedSrcSet = null;

            if (isJpg) {
              if (tape.images?.cover === coverImage) {
                optimizedSrc = `/optimized/${tape.id}/800.avif`;
                optimizedSrcSet = `/optimized/${tape.id}/400.avif 400w, /optimized/${tape.id}/800.avif 800w, /optimized/${tape.id}/1200.avif 1200w`;
              } else {
                const side = tape.sides.find(s => s.image === coverImage);
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
                    alt={`${tape.title} mixtape by ${dj.name}`}
                    loading="lazy"
                    className={`absolute inset-0 w-full h-full object-contain ${coverImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
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
                  {tape.djs.map((tdj) => {
                    const shouldLink = tdj.link !== false && tdj.slug !== "unknown";
                    if (shouldLink) {
                      return (
                        <Link
                          key={tdj.slug}
                          href={`/djs/${tdj.slug}`}
                          className="dj-pill"
                        >
                          {tdj.name}
                        </Link>
                      );
                    }
                    return (
                      <span
                        key={tdj.slug}
                        className="dj-pill cursor-default"
                      >
                        {tdj.name}
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
