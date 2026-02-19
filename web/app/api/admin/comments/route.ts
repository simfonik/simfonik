import { sql } from '@vercel/postgres';
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

    // Get pending comments
    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE approved = false
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const { rows: [{ count }] } = await sql`
      SELECT COUNT(*) as count FROM comments WHERE approved = false
    `;

    return Response.json({
      comments: rows,
      total: parseInt(count),
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

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error processing admin action:', error);
    return Response.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
