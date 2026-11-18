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
 * A time as it is written: 0:05:00, 5:00 or 1:02:03, with a colon between the parts, or a full stop, a comma
 * or a space, as a time pasted in may have. Figures alone are read from the right, two for the seconds and
 * two for the minutes: 500 is 5:00, and 10203 is 1:02:03. (The time's blank on the tape page is typed in
 * figures and always holds the first form: typeTime, below.) In seconds, or null if it is no time.
 */
export function parseTime(text: string): number | null {
  const typed = text.trim();
  const parts = /^\d{1,7}$/.test(typed) ? [typed.slice(0, -4), typed.slice(-4, -2), typed.slice(-2)].filter(Boolean) : typed.split(/[:.,\s]+/);
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  if (parts.length === 1) return Number(parts[0]) < 60 ? Number(parts[0]) : null;
  const [secs, mins, hours = 0] = parts.map(Number).reverse();
  return secs < 60 && (parts.length === 2 || mins < 60) ? hours * 3600 + mins * 60 + secs : null;
}

/**
 * The time's blank as it is typed in: the figures come in from the right and the colons stay where they are,
 * so 5, 0, 0 reads 0:00:05, then 0:00:50, then 0:05:00, and a figure deleted goes back out the same way.
 * `text` is what the blank holds after the key, and only its figures count, so a time pasted whole (5:00)
 * reads as itself. Deleted down to nothing but zeros the blank is empty; a sixth figure has nowhere to go and
 * leaves the blank as it `was`.
 */
export function typeTime(text: string, was: string, deleting: boolean): string {
  const figures = text.replace(/\D/g, '');
  const counted = figures.replace(/^0+/, '');
  if (!figures || (deleting && !counted)) return '';
  if (counted.length > 5) return was;
  const shown = counted.padStart(5, '0');
  return `${shown[0]}:${shown.slice(1, 3)}:${shown.slice(3)}`;
}

/** A time on a tape side, always h:mm:ss with its zeros (0:01:55): how the player and every track ID say one. */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
