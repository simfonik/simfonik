'use client';

import { useEffect, useState } from 'react';
import { idLabel, idPlace, splitComposed } from '../lib/track-ids/compose';
import { CommentBody } from './CommentBody';
import { useTapeTrackIds } from './TapeTrackIds';

type Comment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type LiveCommentsProps = {
  tapeId: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * A comment's text. One that is a track ID in the site's own form (`[B 12:34] Moby - Go`) is shown as an ID
 * is shown everywhere on the page, in one line of one type: where it is, which can be pressed to hear that
 * moment, and the track.
 */
function CommentText({ content, goTo }: { content: string; goTo: (position: string | null, time: number) => void }) {
  const id = splitComposed(content);
  if (!id) return <CommentBody content={content} />;
  const where = idPlace(id.position, id.time);
  return (
    <p className="comment-id">
      <button type="button" onClick={() => goTo(id.position, id.time)} className="comment-time" aria-label={`Play from ${where}`}>
        {where}
      </button>{' '}
      {idLabel({ ...id, known: Boolean(id.artist || id.title) })}
    </p>
  );
}

export function LiveComments({ tapeId }: LiveCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  // Read again whenever a comment is posted from this page, so it shows without a reload.
  const { changed, goTo } = useTapeTrackIds();

  useEffect(() => {
    fetch(`/api/comments/${tapeId}`)
      .then(r => r.json())
      .then(data => {
        // Ensure we got an array
        if (Array.isArray(data)) {
          setComments(data);
        } else {
          console.error('API returned non-array:', data);
          setComments([]);
        }
      })
      .catch(err => {
        console.error('Failed to load comments:', err);
        setComments([]);
      })
      .finally(() => setLoading(false));
  }, [tapeId, changed]);

  if (loading) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
        Loading comments…
      </div>
    );
  }

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <div key={comment.id} className="border-l-4 border-[var(--accent)] pl-4 py-1">
          <div className="mb-2">
            <div className="font-display text-xl leading-tight text-[var(--text)]">
              {comment.author_name}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
              {formatDate(comment.created_at)}
            </div>
          </div>
          <CommentText content={comment.content} goTo={goTo} />
        </div>
      ))}
    </div>
  );
}
