import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { getAllTapes, getTapesByDJSlug, getDJ, getDJLinks, getCoverImageWithFallback } from "../../../lib/data";

// Shared DJ badge styling
const DJ_BADGE_CLASS = "rounded-md bg-[#5e6ad2]/10 px-2.5 py-1 text-sm font-medium text-[#5e6ad2] hover:bg-[#5e6ad2]/20 dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5] dark:hover:bg-[#5e6ad2]/40 transition-colors";

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

  if (tapes.length === 0 || !dj) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">
          {dj.name}
        </h1>
        
        {dj.aka && dj.aka.length > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--muted)]">
            <span>AKA:</span>
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
          <div className="mb-6 flex flex-wrap gap-3 text-sm">
            {links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1 transition-colors"
              >
                {extractDomain(link)}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => (
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
                <Image
                  src={getCoverImageWithFallback(tape)}
                  alt={`${tape.title} mixtape by ${dj.name}`}
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
                  <p className="mt-2 text-sm text-[var(--muted)]">
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
                          className={`relative pointer-events-auto ${DJ_BADGE_CLASS}`}
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
