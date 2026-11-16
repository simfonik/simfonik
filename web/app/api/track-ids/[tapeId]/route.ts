import { getTapeById } from '@/lib/data';
import { readTrackIds } from '@/lib/track-ids/read';
import { NextRequest } from 'next/server';

/** A tape's comments and what they say is on it (lib/track-ids/read.ts): all the tape page reads after it loads. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tapeId: string }> }) {
  try {
    const { tapeId } = await params;

    // Unknown tapes never reach the database (or the cache): each distinct key
    // would otherwise cost a query, so made-up IDs could keep Neon awake.
    const tape = getTapeById(tapeId);
    if (!tape) {
      return Response.json({ error: 'Unknown tape' }, { status: 404 });
    }

    return Response.json(await readTrackIds(tape));
  } catch (error) {
    console.error('Error reading track IDs:', error);
    return Response.json({ error: 'Failed to read track IDs' }, { status: 500 });
  }
}
