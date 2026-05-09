import Link from 'next/link';

export const metadata = {
  title: '/dev — simfonik',
};

// Add new playgrounds here as you build them.
const PLAYGROUNDS = [
  {
    slug: 'circles2',
    title: 'circles2',
    description: 'Code-only riso wordmark — live filter knobs.',
  },
] as const;

export default function DevIndexPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-4xl mb-2 text-[var(--text)]">/dev</h1>
        <p className="text-sm font-mono opacity-60 mb-8 text-[var(--text)]">
          Internal experiments. Not exposed in production.
        </p>
        <ul className="space-y-3">
          {PLAYGROUNDS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/dev/${p.slug}`}
                className="block border border-[var(--border)] p-4 hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors"
              >
                <div className="font-mono text-sm uppercase tracking-wide">
                  {p.title}
                </div>
                <div className="text-xs opacity-60 mt-1 font-mono">
                  {p.description}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
