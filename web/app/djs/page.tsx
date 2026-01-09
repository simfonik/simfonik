import Link from "next/link";
import { getAllDJs } from "../../lib/data";

export default function DJsIndexPage() {
  const djs = getAllDJs();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          DJs
        </h1>

        {djs.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No DJs found.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {djs.map((dj) => (
              <article
                key={dj.slug}
                className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Link
                  href={`/djs/${dj.slug}`}
                  className="block text-xl font-semibold text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
                >
                  {dj.name}
                </Link>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {dj.tapeCount} {dj.tapeCount === 1 ? "tape" : "tapes"}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
