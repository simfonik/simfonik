'use client';

import { useState, useCallback, useMemo, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { TapeListSubset } from '../types/tape';
import imageLoader from '../lib/imageLoader';

type TapeWithCover = TapeListSubset & {
  coverImage: string;
  catalogNumber: string;
};

interface TapeGalleryWithSearchProps {
  tapes: TapeWithCover[];
}

export function TapeGalleryWithSearch({ tapes }: TapeGalleryWithSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const [, startTransition] = useTransition();

  // Ref callback: attaches/detaches the observer whenever the sentinel mounts or unmounts.
  // This is necessary because the sentinel is conditionally rendered — a one-time useEffect
  // misses re-mounts that happen when visibleCount resets on a new search.
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 12);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const filteredTapes = useMemo(() => {
    return tapes.filter((tape) => {
      if (!searchQuery.trim()) return true;
      const normalize = (str: string) =>
        str.toLowerCase().replace(/[.\-\s]/g, '');
      const normalizedQuery = normalize(searchQuery);
      const titleMatch = normalize(tape.title).includes(normalizedQuery);
      const djMatch = tape.djs.some((dj) =>
        normalize(dj.name).includes(normalizedQuery)
      );
      const yearMatch = tape.released?.includes(searchQuery.trim());
      return titleMatch || djMatch || yearMatch;
    });
  }, [tapes, searchQuery]);

  const visibleTapes = filteredTapes.slice(0, visibleCount);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    startTransition(() => {
      setSearchQuery(value);
      setVisibleCount(6);
    });
  };

  return (
    <>
      {/* Mixtapes header + underline search */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)]">
            Mixtapes
          </h1>
          <div className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.333rem)] relative pb-1 border-b-[1.5px] border-[var(--text)] flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={inputValue}
              onChange={handleSearchChange}
              placeholder="Search by DJ, title, or year"
              className="font-mono w-full bg-transparent py-1.5 text-[12px] tracking-wide text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tape grid */}
      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTapes.map((tape, index) => {
          const isAboveFold = index < 3;
          return (
            <article key={tape.id} className="group relative">
              <Link
                href={`/tapes/${tape.id}`}
                className="absolute inset-0"
                aria-label={`View ${tape.title}`}
              />
              <div className="relative w-full aspect-[3/2] mb-5 overflow-hidden">
                <Image
                  loader={imageLoader}
                  src={tape.coverImage}
                  alt={`${tape.title} mixtape cover`}
                  fill
                  priority={isAboveFold}
                  className={`object-contain ${tape.coverImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)]">
                  № {tape.catalogNumber}
                </span>
                {tape.released && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)]">
                    {tape.released}
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl leading-[1.05] text-[var(--text)] mb-3 group-hover:text-[var(--accent-text)] transition-colors">
                {tape.title}
              </h2>
              <div className="flex flex-wrap gap-2">
                {tape.djs.map((dj) => {
                  const shouldLink = dj.link !== false && dj.slug !== 'unknown';
                  if (shouldLink) {
                    return (
                      <Link
                        key={dj.slug}
                        href={`/djs/${dj.slug}`}
                        className="dj-pill relative pointer-events-auto"
                      >
                        {dj.name}
                      </Link>
                    );
                  }
                  return (
                    <span
                      key={dj.slug}
                      className="dj-pill relative pointer-events-auto cursor-default"
                    >
                      {dj.name}
                    </span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {visibleTapes.length < filteredTapes.length && (
        <div ref={loadMoreRef} className="h-10 mt-8 w-full" aria-hidden="true" />
      )}

      {filteredTapes.length === 0 && (
        <div className="text-center py-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
            No mixtapes found matching &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}
    </>
  );
}
