import { unstable_cache } from 'next/cache';
import { sql } from './db';
import { getTapeById } from './data';
import { ID_POST, readComposed } from './track-ids/compose';

export const COMMENTS_CACHE_TAG = 'comments';

// Comments are rare, so cached reads only refresh when a comment is written
// (the submit and admin routes call revalidateTag) or once a day. Keeping the
// database idle between writes is what lets Neon scale to zero.
const cacheOptions = { tags: [COMMENTS_CACHE_TAG], revalidate: 60 * 60 * 24 };

export type TapeComment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

export type RecentComment = {
  id: number;
  tape_id: string;
  author_name: string;
  created_at: string;
  tape_title: string;
  dj_names: string;
};

/** A post of track IDs made on a tape's page (lib/track-ids/compose.ts), for the home page: who, on which tape, and how many. */
export type RecentIds = RecentComment & { count: number };

export type PaginatedComment = {
  id: number;
  tape_id: string;
  author_name: string;
  content: string;
  created_at: string;
  tape_title: string;
  dj_names: string;
  tape_year: string;
};

export const getTapeComments = unstable_cache(
  async (tapeId: string): Promise<TapeComment[]> => {
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE tape_id = ${tapeId} AND approved = true
      ORDER BY created_at ASC
    `;
    return rows as TapeComment[];
  },
  ['comments-by-tape'],
  cacheOptions
);

// The comments page lists what people have said. Posts of track IDs are on each tape's page, in its tracklist
// and that tracklist's history, and are left out of it: exactly those the reader takes for IDs. The database
// finds the comments that may be (`ID_POST`), and each is then put to the reader's own test on its own tape,
// so that a comment which only looks like one (a time and a name on a tape with sides, and no side said) is
// never left out of the talk.
/** The ids of the comments that are posts of track IDs: the approved ones, or with `all` every one (for the admin). */
export async function findIdPostIds(all = false): Promise<number[]> {
  const { rows } = all
    ? await sql`SELECT id, tape_id, content FROM comments WHERE content ~* ${ID_POST}`
    : await sql`SELECT id, tape_id, content FROM comments WHERE approved = true AND content ~* ${ID_POST}`;
  return (rows as Pick<TapeComment, 'id' | 'tape_id' | 'content'>[])
    .filter((comment) => {
      const tape = getTapeById(comment.tape_id);
      return tape && readComposed(comment.content, tape.sides.map((side) => side.position)) !== null;
    })
    .map((comment) => comment.id);
}

const fetchIdPostIds = unstable_cache(() => findIdPostIds(), ['id-post-ids'], cacheOptions);

// The newest of each kind, talk and posts of track IDs, so that a run of one never crowds out the other.
const fetchRecentTalk = unstable_cache(
  async (limit: number, idPosts: number[]) => {
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = true AND NOT (id = ANY(${idPosts}::int[]))
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as TapeComment[];
  },
  ['recent-talk'],
  cacheOptions
);

const fetchRecentIdPosts = unstable_cache(
  async (limit: number, idPosts: number[]) => {
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = true AND id = ANY(${idPosts}::int[])
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as TapeComment[];
  },
  ['recent-id-posts'],
  cacheOptions
);

const fetchApprovedCount = unstable_cache(
  async (idPosts: number[]) => {
    const { rows } = await sql`
      SELECT COUNT(*) as count
      FROM comments
      WHERE approved = true AND NOT (id = ANY(${idPosts}::int[]))
    `;
    return parseInt(rows[0].count);
  },
  ['approved-comment-count'],
  cacheOptions
);

const fetchPaginatedRows = unstable_cache(
  async (page: number, perPage: number, idPosts: number[]) => {
    const offset = (page - 1) * perPage;
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = true AND NOT (id = ANY(${idPosts}::int[]))
      ORDER BY created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;
    return rows as TapeComment[];
  },
  ['paginated-comments'],
  cacheOptions
);

// How many posts of IDs are looked at for the home page: one sitting at one tape is often dozens of posts.
const ID_POSTS_READ = 100;
// Posts by one person on one tape are one sitting while no more than this lies between one and the next.
const SITTING_GAP = 12 * 60 * 60 * 1000;

/**
 * The newest of what has been said and the newest track IDs, `each` rows of each at the most, for the home
 * page. One person's posts of IDs on one tape, made within hours of each other, are one row, at the time of
 * the newest, with the IDs of all of them counted: a sitting is told once. A post that only takes marks away is no news and is left out.
 */
export async function getRecentActivity(each = 4): Promise<{ comments: RecentComment[]; ids: RecentIds[] }> {
  try {
    const idPosts = await fetchIdPostIds();
    const [talk, posts] = await Promise.all([fetchRecentTalk(each, idPosts), fetchRecentIdPosts(ID_POSTS_READ, idPosts)]);
    const comments: RecentComment[] = [];
    const ids: RecentIds[] = [];
    const sittings = new Map<string, { row: RecentIds; earliest: number }>();
    for (const comment of [...talk, ...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
      const tape = getTapeById(comment.tape_id);
      if (!tape) continue;
      // Truncate DJ names for display: show first 2 DJs + "..." if more
      const djNames = tape.djs.length > 2 ? `${tape.djs[0].name}, ${tape.djs[1].name}, ...` : tape.djs.map((dj) => dj.name).join(', ');
      const row = { id: comment.id, tape_id: comment.tape_id, author_name: comment.author_name, created_at: comment.created_at, tape_title: tape.title, dj_names: djNames };
      const post = readComposed(comment.content, tape.sides.map((side) => side.position));
      const count = post?.filter((id) => !id.gone).length;
      if (!post) comments.push(row);
      else if (count) {
        const key = `${comment.author_name}\n${comment.tape_id}`;
        const at = new Date(comment.created_at).getTime();
        const sitting = sittings.get(key);
        if (sitting && sitting.earliest - at <= SITTING_GAP) {
          sitting.row.count += count;
          sitting.earliest = at;
        } else {
          const first = { ...row, count };
          sittings.set(key, { row: first, earliest: at });
          ids.push(first);
        }
      }
    }
    return { comments: comments.slice(0, each), ids: ids.slice(0, each) };
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return { comments: [], ids: [] };
  }
}

export async function getPaginatedComments(page = 1, perPage = 30) {
  try {
    const idPosts = await fetchIdPostIds();
    const total = await fetchApprovedCount(idPosts);
    const totalPages = Math.ceil(total / perPage);

    // Pages past the end are a cache key per request; answer them from the
    // (single, cached) count instead of running a query for each.
    const rows = page > totalPages ? [] : await fetchPaginatedRows(page, perPage, idPosts);

    // Enrich with tape data
    const enrichedComments = rows.map((comment) => {
      const tape = getTapeById(comment.tape_id);
      
      if (!tape) {
        return null;
      }

      const djNames = tape.djs.map(dj => dj.name).join(', ');

      return {
        id: comment.id,
        tape_id: comment.tape_id,
        author_name: comment.author_name,
        content: comment.content,
        created_at: comment.created_at,
        tape_title: tape.title,
        dj_names: djNames,
        tape_year: tape.released,
      };
    }).filter((comment): comment is PaginatedComment => comment !== null);

    return {
      comments: enrichedComments,
      total,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error('Error fetching paginated comments:', error);
    return {
      comments: [],
      total: 0,
      totalPages: 0,
      currentPage: page,
    };
  }
}
