import { sql } from '@/lib/db';
import { COMMENTS_CACHE_TAG, findIdPostIds } from '@/lib/comments';
import { getTapeById } from '@/lib/data';
import { readComposed } from '@/lib/track-ids/compose';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'crypto';

function checkAuth(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Basic ')) return false;

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [, password] = credentials.split(':');

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || !password) return false;

    // Timing-safe comparison
    return password.length === expected.length &&
           timingSafeEqual(
             Buffer.from(password),
             Buffer.from(expected)
           );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // Check authentication
  const authHeader = request.headers.get('authorization');
  if (!checkAuth(authHeader)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
    });
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;
    // Two lists: what people have said, and the posts of track IDs made on the tape pages (which are
    // comments too, approved as they come and sent with no notification, so this is where they are seen).
    const kind = url.searchParams.get('kind') === 'ids' ? 'ids' : 'talk';
    const idPosts = await findIdPostIds(true);

    // Comments are auto-approved on submit, so the moderation list has to show
    // everything, newest first, for the admin to be able to delete bad ones.
    const { rows } =
      kind === 'ids'
        ? await sql`
            SELECT id, tape_id, author_name, content, created_at, approved
            FROM comments
            WHERE id = ANY(${idPosts}::int[])
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT id, tape_id, author_name, content, created_at, approved
            FROM comments
            WHERE NOT (id = ANY(${idPosts}::int[]))
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

    const { rows: [{ count }] } = await sql`
      SELECT COUNT(*) as count FROM comments
    `;
    const counts = { talk: parseInt(count) - idPosts.length, ids: idPosts.length };

    return Response.json({
      // A post of IDs comes with what it says, line by line, as the tape page reads it.
      comments:
        kind === 'ids'
          ? rows.map((row) => {
              const positions = getTapeById(row.tape_id)?.sides.map((side) => side.position) ?? [];
              const ids = readComposed(row.content, positions) ?? [];
              return { ...row, ids: ids.map((id) => ({ ...id, position: positions.length > 1 ? positions[id.side] : null })) };
            })
          : rows,
      total: counts[kind],
      counts,
      kind,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching pending comments:', error);
    return Response.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Check authentication
  const authHeader = request.headers.get('authorization');
  if (!checkAuth(authHeader)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
    });
  }

  try {
    const { action, commentId } = await request.json();

    if (!commentId || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'approve') {
      await sql`UPDATE comments SET approved = true WHERE id = ${commentId}`;
    } else if (action === 'delete') {
      await sql`DELETE FROM comments WHERE id = ${commentId}`;
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    revalidateTag(COMMENTS_CACHE_TAG);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error processing admin action:', error);
    return Response.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
