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
                className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-all group-hover:border-[var(--accent)]"
              >
                <Link
                  href={`/djs/${dj.slug}`}
                  className="block h-full p-6 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                  <h2 className="text-xl font-semibold text-[var(--text)]">
                    {dj.name}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {dj.tapeCount} {dj.tapeCount === 1 ? "tape" : "tapes"}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
