import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tapeId, sidePosition } = body;

    if (!tapeId || !sidePosition) {
      return Response.json({ error: 'Missing tapeId or sidePosition' }, { status: 400 });
    }

    await sql`
      INSERT INTO plays (tape_id, side_position)
      VALUES (${tapeId}, ${sidePosition})
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error tracking play:', error);
    return Response.json({ error: 'Failed to track play' }, { status: 500 });
  }
}
