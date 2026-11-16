// Track IDs the site itself writes and reads. An ID is an ordinary comment whose text is one line:
//
//     [B 12:34] Moby - Go          on a tape with sides: the side's label as the site shows it, then the time
//     [12:34] Moby - Go            on a tape that is one recording
//
// or several such lines, one ID to each: a sitting's worth, posted together from the tracklist. A line can
// also take a mark away:
//
//     [B 12:34] no track starts here
//
// Nothing is ever deleted by it. It is one more comment, and the reader lets it outweigh what was said of that
// moment before it; delete the comment and what it took away is back.
//
// The comments of 2009 onward say the same things in a hundred ways, and `parse.ts` reads those. This form is
// for IDs made with the "ID this track" form on the tape page, where the side and the time are known exactly
// and should be read back exactly, not guessed from prose. Pure functions, used by the browser and the server.

import { formatTime } from '../time-utils';

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
  /** When, as the comments date it: of two, the later said sorts after the earlier. */
  date: string;
  /**
   * The same record said again later on the side with nothing else between, which the reader takes for the
   * same play: each later saying, as the ID it would otherwise be. It is one again as soon as something
   * comes between it and this, or this is taken away (see `withChanges` in side.ts).
   */
  again?: Omit<TrackId, 'known' | 'again'>[];
};

/** A line of a side's running order: a track written down in its place, with or without a time. */
export type ListedTrack = {
  /** Its number in the list. */
  n: number;
  artist: string;
  title: string;
  /** False where the list itself has the track down as unknown. */
  known: boolean;
  /** When the list says it plays, in seconds, where it says. */
  at?: number;  /** The record's page on Discogs and its length as printed, where the tape's own tracklist gives them. */
  link?: string;
  duration?: string;
};

/**
 * A side's tracks in the order they play, from a list that gives few or none of them a time: the tape's own
 * tracklist (`by` is null) or the fullest list someone kept in the comments (`by` is who). The tape page
 * offers a visitor ID'ing a track the lines that could be it.
 */
export type RunningOrder = { by: string | null; tracks: ListedTrack[] };

/**
 * How close an ID in the site's form must be to where a track starts, in seconds, to be said of that track:
 * it is then that track put right. Further off it is a track of its own. The form places an ID to the
 * second, and a correction made with it lands on the very second of what it corrects, so little room is
 * needed. (Two times typed into sentences are rougher: the reader gives those 20 seconds of each other, see
 * `reconcile` in parse.ts.)
 */
export const ONE_MOMENT = 5;

/** A time as people write one in a comment: 12:34, or 1:02:03 past the hour. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const rest = `${String(Math.floor((s % 3600) / 60)).padStart(s >= 3600 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${rest}` : rest;
};

/** A name as it is written into a comment: its ends trimmed, and one space wherever it had several. */
export const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The comment for an ID. `position` is the side's label ("A", "1B"), or null on a tape with one side. A name
 * the visitor didn't know is written "?", so the line keeps its shape.
 */
export function composeId({ position, time, artist, title }: { position: string | null; time: number; artist: string; title: string }): string {
  return `[${position ? `${position} ` : ''}${clock(time)}] ${tidy(artist) || '?'} - ${tidy(title) || '?'}`;
}

const GONE = 'no track starts here';

/** The line that takes away whatever is marked at a time: an ID nobody should have made, or one made at the wrong moment. */
export const composeRemoval = ({ position, time }: { position: string | null; time: number }) => `[${position ? `${position} ` : ''}${clock(time)}] ${GONE}`;

const COMPOSED = /^\[(?:(\S+) )?(\d{1,3}):(\d{2})(?::(\d{2}))?\] (?:(.+?) - (.+)|(no track starts here))$/i;

/** `gone` is true for a line that takes the mark at its time away; it has no names. */
export type Composed = { position: string | null; time: number; artist: string; title: string; gone: boolean };

/**
 * One line in the form `composeId` or `composeRemoval` writes, taken apart: the side's label as written (null
 * if none), the time, and the names. Null for anything else. Whether the tape has such a side is `readComposed`'s business.
 */
export function splitComposed(line: string): Composed | null {
  const m = COMPOSED.exec(line.trim());
  if (!m) return null;
  const [, position, a, b, c, artist, title, gone] = m;
  const time = c === undefined ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c);
  const name = (s = '') => (s.trim() === '?' ? '' : s.trim());
  return { position: position ?? null, time, artist: name(artist), title: name(title), gone: Boolean(gone) };
}

/**
 * A comment that is nothing but IDs in that form, one to a line: each taken apart. Null for any other
 * comment, one line of talk among the IDs included: such a comment is somebody talking, and is read as that.
 */
export function splitPost(content: string): Composed[] | null {
  const ids: Composed[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const id = splitComposed(line);
    if (!id) return null;
    ids.push(id);
  }
  return ids.length ? ids : null;
}

/**
 * Reads a comment made of lines `composeId` and `composeRemoval` write, or written by hand in the same form,
 * as IDs on the tape's sides. Null for anything else, and for a side label the tape doesn't have: that comment is then read like
 * any other.
 */
export function readComposed(content: string, positions: string[]): { side: number; start: number; artist: string; title: string; gone: boolean }[] | null {
  const post = splitPost(content);
  if (!post) return null;
  const ids = post.map((id) => ({ side: id.position ? positions.indexOf(id.position) : positions.length === 1 ? 0 : -1, start: id.time, artist: id.artist, title: id.title, gone: id.gone }));
  return ids.some((id) => id.side < 0) ? null : ids;
}

/** The ID playing at a time on a side, if there is one. `ids` in order of start. */
export function idAt<Id extends Pick<TrackId, 'start' | 'end'>>(ids: Id[], time: number): Id | null {
  let found: Id | null = null;
  for (const id of ids) {
    if (id.start > time) break;
    if (time < id.end) found = id;
  }
  return found;
}

/**
 * Where an ID is, as the page shows it wherever one appears: the side's label on a tape with sides, then the
 * time the way the player writes times. "A 0:01:55"; on a tape that is one recording, "0:01:55". (The comment
 * an ID is kept as writes its time the shorter way people do, `[A 1:55]`; see `composeId`.)
 */
export const idPlace = (position: string | null, time: number) => `${position ? `${position} ` : ''}${formatTime(time)}`;

/** How an ID is said in one line: "Moby — Go", or what little is known of it. */
export const idLabel = (id: Pick<TrackId, 'artist' | 'title' | 'known'>) =>
  id.known ? [id.artist, id.title].filter(Boolean).join(' — ') || 'Unknown track' : 'Unknown track';
