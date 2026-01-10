import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllTapes, getTapesByDJSlug, getDJDisplayName, getCoverImageWithFallback } from "../../../lib/data";

export async function generateStaticParams() {
  const tapes = getAllTapes();
  const slugs = new Set<string>();
  for (const tape of tapes) {
    for (const dj of tape.djs) {
      slugs.add(dj.slug);
    }
  }
  return Array.from(slugs).map((slug) => ({ slug }));
}

export default async function DJPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const djName = getDJDisplayName(slug);
  const tapes = getTapesByDJSlug(slug);

  if (tapes.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">
          {djName}
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => (
            <article
              key={tape.id}
              className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-all hover:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]"
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
              
              <div className="relative pointer-events-none p-6">
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  {tape.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {tape.released}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tape.djs.map((dj) => (
                    <Link
                      key={dj.slug}
                      href={`/djs/${dj.slug}`}
                      className="relative pointer-events-auto rounded-md bg-[#5e6ad2]/10 px-2.5 py-1 text-sm font-medium text-[#5e6ad2] hover:bg-[#5e6ad2]/20 dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5] dark:hover:bg-[#5e6ad2]/40 transition-colors"
                    >
                      {dj.name}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
