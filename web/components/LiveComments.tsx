'use client';

import { splitPost } from '../lib/track-ids/compose';
import { CommentBody } from './CommentBody';
import { useTapeTrackIds } from './TapeTrackIds';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * What people have said about the tape through the site. A comment that is nothing but track IDs in the
 * site's own form (`[B 12:34] Moby - Go`) is not here: a run of those would bury the talk, and they are kept
 * as the tracklist's history (Tracklist). The comments come from the page's shared read of them, which is
 * made again whenever one is posted, so a new one shows without a reload.
 */
export function LiveComments() {
  const { comments } = useTapeTrackIds();

  if (comments === null) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
        Loading comments…
      </div>
    );
  }

  const talk = comments.filter((comment) => !splitPost(comment.content));
  if (talk.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {talk.map((comment) => (
        <div key={comment.id} className="border-l-4 border-[var(--accent)] pl-4 py-1">
          <div className="mb-2">
            <div className="font-display text-xl leading-tight text-[var(--text)]">
              {comment.author_name}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
              {formatDate(comment.created_at)}
            </div>
          </div>
          <CommentBody content={comment.content} />
        </div>
      ))}
    </div>
  );
}
