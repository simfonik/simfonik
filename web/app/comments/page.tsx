import type { Metadata } from "next";
import Link from "next/link";
import { getPaginatedComments } from "../../lib/comments";
import { formatTimeAgo } from "../../lib/time-utils";
import { getCoverImageWithFallback, getTapeById } from "../../lib/data";

export const metadata: Metadata = {
  title: "Recent Comments - Simfonik",
  description: "Recent comments from the Simfonik mixtape archive community",
  robots: {
    index: false,
    follow: true,
  },
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
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-10">
          Recent Comments
        </h1>

        <div className="max-w-3xl">
          {comments.length === 0 && (
            <div className="py-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                No comments yet
              </p>
            </div>
          )}

          {comments.length > 0 && (
            <ul className="space-y-2">
              {comments.map((comment) => {
                const tape = getTapeById(comment.tape_id);
                const coverImage = tape ? getCoverImageWithFallback(tape) : null;
                const optimizedCover = (() => {
                  if (!coverImage || !tape) return coverImage;
                  if (coverImage.match(/\/media\/tapes\/[^/]+\/cover\.jpg$/))
                    return `/optimized/${tape.id}/400.avif`;
                  const sideMatch = coverImage.match(/\/media\/tapes\/[^/]+\/sides\/(a|b)\.jpg$/);
                  if (sideMatch) return `/optimized/${tape.id}/sides/${sideMatch[1]}/400.avif`;
                  return coverImage;
                })();

                return (
                  <li key={comment.id}>
                    <Link
                      href={`/tapes/${comment.tape_id}`}
                      className="group block py-4 -mx-2 px-2 hover:bg-[var(--surface)] transition-colors"
                    >
                      <div className="flex gap-4">
                        {optimizedCover && (
                          <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={optimizedCover}
                              alt={`${comment.tape_title} cover`}
                              className="absolute inset-0 w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="font-display text-xl leading-tight text-[var(--text)] group-hover:text-[var(--accent-text)] transition-colors mb-1">
                            {comment.dj_names} — {comment.tape_title}
                            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] ml-2">
                              {comment.tape_year}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2">
                            {comment.author_name} · {formatTimeAgo(comment.created_at)}
                          </div>
                          <div className="text-[var(--text)] leading-relaxed text-[15px]">
                            {truncateComment(comment.content)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="mt-16 border-t-[1.5px] border-[var(--border)] pt-8 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em]">
              {currentPage > 1 ? (
                <Link
                  href={`/comments?page=${currentPage - 1}`}
                  className="text-[var(--text)] hover:text-[var(--accent-text)] transition-colors"
                >
                  ← Newer
                </Link>
              ) : (
                <span />
              )}

              <span className="text-[var(--muted)]">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={`/comments?page=${currentPage + 1}`}
                  className="text-[var(--text)] hover:text-[var(--accent-text)] transition-colors"
                >
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
