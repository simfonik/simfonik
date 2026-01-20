'use client';

import { useEffect, useState } from 'react';

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

function sanitizeContent(text: string): string {
  // 1. Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Linkify Discogs URLs only
  return escaped.replace(
    /(https?:\/\/(?:www\.)?discogs\.com\/[^\s]+)/gi,
    '<a href="$1" target="_blank" rel="nofollow noopener noreferrer" class="text-[var(--accent)] hover:underline break-all">$1</a>'
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function LiveComments({ tapeId }: LiveCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/comments/${tapeId}`)
      .then(r => r.json())
      .then(setComments)
      .catch(err => console.error('Failed to load comments:', err))
      .finally(() => setLoading(false));
  }, [tapeId]);

  if (loading) {
    return <div className="text-[var(--muted)]">Loading comments...</div>;
  }

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <div key={comment.id} className="border-l-2 border-[var(--border)] pl-4 py-1">
          <div className="mb-2">
            <div className="font-medium text-[var(--text)]">
              {comment.author_name}
            </div>
            <div className="text-sm text-[var(--muted)]">
              {formatDate(comment.created_at)}
            </div>
          </div>
          <div
            className="text-[var(--text)] whitespace-pre-wrap leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(comment.content) }}
          />
        </div>
      ))}
    </div>
  );
}
