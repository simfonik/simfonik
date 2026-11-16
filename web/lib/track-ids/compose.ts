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
// An ID can say which line of the tape's tracklist it is, where it gives the track another name than the
// list does (the name put right, or its mix added): the list's own words follow, so the line is still that
// line and is not left waiting for a time beside its own correction:
//
//     [B 12:34] Moby - Go (Woodtick Mix) [was Moby - Go]
//
// Nothing is ever deleted by a line. It is one more comment, and the reader lets it outweigh what was said of that
// moment before it; delete the comment and what it took away, or renamed, is back.
//
// The comments of 2009 onward say the same things in a hundred ways, and `parse.ts` reads those. This form is
// for IDs made with the "ID this track" form on the tape page, where the side and the time are known exactly
// and should be read back exactly, not guessed from prose. Pure functions, used by the browser and the server.

import { formatTime } from '../time-utils';

/** A line of a side's running order: a track written down in its place, with or without a time. */
export type ListedTrack = {
  /** Its number in the list. */
  n: number;
  artist: string;
  title: string;
  /** False where the list itself has the track down as unknown. */
  known: boolean;
  /** When the list says it plays, in seconds, where it says. */
  at?: number;
  /** The record's page on Discogs and its length as printed, where the tape's own tracklist gives them. */
  link?: string;
  duration?: string;
};

/**
 * A side's tracks in the order they play, from a list that gives few or none of them a time: the tape's own
 * tracklist (`by` is null) or the fullest list someone kept in the comments (`by` is who). The tape page
 * offers a visitor ID'ing a track the lines that could be it.
 */
export type RunningOrder = { by: string | null; tracks: ListedTrack[] };

/** A time as people write one in a comment: 12:34, or 1:02:03 past the hour. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const rest = `${String(Math.floor((s % 3600) / 60)).padStart(s >= 3600 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${rest}` : rest;
};

/** A name as it is written into a comment: its ends trimmed, and one space wherever it had several. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * An artist as it is written into a comment. There a dash with a space each side is what parts the artist
 * from the title, so one inside the artist's name is closed up, or the line would read back with half the
 * name in the title: "Jean - Michel" is written "Jean-Michel".
 */
const tidyArtist = (s: string) => tidy(s).replace(/ - /g, '-');

/** An artist and a title: a track as a list or an ID names it. */
export type Named = { artist: string; title: string };

const written = ({ artist, title }: Named) => `${tidyArtist(artist) || '?'} - ${tidy(title) || '?'}`;

/**
 * The comment for an ID. `position` is the side's label ("A", "1B"), or null on a tape with one side. A name
 * the visitor didn't know is written "?", so the line keeps its shape. `line` is the list's own words for the
 * track, where the ID is a line of the tape's tracklist under another name.
 */
export function composeId({ position, time, artist, title, line }: Named & { position: string | null; time: number; line?: Named }): string {
  return `[${position ? `${position} ` : ''}${clock(time)}] ${written({ artist, title })}${line && (artist.trim() || title.trim()) ? ` [was ${written(line)}]` : ''}`;
}

const GONE = 'no track starts here';

/** The line that takes away whatever is marked at a time: an ID nobody should have made, or one made at the wrong moment. */
export const composeRemoval = ({ position, time }: { position: string | null; time: number }) => `[${position ? `${position} ` : ''}${clock(time)}] ${GONE}`;

const COMPOSED = /^\[(?:(\S+) )?(\d{1,3}):(\d{2})(?::(\d{2}))?\] (?:(.+?) - (.+)|(no track starts here))$/i;

const WAS = /^(.+) \[was (.+?) - (.+)\]$/i;

/**
 * `gone` is true for a line that takes the mark at its time away; it has no names. `line` is the list's own
 * words for the track, where the line says which line of the tracklist it is.
 */
export type Composed = Named & { position: string | null; time: number; gone: boolean; line?: Named };

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
  const was = title === undefined ? null : WAS.exec(title);
  return {
    position: position ?? null,
    time,
    artist: name(artist),
    title: name(was ? was[1] : title),
    gone: Boolean(gone),
    ...(was ? { line: { artist: name(was[2]), title: name(was[3]) } } : {}),
  };
}

/**
 * Reads a comment that is nothing but lines `composeId` and `composeRemoval` write, or lines written by hand in
 * the same form, as IDs on the tape's sides. Null for any other comment, one line of talk among the IDs
 * included: that is somebody talking. Null too for a side label the tape doesn't have, and for a line with no
 * label on a tape with sides. Such a comment is read like any other.
 */
export function readComposed(content: string, positions: string[]): (Named & { side: number; start: number; gone: boolean; line?: Named })[] | null {
  const ids = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const id = splitComposed(line);
    if (!id) return null;
    const side = id.position ? positions.indexOf(id.position) : positions.length === 1 ? 0 : -1;
    if (side < 0) return null;
    ids.push({ side, start: id.time, artist: id.artist, title: id.title, gone: id.gone, ...(id.line ? { line: id.line } : {}) });
  }
  return ids.length ? ids : null;
}

/**
 * Where an ID is, as the page shows it wherever one appears: the side's label on a tape with sides, then the
 * time the way the player writes times. "A 0:01:55"; on a tape that is one recording, "0:01:55". (The comment
 * an ID is kept as writes its time the shorter way people do, `[A 1:55]`; see `composeId`.)
 */
export const idPlace = (position: string | null, time: number) => `${position ? `${position} ` : ''}${formatTime(time)}`;

/** How an ID is said in one line: "Moby — Go", or what little is known of it. */
export const idLabel = (id: { artist: string; title: string; known: boolean }) =>
  id.known ? [id.artist, id.title].filter(Boolean).join(' — ') || 'Unknown track' : 'Unknown track';
