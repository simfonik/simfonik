'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Comment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type CommentsData = {
  comments: Comment[];
  total: number;
  page: number;
  limit: number;
};

export default function AdminCommentsPage() {
  const [data, setData] = useState<CommentsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchComments = async (pageNum: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/comments?page=${pageNum}`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const result = await response.json();
      setData(result);
      setPage(pageNum);
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
      fetchComments(page);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} comment`);
    }
  };

  useEffect(() => {
    fetchComments(1);
  }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[var(--text)]">Pending Comments</h1>
          <button
            onClick={() => fetchComments(page)}
            className="px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 text-[var(--text)] rounded-md transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-[var(--muted)]">Loading...</div>
        ) : data && data.comments.length === 0 ? (
          <div className="text-[var(--muted)]">No pending comments</div>
        ) : data ? (
          <>
            <div className="mb-4 text-[var(--muted)]">
              {data.total} pending comment{data.total !== 1 ? 's' : ''}
            </div>

            <div className="space-y-4">
              {data.comments.map((comment) => (
                <div key={comment.id} className="p-4 bg-[var(--muted)]/5 border border-[var(--border)] rounded-md">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text)]">{comment.author_name}</div>
                      <Link
                        href={`/tapes/${comment.tape_id}`}
                        className="text-sm text-[var(--accent)] hover:underline"
                      >
                        {comment.tape_id}
                      </Link>
                      <div className="text-sm text-[var(--muted)]">
                        {new Date(comment.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(comment.id, 'approve')}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(comment.id, 'delete')}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[var(--text)] whitespace-pre-wrap">
                    {comment.content.length > 200
                      ? comment.content.slice(0, 200) + '...'
                      : comment.content}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => fetchComments(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)] rounded-md transition-colors"
                >
                  Previous
                </button>
                <span className="text-[var(--muted)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => fetchComments(page + 1)}
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
