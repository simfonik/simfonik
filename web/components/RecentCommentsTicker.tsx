'use client';

import Link from 'next/link';
import { ArrowRightCircleIcon } from '@heroicons/react/16/solid';
import type { RecentComment } from '../lib/comments';

interface RecentCommentsTickerProps {
  comments: RecentComment[];
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentCommentsTicker({ comments }: RecentCommentsTickerProps) {
  if (comments.length === 0) {
    return null;
  }

  // Duplicate comments for seamless loop
  const duplicatedComments = [...comments, ...comments];

  return (
    <div className="w-full bg-[var(--surface)] border-y border-[var(--border)] overflow-hidden py-3 hidden sm:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Desktop: Clickable label + scrolling ticker */}
        <div className="flex items-center gap-6">
          <Link
            href="/comments"
            className="group flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Recent Comments
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <div className="flex-1 overflow-hidden relative">
            <div className="flex gap-8 animate-scroll items-center">
              {duplicatedComments.map((comment, idx) => (
                <Link
                  key={`${comment.id}-${idx}`}
                  href={`/tapes/${comment.tape_id}`}
                  className="flex-shrink-0 text-sm text-[var(--text)] transition-colors whitespace-nowrap flex items-center gap-2"
                >
                  <span>
                    {comment.dj_names} - {comment.tape_title}{' '}
                    <span className="text-[var(--muted)]">({formatTimeAgo(comment.created_at)})</span>
                  </span>
                  <ArrowRightCircleIcon className="w-4 h-4 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        
        .animate-scroll {
          animation: scroll 60s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .animate-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
