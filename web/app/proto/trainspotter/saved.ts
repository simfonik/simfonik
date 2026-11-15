// What a visitor's browser keeps for a tape, and how that copy is brought back in line with the comments on a
// return visit. No React and no storage here: these are the rules, as plain functions.
import type { Proposal } from "./parse";
import type { Cue } from "./tracklist-primitive";

/** A place on the tape, as the comments give it: which side, and the second a track starts. */
export type Spot = { side: number; start: number };
/** The same track, give or take: comments rarely agree to the second. */
export const near = (a: Spot, b: Spot) => a.side === b.side && Math.abs(a.start - b.start) <= 20;

/** A track as the comments have it, ready for the timeline. Its id records where the comments put it. */
export const toCue = (p: Proposal, sides: string[]): Cue => ({
  id: `crowd-${p.side}-${p.start}`,
  track: sides[p.side] ?? sides[0],
  start: p.start,
  end: p.end,
  artist: p.artist,
  title: p.title,
  known: p.known,
  by: p.author,
  open: p.open,
});

/** Where the comments put a track that came from them, or null for one the visitor marked or ID'd themselves.
    Still right after the visitor drags the track somewhere else. */
export const origin = (c: Cue): Spot | null => {
  const from = c.by ? c.id.match(/^crowd-(\d+)-(\d+)/) : null;
  return from ? { side: Number(from[1]), start: Number(from[2]) } : null;
};

/** What is kept in this browser for a tape. */
export type Saved = {
  v: 2;
  cues: Cue[];
  /** The comment tracks this visitor took off the timeline, by where the comments have them. The only thing
      that keeps a comment's track away: one the comments have and the timeline lacks is otherwise put back. */
  removed: Spot[];
  /** The comment tracks whose start or end this visitor set themselves (dragged, trimmed, nudged, or cut
      short by a track marked inside them), by id. Those times are theirs; every other comment track keeps
      following the comments, times included. */
  moved?: string[];
  /** How long each side's audio is, in seconds, where it has said. The comments are read against these, and
      on a slow connection the audio says so only after the saved work has been brought in line with them. */
  lengths?: (number | null)[];
};

/** Saved work as the page holds it. `moved` is null for work saved before the page recorded it. */
export type Kept = { cues: Cue[]; removed: Spot[]; moved: Set<string> | null; lengths: (number | null)[] };

/**
 * Reads what was stored. Two shapes: today's, and the bare list of tracks that earlier versions of the page
 * saved. `opened` says whether those earlier versions left their sign that the page had finished opening; a
 * bare empty list without it is a first visit that was cut short, not an emptied tape.
 */
export function readSaved(raw: string | null, opened: boolean): Kept | null {
  let saved: unknown = null;
  try {
    saved = JSON.parse(raw ?? "null");
  } catch {
    return null;
  }
  if (Array.isArray(saved)) return saved.length > 0 || opened ? { cues: saved.filter(isCue), removed: [], moved: null, lengths: [] } : null;
  if (!saved || typeof saved !== "object" || !Array.isArray((saved as Saved).cues)) return null;
  const { cues, removed, moved, lengths } = saved as { cues: unknown[]; removed?: unknown; moved?: unknown; lengths?: unknown };
  return {
    cues: cues.filter(isCue),
    removed: Array.isArray(removed) ? removed.filter(isSpot) : [],
    moved: Array.isArray(moved) ? new Set(moved.filter((id): id is string => typeof id === "string")) : null,
    lengths: Array.isArray(lengths) ? lengths.map((d) => (typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null)) : [],
  };
}

// Storage is the visitor's to edit and other versions of this page have written to it. Whatever in it is not a
// track is left out: one bad entry would otherwise break the page on every visit, with no way back.
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const isSpot = (x: unknown): x is Spot => isObject(x) && Number.isFinite(x.side) && Number.isFinite(x.start);
const isCue = (x: unknown): x is Cue =>
  isObject(x) && typeof x.id === "string" && typeof x.track === "string" && Number.isFinite(x.start) && Number.isFinite(x.end) && typeof x.artist === "string" && typeof x.title === "string" && typeof x.known === "boolean";

/**
 * Return visit: the saved timeline is brought back in line with the comments. Nobody approves any of it.
 *
 *  · A track that came from the comments follows the comments. If they no longer have anything there, it
 *    goes; if they now say something else there, it takes that name, and their times with it. That is what
 *    clears a misreading once the reader is fixed, instead of leaving it in every browser that saved it, and
 *    what stops a track running on over one the comments have since timed inside it. Times the visitor set
 *    themselves are kept.
 *  · A track the comments have and the timeline lacks is put back, unless the visitor removed it. That covers
 *    what was posted since the last visit and anything that went missing for any other reason.
 *  · A track the visitor marked or ID'd themselves is never touched.
 *
 * Returns null when the saved timeline already agrees with the comments.
 */
export function followComments(kept: Pick<Kept, "cues" | "removed" | "moved">, proposals: Proposal[], sides: string[], stamp = Date.now().toString(36)): { cues: Cue[]; added: number; corrected: number; removed: number } | null {
  let added = 0;
  let corrected = 0;
  let removed = 0;
  const cues = kept.cues.flatMap((c) => {
    const from = origin(c);
    if (!from) return [c];
    const p = proposals.find((x) => near(x, from));
    if (!p) {
      removed++;
      return [];
    }
    // For work saved before the page recorded whose times were whose, a start still where the comments put it
    // is theirs.
    const mine = kept.moved ? kept.moved.has(c.id) : c.start !== from.start;
    // The last track on a side keeps its end: the comments only guess it, and the page has since cut it to
    // the side's real length.
    const last = !proposals.some((x) => x.side === p.side && x.start >= p.end);
    const next = { ...c, ...(mine ? {} : { start: p.start, end: last ? c.end : p.end, open: last ? c.open : p.open }), artist: p.artist, title: p.title, known: p.known, by: p.author };
    if (next.start === c.start && next.end === c.end && next.artist === c.artist && next.title === c.title && next.known === c.known) return [c];
    corrected++;
    return [next];
  });
  for (const p of proposals) {
    if (kept.removed.some((spot) => near(spot, p))) continue;
    // Already there: a track that came from this spot (wherever it has been dragged), or any track at it.
    const there = cues.some((c) => {
      const from = origin(c);
      return (from && near(from, p)) || near({ side: sides.indexOf(c.track), start: c.start }, p);
    });
    if (there) continue;
    cues.push({ ...toCue(p, sides), id: `crowd-${p.side}-${p.start}-${stamp}` });
    added++;
  }
  return added || corrected || removed ? { cues, added, corrected, removed } : null;
}
