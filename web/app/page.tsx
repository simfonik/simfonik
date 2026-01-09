import Link from "next/link";
import { getAllTapes } from "../lib/data";

export default function Home() {
  const tapes = getAllTapes();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">
          Mixtapes
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tapes.map((tape) => (
            <article
              key={tape.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:border-[var(--accent)]"
            >
              <Link
                href={`/tapes/${tape.id}`}
                className="block text-xl font-semibold text-[var(--text)] hover:text-[var(--accent)] dark:hover:text-[var(--accent-hover)] transition-colors"
              >
                {tape.title}
              </Link>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {tape.released}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tape.djs.map((dj) => (
                  <Link
                    key={dj.slug}
                    href={`/djs/${dj.slug}`}
                    className="rounded-md bg-[#5e6ad2]/10 px-2.5 py-1 text-sm font-medium text-[#5e6ad2] hover:bg-[#5e6ad2]/20 dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5] dark:hover:bg-[#5e6ad2]/40 transition-colors"
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
