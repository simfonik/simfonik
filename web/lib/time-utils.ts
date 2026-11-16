/**
 * Format a timestamp as relative time or absolute date
 * Same logic as RecentCommentsTicker
 */
export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * A time as a visitor types one: 0:05:00, 5:00 or 1:02:03, with a colon between the parts, or a full stop or
 * a space (a phone's number keys don't always have the colon). In seconds, or null if it is no time.
 */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(/[:.\s]+/);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const [secs, mins, hours = 0] = parts.map(Number).reverse();
  return secs < 60 && (parts.length === 2 || mins < 60) ? hours * 3600 + mins * 60 + secs : null;
}

/** A time on a tape side, always h:mm:ss with its zeros (0:01:55): how the player and every track ID say one. */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
