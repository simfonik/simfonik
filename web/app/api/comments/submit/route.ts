import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tapeId, authorName, authorEmail, content, website } = body;

    // Get IP address for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // 1. Rate limiting check
    const { rows: rateLimitRows } = await sql`
      SELECT count, reset_at FROM rate_limits
      WHERE ip_hash = ${ipHash} AND reset_at > NOW()
    `;

    if (rateLimitRows.length > 0 && rateLimitRows[0].count >= 5) {
      return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Update rate limit
    const resetAt = new Date(Date.now() + 3600000); // 1 hour from now
    
    if (rateLimitRows.length === 0 || new Date(rateLimitRows[0].reset_at) < new Date()) {
      // Start new window
      await sql`
        INSERT INTO rate_limits (ip_hash, count, reset_at)
        VALUES (${ipHash}, 1, ${resetAt})
        ON CONFLICT (ip_hash) DO UPDATE
        SET count = 1, reset_at = ${resetAt}
      `;
    } else {
      // Increment count only
      await sql`
        UPDATE rate_limits
        SET count = count + 1
        WHERE ip_hash = ${ipHash}
      `;
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

    // 4. Insert comment (unapproved by default)
    await sql`
      INSERT INTO comments (tape_id, author_name, author_email, content, approved)
      VALUES (${tapeId}, ${name}, ${authorEmail || null}, ${text}, false)
    `;

    return Response.json({
      success: true,
      message: 'Comment pending approval'
    });

  } catch (error) {
    console.error('Error submitting comment:', error);
    return Response.json({ error: 'Failed to submit comment' }, { status: 500 });
  }
}
