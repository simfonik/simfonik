import { unstable_cache } from 'next/cache';
import { sql } from './db';
import { getTapeById } from './data';

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

const fetchRecentRows = unstable_cache(
  async (limit: number) => {
    const { rows } = await sql`
      SELECT id, tape_id, author_name, created_at
      FROM comments
      WHERE approved = true
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as Omit<TapeComment, 'content'>[];
  },
  ['recent-comments'],
  cacheOptions
);

const fetchApprovedCount = unstable_cache(
  async () => {
    const { rows } = await sql`
      SELECT COUNT(*) as count
      FROM comments
      WHERE approved = true
    `;
    return parseInt(rows[0].count);
  },
  ['approved-comment-count'],
  cacheOptions
);

const fetchPaginatedRows = unstable_cache(
  async (page: number, perPage: number) => {
    const offset = (page - 1) * perPage;
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = true
      ORDER BY created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;
    return rows as TapeComment[];
  },
  ['paginated-comments'],
  cacheOptions
);

export async function getRecentComments(limit = 10): Promise<RecentComment[]> {
  try {
    const rows = await fetchRecentRows(limit);

    // Enrich with tape data
    const enrichedComments = rows.map((comment) => {
      const tape = getTapeById(comment.tape_id);
      
      if (!tape) {
        return null;
      }

      // Truncate DJ names for ticker display: show first 2 DJs + "..." if more
      const djNames = tape.djs.length > 2
        ? `${tape.djs[0].name}, ${tape.djs[1].name}, ...`
        : tape.djs.map(dj => dj.name).join(', ');

      return {
        id: comment.id,
        tape_id: comment.tape_id,
        author_name: comment.author_name,
        created_at: comment.created_at,
        tape_title: tape.title,
        dj_names: djNames,
      };
    }).filter((comment): comment is RecentComment => comment !== null);

    return enrichedComments;
  } catch (error) {
    console.error('Error fetching recent comments:', error);
    return [];
  }
}

export async function getPaginatedComments(page = 1, perPage = 30) {
  try {
    const total = await fetchApprovedCount();
    const totalPages = Math.ceil(total / perPage);

    // Pages past the end are a cache key per request; answer them from the
    // (single, cached) count instead of running a query for each.
    const rows = page > totalPages ? [] : await fetchPaginatedRows(page, perPage);

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
