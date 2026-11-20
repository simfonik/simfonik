'use client';

import { postedTarget } from '../lib/heart-targets';
import { readComposed } from '../lib/track-ids/compose';
import { Comment } from './Comment';
import { useTapeTrackIds } from './TapeTrackIds';

/**
 * What people have said about the tape through the site. A comment that is nothing but track IDs in the
 * site's own form (`[B 12:34] Moby - Go`), for sides the tape has, is not here: a run of those would bury the
 * talk, and they are kept as the tracklist's history (Tracklist). The comments come from the page's shared
 * read of them, which is made again whenever one is posted, so a new one shows without a reload.
 */
export function LiveComments() {
  const { comments, tape } = useTapeTrackIds();

  if (comments === null) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
        Loading comments…
      </div>
    );
  }

  // The reader's own test, so a comment is left out here only if the reader takes it for IDs.
  const positions = tape.map((side) => side.position);
  const talk = comments.filter((comment) => !readComposed(comment.content, positions));
  if (talk.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {talk.map((comment) => (
        <Comment key={comment.id} author={comment.author_name} date={comment.created_at} content={comment.content} heart={postedTarget(comment.id)} />
      ))}
    </div>
  );
}
