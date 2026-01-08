import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTapes, getTapesByDJSlug, getDJDisplayName } from "../../../lib/data";

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {djName}
        </h1>

        <div className="grid gap-6 sm:grid-cols-2">
          {tapes.map((tape) => (
            <article
              key={tape.id}
              className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Link
                href={`/tapes/${tape.id}`}
                className="block text-xl font-semibold text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
              >
                {tape.title}
              </Link>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {tape.released}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tape.djs.map((dj) => (
                  <Link
                    key={dj.slug}
                    href={`/djs/${dj.slug}`}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {dj.name}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
