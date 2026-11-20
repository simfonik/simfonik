import Link from 'next/link';
import { getRecentActivity, type RecentComment } from '../lib/comments';
import { getAllTapes } from '../lib/data';
import { formatTimeAgo } from '../lib/time-utils';

// Hide a list if its newest entry is older than this — keeps the homepage from advertising stale activity.
const FRESH_DAYS = 9;
const fresh = <T extends RecentComment>(rows: T[]) => (rows.length > 0 && (Date.now() - new Date(rows[0].created_at).getTime()) / 86_400_000 <= FRESH_DAYS ? rows : []);

const label = 'font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]';

/**
 * What has lately happened on the tapes: what people have said, and the track IDs they have posted, each in
 * a list of its own, side by side where there is room, so that a sitting of IDs never pushes the talk off
 * the page. A row says who and on which tape; the IDs' rows say how many.
 */
export async function RecentActivity() {
  const recent = await getRecentActivity(4);
  const comments = fresh(recent.comments);
  const ids = fresh(recent.ids);
  if (comments.length === 0 && ids.length === 0) return null;

  // Titles that more than one tape carries ("Untitled", "The California Project") don't say which tape on
  // their own, so where there is room for the title only, those rows keep the DJ names too.
  const titled = new Map<string, number>();
  for (const tape of getAllTapes()) {
    const title = tape.title.trim().toLowerCase();
    titled.set(title, (titled.get(title) ?? 0) + 1);
  }
  const shared = (title: string) => (titled.get(title.trim().toLowerCase()) ?? 0) > 1;
  // Two lists share the width from `lg` up, and each row then has about what a row has on a small tablet.
  const both = comments.length > 0 && ids.length > 0;
  const names = (title: string) => (shared(title) ? undefined : both ? 'hidden sm:inline lg:hidden xl:inline' : 'hidden sm:inline');

  const row = (entry: RecentComment, href: string, said: string) => (
    <li key={entry.id}>
      <Link href={href} className="flex items-baseline gap-3 py-3 hover:bg-[var(--bg-hover)] -mx-2 px-2 transition-colors">
        <span className="font-display text-base leading-none text-[var(--text)] truncate">{entry.author_name}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] shrink-0 tabular-nums">{said}</span>
        <span className="text-sm text-[var(--accent)] truncate flex-1">
          <span className={names(entry.tape_title)}>{entry.dj_names} — </span>
          {entry.tape_title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] shrink-0 tabular-nums">{formatTimeAgo(entry.created_at)}</span>
      </Link>
    </li>
  );

  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-2${both ? ' grid gap-x-12 gap-y-8 lg:grid-cols-2' : ''}`}>
      {comments.length > 0 && (
        <section aria-labelledby="recent-comments-heading" className="min-w-0">
          <div className="flex items-baseline justify-between mb-4">
            <h2 id="recent-comments-heading" className={label}>
              Recent Comments
            </h2>
            <Link
              href="/comments"
              className="relative font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] underline-offset-4 hover:underline before:absolute before:-inset-x-2 before:-inset-y-[15px] before:content-['']"
            >
              See all →
            </Link>
          </div>
          <ul>{comments.map((comment) => row(comment, `/tapes/${comment.tape_id}`, 'on'))}</ul>
        </section>
      )}
      {ids.length > 0 && (
        <section aria-labelledby="recent-ids-heading" className="min-w-0">
          <h2 id="recent-ids-heading" className={`${label} mb-4`}>
            Recent Track IDs
          </h2>
          <ul>{ids.map((post) => row(post, `/tapes/${post.tape_id}#tracklist`, `${post.count} ${post.count === 1 ? 'ID' : 'IDs'} on`))}</ul>
        </section>
      )}
    </div>
  );
}
