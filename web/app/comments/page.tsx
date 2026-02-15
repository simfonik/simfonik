import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPaginatedComments } from "../../lib/comments";
import { formatTimeAgo } from "../../lib/time-utils";
import { getCoverImageWithFallback, getTapeById } from "../../lib/data";

export const metadata: Metadata = {
  title: "Recent Comments - Simfonik",
  description: "Recent comments from the Simfonik mixtape archive community",
};

// ISR: Revalidate every 60 seconds (same as homepage)
export const revalidate = 60;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

function truncateComment(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trim() + '...';
}

export default async function CommentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  
  // Validate page number
  const validPage = isNaN(page) || page < 1 ? 1 : page;
  
  const { comments, totalPages, currentPage } = await getPaginatedComments(validPage, 30);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text)]">
            Recent Comments
          </h1>
        </div>

        {/* Empty state */}
        {comments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] text-lg">
              No comments yet. Be the first to share your thoughts!
            </p>
          </div>
        )}

        {/* Comments list */}
        {comments.length > 0 && (
          <div className="space-y-4">
            {comments.map((comment) => {
              const tape = getTapeById(comment.tape_id);
              const coverImage = tape ? getCoverImageWithFallback(tape) : null;
              
              return (
                <Link
                  key={comment.id}
                  href={`/tapes/${comment.tape_id}`}
                  className="group block border-l-4 border-[var(--accent)] bg-[var(--muted)]/5 hover:bg-[var(--muted)]/10 hover:border-[var(--accent)]/80 transition-all duration-200 hover:translate-x-1 rounded-r-lg overflow-hidden"
                >
                  <div className="flex gap-4 p-4 sm:p-5">
                    {/* Tape cover thumbnail */}
                    {coverImage && (
                      <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 relative rounded overflow-hidden bg-[var(--muted)]/10">
                        <Image
                          src={coverImage}
                          alt={`${comment.tape_title} cover`}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Tape title */}
                      <div className="font-bold text-lg text-[var(--text)] group-hover:text-[var(--accent)] transition-colors mb-1 leading-tight">
                        {comment.dj_names} - {comment.tape_title}
                        <span className="text-[var(--muted)] font-normal text-base"> ({comment.tape_year})</span>
                      </div>

                      {/* Author & time */}
                      <div className="text-sm text-[var(--muted)] mb-2 font-mono">
                        {comment.author_name} · {formatTimeAgo(comment.created_at)}
                      </div>

                      {/* Comment preview */}
                      <div className="text-[var(--text)]/90 leading-relaxed text-[15px]">
                        {truncateComment(comment.content)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 border-t border-[var(--border)] pt-8 flex items-center justify-between">
            {currentPage > 1 ? (
              <Link
                href={`/comments?page=${currentPage - 1}`}
                className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                ← Newer
              </Link>
            ) : (
              <span />
            )}

            <span className="text-sm text-[var(--muted)]">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                href={`/comments?page=${currentPage + 1}`}
                className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
