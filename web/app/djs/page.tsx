import Link from "next/link";
import { getAllDJs } from "../../lib/data";

export default function DJsIndexPage() {
  const djs = getAllDJs();

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
            {djs.map((dj) => (
              <article
                key={dj.slug}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:border-[var(--accent)]"
              >
                <Link
                  href={`/djs/${dj.slug}`}
                  className="block text-xl font-semibold text-[var(--text)] hover:text-[var(--accent)] dark:hover:text-[var(--accent-hover)] transition-colors"
                >
                  {dj.name}
                </Link>
                <p className="mt-2 text-sm text-[var(--muted)]">
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
