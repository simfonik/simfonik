import { getTapeComments } from '@/lib/comments';
import { getTapeById } from '@/lib/data';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tapeId: string }> }
) {
  try {
    const { tapeId } = await params;

    // Unknown tapes never reach the database (or the cache): each distinct key
    // would otherwise cost a query, so made-up IDs could keep Neon awake.
    if (!getTapeById(tapeId)) {
      return Response.json({ error: 'Unknown tape' }, { status: 404 });
    }

    return Response.json(await getTapeComments(tapeId));
  } catch (error) {
    console.error('Error fetching comments:', error);
    return Response.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}
