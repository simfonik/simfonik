import Link from "next/link";
import { getAllDJs } from "../../lib/data";

export default function DJsIndexPage() {
  const djs = getAllDJs();
  const MAX_VISIBLE_TAPES = 4;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">
          DJs
        </h1>

        {djs.length === 0 ? (
          <p className="text-[var(--muted)]">No DJs found.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {djs.map((dj) => {
              const visibleTapes = dj.tapes.slice(0, MAX_VISIBLE_TAPES);
              const remainingCount = dj.tapes.length - MAX_VISIBLE_TAPES;
              
              return (
                <article
                  key={dj.slug}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--accent)]"
                >
                  <Link
                    href={`/djs/${dj.slug}`}
                    className="block h-full p-6 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                  >
                    <h2 className="text-xl font-semibold text-[var(--text)]">
                      {dj.name}
                    </h2>
                    <span className="inline-block mt-2 rounded-md bg-[#5e6ad2]/10 px-2 py-0.5 text-xs font-medium text-[#5e6ad2] dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5]">
                      {dj.tapeCount} {dj.tapeCount === 1 ? "mix" : "mixes"}
                    </span>
                    {dj.tapes.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {visibleTapes.map((tape) => (
                          <li
                            key={tape.id}
                            className="text-sm text-[var(--muted)] truncate"
                          >
                            {tape.title}
                          </li>
                        ))}
                        {remainingCount > 0 && (
                          <li className="text-sm text-[var(--muted)] font-medium">
                            + {remainingCount} more
                          </li>
                        )}
                      </ul>
                    )}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
