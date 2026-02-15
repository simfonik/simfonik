import { sql } from '@vercel/postgres';
import { getTapeById } from './data';

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

export async function getRecentComments(limit = 10): Promise<RecentComment[]> {
  try {
    const { rows } = await sql`
      SELECT id, tape_id, author_name, created_at
      FROM comments
      WHERE approved = true
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

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
    const offset = (page - 1) * perPage;
    
    // Get total count
    const { rows: countRows } = await sql`
      SELECT COUNT(*) as count
      FROM comments
      WHERE approved = true
    `;
    const total = parseInt(countRows[0].count);
    const totalPages = Math.ceil(total / perPage);

    // Get paginated comments
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = true
      ORDER BY created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

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
