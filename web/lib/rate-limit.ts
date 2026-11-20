import { createHash } from 'crypto';
import { sql } from './db';

/** The address a request came from, as the limiter knows it. */
export function addressOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

/**
 * Whether `key` has already had `limit` requests in its hour. If not, this one is counted. A key is an
 * address, or an address and what it is doing ("1.2.3.4:hearts"), so each kind of request has a count of
 * its own. Only a hash of the key is kept.
 */
export async function overLimit(key: string, limit: number): Promise<boolean> {
  const hash = createHash('sha256').update(key).digest('hex');
  const { rows } = await sql`
    SELECT count, reset_at FROM rate_limits
    WHERE ip_hash = ${hash} AND reset_at > NOW()
  `;
  if (rows.length > 0 && rows[0].count >= limit) return true;

  const resetAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  if (rows.length === 0 || new Date(rows[0].reset_at) < new Date()) {
    // Start new window
    await sql`
      INSERT INTO rate_limits (ip_hash, count, reset_at)
      VALUES (${hash}, 1, ${resetAt})
      ON CONFLICT (ip_hash) DO UPDATE
      SET count = 1, reset_at = ${resetAt}
    `;
  } else {
    // Increment count only
    await sql`
      UPDATE rate_limits
      SET count = count + 1
      WHERE ip_hash = ${hash}
    `;
  }
  return false;
}
