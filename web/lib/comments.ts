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
