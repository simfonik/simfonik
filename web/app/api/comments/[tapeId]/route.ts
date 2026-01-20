import { sql } from '@vercel/postgres';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tapeId: string }> }
) {
  try {
    const { tapeId } = await params;

    const { rows } = await sql`
      SELECT id, tape_id, author_name, content, created_at
      FROM comments
      WHERE tape_id = ${tapeId} AND approved = true
      ORDER BY created_at ASC
    `;

    return Response.json(rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return Response.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}
