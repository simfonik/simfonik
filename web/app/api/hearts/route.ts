import { getTapeById } from '@/lib/data';
import { heartsTag, isComment, setHeart } from '@/lib/hearts';
import { addressOf, overLimit } from '@/lib/rate-limit';
import { revalidateTag } from 'next/cache';

// How many hearts one address may give or take back in an hour. Someone reading a long page of comments
// gives a good many; nobody gives this many.
const HOURLY_LIMIT = 120;
// The id a browser makes for itself (components/TapeStats.tsx).
const VISITOR = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

/** A browser gives its heart to a comment on a tape, or takes it back. Answers with the comment's count. */
export async function POST(request: Request) {
  try {
    const { tapeId, target, visitor, on } = await request.json();

    // What can be refused without the database is refused first, so that a made-up request costs no query.
    if (typeof tapeId !== 'string' || !getTapeById(tapeId)) {
      return Response.json({ error: 'Unknown tape' }, { status: 400 });
    }
    if (typeof target !== 'string' || typeof visitor !== 'string' || !VISITOR.test(visitor) || typeof on !== 'boolean') {
      return Response.json({ error: 'Invalid heart' }, { status: 400 });
    }

    if (await overLimit(`${addressOf(request)}:hearts`, HOURLY_LIMIT)) {
      return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }
    if (!(await isComment(tapeId, target))) {
      return Response.json({ error: 'Unknown comment' }, { status: 400 });
    }

    const count = await setHeart(tapeId, target, visitor, on);
    revalidateTag(heartsTag(tapeId));
    return Response.json({ count });
  } catch (error) {
    console.error('Error saving a heart:', error);
    return Response.json({ error: 'Failed to save the heart' }, { status: 500 });
  }
}
