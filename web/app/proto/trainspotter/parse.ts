// Reads the timed track IDs that visitors have been leaving in comments since 2009 and reconciles them
// into one proposal per moment of tape. Pure functions, no I/O.

export type Sighting = {
  side: number; // index into the tape's sides
  start: number; // seconds
  end?: number;
  artist: string;
  title: string; // for an unidentified track, whatever hint the commenter gave
  known: boolean;
  author: string;
  date: string;
};

const seconds = (t: string) => {
  const p = t.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
};

const SIDE = /\b(?:side|part)[\s-]*(a|b|c|d|1|2|3|4|one|two)\b/i;
const sideIndex = (s: string) => ({ a: 0, "1": 0, one: 0, b: 1, "2": 1, two: 1, c: 2, "3": 2, d: 3, "4": 3 })[s.toLowerCase()] ?? 0;
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
const DASH = String.raw`[-–—]`;
const clean = (s: string) =>
  s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[“”"‎]/g, "")
    .replace(/\s+/g, " ")
    .replace(new RegExp(String.raw`^[\s:,.${"\\-"}–—]+|[\s:,${"\\-"}–—]+$`, "g"), "")
    .trim();

function split(text: string): { artist: string; title: string; known: boolean } | null {
  const t = clean(text);
  if (t.length > 140) return null; // a sentence, not a track name
  if (!t || /^\?+/.test(t)) return { artist: "", title: clean(t.replace(/^\?+/, "")).replace(/^['‘’]|['‘’]$/g, ""), known: false };
  const m = t.match(new RegExp(String.raw`^(.+?)\s+${DASH}\s+(.+)$`));
  if (m) return { artist: clean(m[1]), title: clean(m[2]), known: true };
  return { artist: "", title: t, known: true };
}

export function parseComment(content: string, author: string, date: string): Sighting[] {
  const out: Sighting[] = [];
  let side = 0;
  const push = (s: number, start: number, text: string, end?: number) => {
    const parts = split(text);
    if (parts && Number.isFinite(start)) out.push({ side: s, start, end, ...parts, author, date });
  };
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // A heading on its own switches side for the list that follows.
    const heading = line.match(SIDE);
    if (heading && !new RegExp(TIME).test(line) && line.length < 60) {
      side = sideIndex(heading[1]);
      continue;
    }

    let m: RegExpMatchArray | null;
    // "Side A - 5:30 - 13:20 - Artist - Title"
    if ((m = line.match(new RegExp(String.raw`^${SIDE.source}\s*${DASH}?\s*(${TIME})\s*${DASH}\s*(${TIME})\s*${DASH}?\s*(.+)$`, "i")))) {
      push(sideIndex(m[1]), seconds(m[2]), m[4], seconds(m[3]));
    }
    // "Side B @ 26:30 - Artist - Title"
    else if ((m = line.match(new RegExp(String.raw`^${SIDE.source}\s*[@:]?\s*(?:at\s*)?(${TIME})\s*${DASH}?\s*(.+)$`, "i")))) {
      push(sideIndex(m[1]), seconds(m[2]), m[3]);
    }
    // "16:25 on side-B is Artist Title"
    else if ((m = line.match(new RegExp(String.raw`^(${TIME})\s+on\s+${SIDE.source}\s+is\s+(.+)$`, "i")))) {
      push(sideIndex(m[2]), seconds(m[1]), m[3]);
    }
    // "3. [05:15] – Artist – Title"   "3 - 5:15 - Artist - Title"   "19 - 47 - ?? hint"
    else if ((m = line.match(new RegExp(String.raw`^\d{1,2}\s*[.)${"\\-"}–]\s*\[?\s*(${TIME}|\d{1,2})\s*(?:${DASH}\s*)?\]?\s*${DASH}?\s*(.*)$`)))) {
      push(side, seconds(m[1]), m[2]);
    }
    // "[05:15] Artist – Title"   "11:00 Artist - Title"
    else if ((m = line.match(new RegExp(String.raw`^\[?(${TIME})\]?\s*${DASH}?\s*(.+)$`)))) {
      push(side, seconds(m[1]), m[2]);
    }
    // "13. ??? (26:20 – 28:20)"
    else if ((m = line.match(new RegExp(String.raw`^\d{1,2}\s*[.)]\s*(.+?)\s*\((${TIME})\s*${DASH}\s*(\d{1,2}\s?:\d{2})\)\s*$`)))) {
      push(side, seconds(m[2]), m[1], seconds(m[3].replace(/\s/g, "")));
    }
    // "Artist - Title at 30:24"
    else if ((m = line.match(new RegExp(String.raw`^(.{3,90}?)\s+(?:at|@)\s+(${TIME})\b`, "i")))) {
      const s = line.match(SIDE);
      push(s ? sideIndex(s[1]) : side, seconds(m[2]), m[1]);
    }
  }
  return out;
}

export type Proposal = Sighting & { end: number; voices: number };

const words = (s: Sighting) => new Set(`${s.artist} ${s.title}`.toLowerCase().replace(/\([^)]*\)/g, "").match(/[a-z0-9]{3,}/g) ?? []);
function sameTrack(a: Sighting, b: Sighting) {
  const wa = words(a);
  const wb = words(b);
  const small = wa.size <= wb.size ? wa : wb;
  const big = small === wa ? wb : wa;
  if (small.size < 2) return false;
  let hit = 0;
  small.forEach((w) => big.has(w) && hit++);
  return hit / small.size >= 0.7;
}

/** One proposal per moment: the newest identification wins, and an ID always beats a question mark. */
export function reconcile(sightings: Sighting[], lengths: number[]): Proposal[] {
  const out: Proposal[] = [];
  lengths.forEach((length, side) => {
    const here = sightings.filter((s) => s.side === side && s.start < length).sort((a, b) => a.start - b.start || a.date.localeCompare(b.date));
    const groups: Sighting[][] = [];
    for (const s of here) {
      const g = groups[groups.length - 1];
      if (g && s.start - g[0].start <= 20) g.push(s);
      else groups.push([s]);
    }
    groups.forEach((g, i) => {
      const known = g.filter((s) => s.known && (s.artist || s.title));
      const best = (known.length ? known : g).reduce((a, b) => (b.date >= a.date ? b : a));
      const next = groups[i + 1]?.[0].start ?? Math.min(length, best.start + 240);
      const end = best.end && best.end > best.start ? Math.min(best.end, length) : next;
      // "Reach Up To Mars at 30:24" a minute into a track already named that is the same track, not a new one.
      const prev = out[out.length - 1];
      if (prev && prev.side === side && best.known && sameTrack(prev, best)) {
        prev.voices += new Set(g.map((s) => s.author)).size;
        prev.end = Math.max(prev.end, end);
        return;
      }
      if (end - best.start >= 5) out.push({ ...best, start: g[0].start, end, voices: new Set(g.map((s) => s.author)).size });
    });
  });
  return out;
}
