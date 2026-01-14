'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Tape } from '../types/tape';

type TapeWithCover = Tape & { coverImage: string };

interface TapeGalleryWithSearchProps {
  tapes: TapeWithCover[];
}

export function TapeGalleryWithSearch({ tapes }: TapeGalleryWithSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tapes based on search query
  const filteredTapes = tapes.filter((tape) => {
    if (!searchQuery.trim()) return true;
    
    // Normalize: lowercase and remove common punctuation (periods, dashes, spaces)
    const normalize = (str: string) => 
      str.toLowerCase().replace(/[.\-\s]/g, '');
    
    const normalizedQuery = normalize(searchQuery);
    const titleMatch = normalize(tape.title).includes(normalizedQuery);
    const djMatch = tape.djs.some((dj) => 
      normalize(dj.name).includes(normalizedQuery)
    );
    
    return titleMatch || djMatch;
  });

  return (
    <>
      {/* Header with search */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-[var(--text)]">
          Mixtapes
        </h1>
        
        <div className="w-full sm:w-auto lg:w-[calc(33.333%-1rem)] relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by DJ or Mix Title"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
          />
        </div>
      </div>

      {/* Tape grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTapes.map((tape) => (
          <article
            key={tape.id}
            className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-[border-color,box-shadow] duration-500 hover:border-[var(--accent)]/40 hover:shadow-[0_0_20px_rgba(94,106,210,0.15)] dark:hover:shadow-[0_0_20px_rgba(168,174,245,0.1)] focus-within:ring-2 focus-within:ring-[var(--accent)] flex flex-col"
          >
            <Link
              href={`/tapes/${tape.id}`}
              className="absolute inset-0 rounded-lg"
              aria-label={`View ${tape.title}`}
            />
            
            {/* Cover Image */}
            <div className="relative w-full aspect-[3/2] bg-[var(--muted)]/10 pointer-events-none">
              <Image
                src={tape.coverImage}
                alt={`${tape.title} cover`}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>
            
            <div className="relative pointer-events-none p-6 flex flex-col flex-grow">
              <div className="flex-grow">
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  {tape.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)] min-h-[1.25rem]">
                  {tape.released}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tape.djs.map((dj) => {
                  const shouldLink = dj.link !== false && dj.slug !== "unknown";
                  
                  if (shouldLink) {
                    return (
                      <Link
                        key={dj.slug}
                        href={`/djs/${dj.slug}`}
                        className="relative pointer-events-auto rounded-md bg-[#5e6ad2]/10 px-2.5 py-1 text-sm font-medium text-[#5e6ad2] hover:bg-[#5e6ad2]/20 dark:bg-[#5e6ad2]/25 dark:text-[#a8aef5] dark:hover:bg-[#5e6ad2]/40 transition-colors"
                      >
                        {dj.name}
                      </Link>
                    );
                  }
                  
                  return (
                    <span
                      key={dj.slug}
                      className="relative pointer-events-auto rounded-md bg-[var(--muted)]/20 border border-[var(--border)] px-2.5 py-1 text-sm font-medium text-[var(--muted)] cursor-default"
                    >
                      {dj.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* No results message */}
      {filteredTapes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg text-[var(--muted)]">
            No mixtapes found matching &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}
    </>
  );
}
