import Link from 'next/link';
import { getRecentComments } from '../lib/comments';
import { formatTimeAgo } from '../lib/time-utils';

// Hide the section if the newest comment is older than this — keeps the
// homepage from advertising stale activity.
const FRESH_DAYS = 9;

export async function RecentActivity() {
  const comments = await getRecentComments(4);

  if (comments.length === 0) {
    return null;
  }

  const newestAgeDays =
    (Date.now() - new Date(comments[0].created_at).getTime()) / 86_400_000;
  if (newestAgeDays > FRESH_DAYS) {
    return null;
  }

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-2"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2
          id="recent-activity-heading"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]"
        >
          Recent Comments
        </h2>
        <Link
          href="/comments"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          See all →
        </Link>
      </div>

      <ul className="">
        {comments.map((comment) => (
          <li key={comment.id}>
            <Link
              href={`/tapes/${comment.tape_id}`}
              className="group flex items-baseline gap-3 py-2.5 hover:bg-[var(--surface)] -mx-2 px-2 transition-colors"
            >
              <span className="font-display text-base sm:text-lg leading-none text-[var(--text)] truncate">
                {comment.author_name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] shrink-0">
                on
              </span>
              <span className="text-sm text-[var(--accent)] group-hover:text-[var(--accent-hover)] truncate flex-1">
                <span className="hidden sm:inline">{comment.dj_names} — </span>
                {comment.tape_title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] shrink-0 tabular-nums">
                {formatTimeAgo(comment.created_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
