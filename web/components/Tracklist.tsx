"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Track } from "../types/tape";

const COLLAPSED_COUNT = 20;

function TrackLabel({ track }: { track: Track }) {
  return (
    <span className="flex-1">
      <span className="font-medium">{track.artist}</span>
      <span className="text-[var(--muted)]"> — </span>
      <span>{track.title}</span>
      {track.duration && (
        <span className="ml-2 font-mono text-[var(--muted)] text-xs">
          ({track.duration})
        </span>
      )}
    </span>
  );
}

export function Tracklist({ tracks }: { tracks: Track[] }) {
  const collapsible = tracks.length > COLLAPSED_COUNT;
  const [expanded, setExpanded] = useState(!collapsible);
  const firstRevealedRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // The control unmounts on expand; move focus to the first revealed row so
  // keyboard users continue from where they were instead of the top of the page.
  useEffect(() => {
    if (expanded && collapsible) firstRevealedRef.current?.focus();
  }, [expanded, collapsible]);

  return (
    <div>
      <div id={listId} className={`space-y-0 leading-snug text-sm${expanded ? "" : " tracklist-fade"}`}>
        {tracks.map((track, trackIdx) => (
          <div
            key={trackIdx}
            ref={trackIdx === COLLAPSED_COUNT ? firstRevealedRef : undefined}
            tabIndex={trackIdx === COLLAPSED_COUNT ? -1 : undefined}
            className="flex gap-3 text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors py-2 px-2 group outline-none"
            hidden={!expanded && trackIdx >= COLLAPSED_COUNT}
          >
            <span className="font-mono text-[var(--muted)] tabular-nums flex-shrink-0">
              {String(trackIdx + 1).padStart(2, "0")}
            </span>
            {track.discogs_url ? (
              <a
                href={track.discogs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer flex-1 flex items-center gap-2 group-hover:text-[var(--accent-text)] transition-colors"
              >
                <TrackLabel track={track} />
                <svg
                  className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <TrackLabel track={track} />
            )}
          </div>
        ))}
      </div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={listId}
          className="cursor-pointer -mt-2 flex min-h-11 items-center gap-2 px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          Show all {tracks.length} tracks
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
