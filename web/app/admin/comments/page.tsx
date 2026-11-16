'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatTime } from '../../../lib/time-utils';

type Kind = 'talk' | 'ids';

/** One line of a post of track IDs, as the tape page reads it: an ID, a mark with no name, or a mark taken away. */
type IdLine = { position: string | null; start: number; artist: string; title: string; gone: boolean; line?: { artist: string; title: string } };

type Comment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
  approved: boolean;
  ids?: IdLine[];
};

type CommentsData = {
  comments: Comment[];
  total: number;
  counts: Record<Kind, number>;
  kind: Kind;
  page: number;
  limit: number;
};

const named = (x: { artist: string; title: string }) => [x.artist, x.title].filter(Boolean).join(' — ') || 'Unknown track';
const many = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export default function AdminCommentsPage() {
  const [data, setData] = useState<CommentsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // What is listed: what people have said, or the posts of track IDs made on the tape pages.
  const [kind, setKind] = useState<Kind>('talk');

  const fetchComments = async (pageNum: number, which: Kind) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/comments?page=${pageNum}&kind=${which}`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const result = await response.json();
      setData(result);
      setPage(pageNum);
      setKind(which);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (commentId: number, action: 'approve' | 'delete') => {
    try {
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId, action })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} comment`);
      }

      // Refresh the list
      fetchComments(page, kind);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} comment`);
    }
  };

  useEffect(() => {
    fetchComments(1, 'talk');
  }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[var(--text)]">Moderation</h1>
          <button
            onClick={() => fetchComments(page, kind)}
            className="px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 text-[var(--text)] rounded-md transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="flex gap-2 mb-6" role="group" aria-label="What to list">
          {(['talk', 'ids'] as const).map((which) => (
            <button
              key={which}
              onClick={() => fetchComments(1, which)}
              aria-pressed={kind === which}
              className={`px-4 py-2 rounded-md transition-colors cursor-pointer ${kind === which ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 text-[var(--text)]'}`}
            >
              {which === 'talk' ? 'Comments' : 'Track IDs'}
              {data ? ` (${data.counts[which]})` : ''}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-[var(--muted)]">Loading...</div>
        ) : data && data.comments.length === 0 ? (
          <div className="text-[var(--muted)]">{kind === 'ids' ? 'No track IDs' : 'No comments'}</div>
        ) : data ? (
          <>
            <div className="mb-4 text-[var(--muted)]">
              {many(data.total, kind === 'ids' ? 'post' : 'comment')}
              {kind === 'ids' && ' of track IDs. Deleting a post puts back whatever it changed or took away.'}
            </div>

            <div className="space-y-4">
              {data.comments.map((comment) => (
                <div key={comment.id} className="p-4 bg-[var(--muted)]/5 border border-[var(--border)] rounded-md">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text)]">{comment.author_name}</div>
                      <Link
                        href={`/tapes/${comment.tape_id}${comment.ids ? '#tracklist' : ''}`}
                        className="text-sm text-[var(--accent)] hover:underline"
                      >
                        {comment.tape_id}
                      </Link>
                      <div className="text-sm text-[var(--muted)]">
                        {new Date(comment.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!comment.approved && (
                        <button
                          onClick={() => handleAction(comment.id, 'approve')}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(comment.id, 'delete')}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {comment.ids ? (
                    // The whole post, line by line: how many it names and how many it takes away, then each.
                    <div className="text-[var(--text)]">
                      <div className="text-sm text-[var(--muted)] mb-2">
                        {[
                          many(comment.ids.filter((id) => !id.gone).length, 'ID'),
                          comment.ids.some((id) => id.gone) ? many(comment.ids.filter((id) => id.gone).length, 'removal') : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <ul className="max-h-80 overflow-y-auto font-mono text-sm space-y-1">
                        {comment.ids.map((id, k) => (
                          <li key={k} className={id.gone ? 'text-red-500' : undefined}>
                            <span className="tabular-nums text-[var(--muted)]">
                              {id.position ? `${id.position} ` : ''}
                              {formatTime(id.start)}
                            </span>{' '}
                            {id.gone ? 'Removed' : named(id)}
                            {id.line && <span className="text-[var(--muted)]"> (was {named(id.line)})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[var(--text)] whitespace-pre-wrap">
                      {comment.content.length > 200
                        ? comment.content.slice(0, 200) + '...'
                        : comment.content}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => fetchComments(page - 1, kind)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)] rounded-md transition-colors"
                >
                  Previous
                </button>
                <span className="text-[var(--muted)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => fetchComments(page + 1, kind)}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)] rounded-md transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
