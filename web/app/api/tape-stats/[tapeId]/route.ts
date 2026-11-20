import { getTapeById } from '@/lib/data';
import { heartCounts } from '@/lib/hearts';
import { playsShown } from '@/lib/plays';
import { PLAYS_SHOWN } from '@/lib/plays-shown';
import { NextRequest } from 'next/server';

/** How a tape has gone down, for its page: the plays to show (lib/plays.ts) and the hearts on its comments (lib/hearts.ts). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ tapeId: string }> }) {
  const { tapeId } = await params;

  // Unknown tapes never reach the database (or the cache), as in /api/track-ids.
  if (!getTapeById(tapeId)) {
    return Response.json({ error: 'Unknown tape' }, { status: 404 });
  }

  // Each is given where it could be read: one failing does not take the other with it.
  const [plays, hearts] = await Promise.all([
    // Not counted while they are not shown (lib/plays-shown.ts).
    PLAYS_SHOWN
      ? playsShown(tapeId).catch((error) => {
          console.error('Tape stats: the plays could not be read:', error);
          return null;
        })
      : null,
    heartCounts(tapeId).catch((error) => {
      console.error('Tape stats: the hearts could not be read:', error);
      return {};
    }),
  ]);
  return Response.json({ plays, hearts });
}
