'use client';

import { useEffect, useState } from 'react';
import { CommentForm } from './CommentForm';

type Comment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
  parent_id: number | null;
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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // 7+ days: show short date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function formatFullDate(dateString: string): string {
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
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const fetchComments = () => {
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
  };

  useEffect(() => {
    fetchComments();
  }, [tapeId]);

  if (loading) {
    return <div className="text-[var(--muted)]">Loading comments...</div>;
  }

  if (comments.length === 0) {
    return null;
  }

  // Build a map for quick parent lookup
  const commentMap = new Map(comments.map(c => [c.id, c]));
  
  // Find root parent by walking up the chain
  const findRoot = (id: number): number => {
    const comment = commentMap.get(id);
    if (!comment?.parent_id) return id;
    return findRoot(comment.parent_id);
  };
  
  // Organize: top-level comments and their replies (all at same indent)
  const topLevelComments = comments.filter(c => c.parent_id === null);
  const repliesByRoot: Record<number, Comment[]> = {};
  
  comments.forEach(comment => {
    if (comment.parent_id !== null) {
      const rootId = findRoot(comment.id);
      if (!repliesByRoot[rootId]) repliesByRoot[rootId] = [];
      repliesByRoot[rootId].push(comment);
    }
  });

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = repliesByRoot[comment.id] || [];
    const showingReplyForm = replyingTo === comment.id;
    const replyCount = replies.length;
    
    // Get immediate parent name for "Replying to" label
    const parentAuthorName = isReply && comment.parent_id 
      ? commentMap.get(comment.parent_id)?.author_name 
      : undefined;

    return (
      <div key={comment.id} className={isReply ? 'ml-4 sm:ml-8 mt-3' : ''}>
        <div className={`
          pl-3 sm:pl-4 py-2.5 sm:py-3 rounded
          ${isReply 
            ? 'border-l-2 border-[var(--accent)]/40 bg-[var(--muted)]/3' 
            : 'border-l-2 border-[var(--border)]'
          }
        `}>
          {isReply && parentAuthorName && (
            <div className="text-xs text-[var(--muted)] mb-2.5">
              @{parentAuthorName}
            </div>
          )}
          <div className="mb-2 sm:mb-3 flex items-baseline gap-2">
            <div className="font-bold text-[var(--text)]">
              {comment.author_name}
            </div>
            <span 
              className="text-xs text-[var(--muted)]" 
              title={formatFullDate(comment.created_at)}
            >
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>
          <div
            className="text-[var(--text)] whitespace-pre-wrap leading-relaxed mb-3 sm:mb-4"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(comment.content) }}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={() => setReplyingTo(showingReplyForm ? null : comment.id)}
              className="text-sm text-[var(--text)] hover:text-[var(--accent)] active:text-[var(--accent)] transition-colors cursor-pointer font-medium opacity-70 hover:opacity-100 py-1"
            >
              {showingReplyForm ? 'Cancel' : 'Reply'}
            </button>
            {!isReply && replyCount > 0 && (
              <span className="text-xs text-[var(--muted)]">
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
        </div>

        {showingReplyForm && (
          <div className="ml-8 mt-4">
            <CommentForm
              tapeId={tapeId}
              parentId={comment.id}
              parentAuthor={comment.author_name}
              onCancel={() => {
                setReplyingTo(null);
                fetchComments();
              }}
            />
          </div>
        )}

        {replies.length > 0 && (
          <div className="space-y-3 mt-3">
            {replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {topLevelComments.map(comment => renderComment(comment))}
    </div>
  );
}
