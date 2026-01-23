'use client';

import { useState, useEffect } from 'react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (comments.length === 0) return;
    
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % comments.length);
        setIsVisible(true);
      }, 200);
    }, 4000);

    return () => clearInterval(interval);
  }, [comments.length]);

  if (comments.length === 0) {
    return null;
  }

  // Duplicate comments for seamless loop (desktop)
  const duplicatedComments = [...comments, ...comments];
  const currentComment = comments[currentIndex];

  return (
    <div className="w-full bg-[var(--surface)] border-y border-[var(--border)] overflow-hidden py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4 sm:gap-6">
        <span className="flex-shrink-0 text-sm font-semibold text-[var(--text)]">
          Comments:
        </span>
        <div className="flex-1 overflow-hidden relative">
          {/* Desktop: horizontal scroll */}
          <div className="hidden sm:flex gap-8 animate-scroll items-center">
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
          
          {/* Mobile: cycling comments */}
          <div className="sm:hidden flex-1 min-w-0">
            <Link
              href={`/tapes/${currentComment.tape_id}`}
              className="flex items-center gap-2 text-sm text-[var(--text)] transition-all duration-200"
              style={{ opacity: isVisible ? 1 : 0 }}
            >
              <span className="truncate min-w-0">
                {currentComment.dj_names} - {currentComment.tape_title}
              </span>
              <span className="text-[var(--muted)] whitespace-nowrap flex-shrink-0">
                ({formatTimeAgo(currentComment.created_at)})
              </span>
              <ArrowRightCircleIcon className="w-4 h-4 flex-shrink-0" />
            </Link>
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
