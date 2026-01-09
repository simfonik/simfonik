import Link from "next/link";
import { getAllTapes } from "../lib/data";

export default function Home() {
  const tapes = getAllTapes();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Mixtapes
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => (
            <article
              key={tape.id}
              className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Link
                href={`/tapes/${tape.id}`}
                className="block text-xl font-semibold text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
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
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
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
