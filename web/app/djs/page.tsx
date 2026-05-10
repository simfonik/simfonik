import Link from "next/link";
import { getAllDJs } from "../../lib/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "DJ Mixes by Artist"
  },
  description: "Browse 90's rave DJ mixtapes organized by artist. Features mixes from DJ Trance, Doc Martin, Mark Farina, and more from the early Los Angeles underground.",
};

const MAX_VISIBLE_TAPES = 4;

export default function DJsIndexPage() {
  const djs = getAllDJs();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-10">
          DJs
        </h1>

        {djs.length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            No DJs found.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {djs.map((dj) => {
              const visibleTapes = dj.tapes.slice(0, MAX_VISIBLE_TAPES);
              const remainingCount = dj.tapeCount - MAX_VISIBLE_TAPES;

              return (
                <article
                  key={dj.slug}
                  className="group relative cursor-pointer border-t-[1.5px] border-[var(--border)] pt-6 [&:first-child]:border-t-0 [&:first-child]:pt-0 sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(2)]:pt-0 lg:[&:nth-child(3)]:border-t-0 lg:[&:nth-child(3)]:pt-0"
                >
                  <Link
                    href={`/djs/${dj.slug}`}
                    className="absolute inset-0"
                    aria-label={`View ${dj.name}`}
                  />
                  <div className="flex items-baseline gap-3 mb-3 pointer-events-none">
                    <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
                      {dj.tapeCount} {dj.tapeCount === 1 ? "mix" : "mixes"}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl leading-[1.05] text-[var(--text)] group-hover:text-[var(--accent-text)] transition-colors mb-3 pointer-events-none">
                    {dj.name}
                  </h2>
                  {visibleTapes.length > 0 && (
                    <ul className="space-y-1">
                      {visibleTapes.map((tape) => (
                        <li key={tape.id} className="truncate">
                          <Link
                            href={`/tapes/${tape.id}`}
                            className="relative text-sm text-[var(--muted)] hover:text-[var(--accent-hover)] transition-colors"
                          >
                            {tape.title}
                          </Link>
                        </li>
                      ))}
                      {remainingCount > 0 && (
                        <li className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-2 pointer-events-none">
                          + {remainingCount} more
                        </li>
                      )}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
