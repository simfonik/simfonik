// Track IDs the site itself writes and reads. An ID is an ordinary comment whose text is one line:
//
//     [B 12:34] Moby - Go          on a tape with sides: the side's label as the site shows it, then the time
//     [12:34] Moby - Go            on a tape that is one recording
//
// The comments of 2009 onward say the same things in a hundred ways, and `parse.ts` reads those. This form is
// for IDs made with the "ID this track" form on the tape page, where the side and the time are known exactly
// and should be read back exactly, not guessed from prose. Pure functions, used by the browser and the server.

/** One identified stretch of a side: what the tape page marks on the waveform. Times in seconds. */
export type TrackId = {
  start: number;
  end: number;
  artist: string;
  title: string;
  /** False where someone marked the spot or asked about it and nobody has named the track. */
  known: boolean;
  /** Who said so. */
  by: string;
};

/** A time as people write one in a comment: 12:34, or 1:02:03 past the hour. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const rest = `${String(Math.floor((s % 3600) / 60)).padStart(s >= 3600 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${rest}` : rest;
};

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The comment for an ID. `position` is the side's label ("A", "1B"), or null on a tape with one side. A name
 * the visitor didn't know is written "?", so the line keeps its shape.
 */
export function composeId({ position, time, artist, title }: { position: string | null; time: number; artist: string; title: string }): string {
  return `[${position ? `${position} ` : ''}${clock(time)}] ${tidy(artist) || '?'} - ${tidy(title) || '?'}`;
}

const COMPOSED = /^\[(?:(\S+) )?(\d{1,3}):(\d{2})(?::(\d{2}))?\] (.+?) - (.+)$/;

/**
 * Reads a comment written by `composeId`, or by hand in the same form. Null for anything else, and for a
 * side label the tape doesn't have: that comment is then read like any other.
 */
export function readComposed(content: string, positions: string[]): { side: number; start: number; artist: string; title: string } | null {
  const m = COMPOSED.exec(content.trim());
  if (!m) return null;
  const [, position, a, b, c, artist, title] = m;
  const side = position ? positions.indexOf(position) : positions.length === 1 ? 0 : -1;
  if (side < 0) return null;
  const start = c === undefined ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c);
  const name = (s: string) => (s.trim() === '?' ? '' : s.trim());
  return { side, start, artist: name(artist), title: name(title) };
}

/** The ID playing at a time on a side, if there is one. `ids` in order of start. */
export function idAt(ids: TrackId[], time: number): TrackId | null {
  let found: TrackId | null = null;
  for (const id of ids) {
    if (id.start > time) break;
    if (time < id.end) found = id;
  }
  return found;
}

/** How an ID is said in one line: "Moby — Go", or what little is known of it. */
export const idLabel = (id: Pick<TrackId, 'artist' | 'title' | 'known'>) =>
  id.known ? [id.artist, id.title].filter(Boolean).join(' — ') || 'Unknown track' : 'Unknown track';
