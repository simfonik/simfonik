'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { idLabel, idPlace, splitComposed } from '../lib/track-ids/compose';
import { useTapeTrackIds } from './TapeTrackIds';

/** How many of the latest ID posts show before the rest are asked for. */
const LATEST = 5;

const day = (posted: string) => new Date(posted).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * The log of a tape's ID posts: every comment that is a track ID in the site's own form (`[B 12:34] Moby -
 * Go`), newest first, one line each. They are kept out of the comment list, where a run of them would bury
 * the talk, and set down here as what they are: where on the tape, which can be pressed to hear that moment,
 * the track, and who said so and when. A tape nobody has ID'd through the site has no log, and no heading
 * for one.
 *
 * A long log shows its latest few and a way to the rest, as the tape's tracklist does (Tracklist.tsx).
 */
export function TrackIdLog() {
  const { comments, goTo } = useTapeTrackIds();
  const [all, setAll] = useState(false);
  const firstRevealed = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // The control goes when the rest are shown; the keyboard goes on to the first of them, not back to the
  // top of the page.
  useEffect(() => {
    if (all) firstRevealed.current?.focus();
  }, [all]);

  const posts = (comments ?? [])
    .flatMap((comment) => {
      const id = splitComposed(comment.content);
      return id ? [{ ...comment, where: id }] : [];
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (posts.length === 0) return null;

  return (
    <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16" aria-labelledby={`${listId}-heading`}>
      <div className="max-w-3xl">
        <h2 id={`${listId}-heading`} className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-5">
          Track IDs
        </h2>
        <ul id={listId}>
          {posts.map((post, i) => {
            const place = idPlace(post.where.position, post.where.time);
            return (
              <li key={post.id} className="id-log-entry" hidden={!all && i >= LATEST}>
                <p className="comment-id">
                  <button
                    ref={i === LATEST ? firstRevealed : undefined}
                    type="button"
                    onClick={() => goTo(post.where.position, post.where.time)}
                    className="comment-time"
                    aria-label={`Play from ${place}`}
                  >
                    {place}
                  </button>{' '}
                  {idLabel({ ...post.where, known: Boolean(post.where.artist || post.where.title) })}
                </p>
                <p className="id-log-by">
                  {post.author_name} · <time dateTime={post.created_at}>{day(post.created_at)}</time>
                </p>
              </li>
            );
          })}
        </ul>
        {!all && posts.length > LATEST && (
          <button
            type="button"
            onClick={() => setAll(true)}
            aria-expanded={false}
            aria-controls={listId}
            className="cursor-pointer flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            Show all {posts.length} IDs
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
