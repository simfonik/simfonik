import { getTapeById } from '@/lib/data';
import { readTrackIds } from '@/lib/track-ids/read';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ tapeId: string }> }) {
  const { tapeId } = await params;

  // Unknown tapes never reach the database (or the cache), as in /api/comments/[tapeId].
  const tape = getTapeById(tapeId);
  if (!tape) {
    return Response.json({ error: 'Unknown tape' }, { status: 404 });
  }

  return Response.json(await readTrackIds(tape));
}
