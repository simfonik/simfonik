import { sql } from '@/lib/db';
import { COMMENTS_CACHE_TAG } from '@/lib/comments';
import { getTapeById } from '@/lib/data';
import { revalidateTag } from 'next/cache';
import { sendCommentNotification } from '@/lib/email';
import { addressOf, overLimit } from '@/lib/rate-limit';
import { hasLink, readComposed } from '@/lib/track-ids/compose';

// How many comments one address may post in an hour. Track IDs made on the tape page are comments too
// (lib/track-ids/compose.ts), and someone naming a tape's tracks one at a time posts one for each, so those
// are counted apart from talk and allowed more of.
const HOURLY_LIMIT = { talk: 5, trackIds: 60 };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tapeId, authorName, authorEmail, content, website } = body;

    // A post of track IDs: nothing but lines in the site's own form, for sides the tape has.
    const tape = typeof tapeId === 'string' ? getTapeById(tapeId) : undefined;
    const ids = tape && typeof content === 'string' ? readComposed(content, tape.sides.map((side) => side.position)) : null;
    const trackIds = Boolean(ids);

    // 1. Rate limiting, by address
    const ip = addressOf(request);
    if (await overLimit(trackIds ? `${ip}:track-ids` : ip, trackIds ? HOURLY_LIMIT.trackIds : HOURLY_LIMIT.talk)) {
      return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 2. Honeypot check
    if (website) {
      return Response.json({ error: 'Invalid submission' }, { status: 400 });
    }

    // 3. Validation
    const name = authorName?.trim();
    const text = content?.trim();

    if (!name || name.length < 1 || name.length > 100) {
      return Response.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
    }

    if (!text || text.length < 10 || text.length > 5000) {
      return Response.json({ error: 'Comment must be 10-5000 characters' }, { status: 400 });
    }

    // Check for whitespace-only content
    if (!/\S/.test(text)) {
      return Response.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }

    if (!tapeId) {
      return Response.json({ error: 'Tape ID is required' }, { status: 400 });
    }

    // A track's name is an artist and a title. One with a web address in it is not taken as an ID: IDs are
    // approved as they come and send no notification, and that is not to be a way round the moderation of talk.
    if (ids?.some((id) => hasLink(`${id.artist} ${id.title} ${id.line ? `${id.line.artist} ${id.line.title}` : ''}`))) {
      return Response.json({ error: 'Track IDs can’t include links.' }, { status: 400 });
    }

    // 4. Insert comment (auto-approved; admin gets a notification email
    // and can delete via /admin/comments if it's bad-faith content).
    await sql`
      INSERT INTO comments (tape_id, author_name, author_email, content, approved)
      VALUES (${tapeId}, ${name}, ${authorEmail || null}, ${text}, true)
    `;

    revalidateTag(COMMENTS_CACHE_TAG);

    // Best-effort notification — must not fail the request. The
    // implementation in lib/email.ts already swallows its own errors,
    // but defense-in-depth: wrap here too so any sync throw before its
    // try/catch can't leak out and 500 a comment that already inserted.
    // Track IDs send none: a sitting is many posts, and each is on the
    // tape's page, in its tracklist's history.
    if (!trackIds) {
      try {
        await sendCommentNotification({
          tapeId,
          authorName: name,
          authorEmail: authorEmail || null,
          content: text,
        });
      } catch (err) {
        console.error('Comment notification failed (comment is still posted):', err);
      }
    }

    return Response.json({
      success: true,
      message: 'Comment posted'
    });

  } catch (error) {
    console.error('Error submitting comment:', error);
    return Response.json({ error: 'Failed to submit comment' }, { status: 500 });
  }
}
