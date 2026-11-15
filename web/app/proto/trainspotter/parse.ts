// Reads the timed track IDs that visitors have been leaving in comments since 2009 and reconciles them
// into one proposal per moment of tape. Pure functions, no I/O.

export type Sighting = {
  side: number; // index into the tape's sides
  start: number; // seconds
  end?: number;
  artist: string;
  title: string; // for an unidentified track, whatever hint the commenter gave
  known: boolean;
  /** Written with a leading "+": a record brought in over the one already playing. */
  layer?: boolean;
  /** Read out of a sentence that didn't say which side. Only trusted on a tape with one side. */
  unsure?: boolean;
  author: string;
  date: string;
};

const seconds = (t: string) => {
  const p = t.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
};

// "Side A", "side-b", "Part 2", and "Side.A" (a dot only when nothing follows it, so "that side. A friend" is not a side).
const SIDE = /\b(?:side|part)(?:[\s-]*|\.)(a|b|c|d|1|2|3|4|one|two)\b/i;
const sideIndex = (s: string) =>
  ({ a: 0, "1": 0, "1st": 0, first: 0, one: 0, b: 1, "2": 1, "2nd": 1, second: 1, two: 1, c: 2, "3": 2, "3rd": 2, third: 2, d: 3, "4": 3, "4th": 3, fourth: 3 })[s.toLowerCase()] ?? 0;
// "the second side", "1st side"
const SIDE_ORD = /\b(1st|2nd|3rd|4th|first|second|third|fourth)[\s-]+side\b/i;
const squash = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
// The name of a side as people write it: "Technology Has Its Subliminal Side" is "Technology Has Its Subliminal".
const stem = (s: string) => squash(s).replace(/ side$/, "");
/** Same words up to a typo or two: "Full Moon Maddness" is "Full Moon Madness". */
const alike = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 8) return false;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length] <= Math.max(1, Math.floor(b.length / 12));
};
/**
 * Which side a piece of text names by the side's own title: "on the Cookie side", "Planet Earth", "Side 1 - Technology
 * Has Its Subliminal". The title wins over a letter or number beside it: commenters number the sides in the order
 * they played them, and "Side 1" is not always the tape's A. A bare title only counts as a heading (a line that is
 * nothing else); inside a sentence it must be followed or preceded by the word "side", so a DJ's name in a track
 * credit is left alone.
 */
export function sideNamed(text: string, titles: string[], heading = false): number | null {
  const n = squash(text);
  const bare = n.replace(/^(?:side \w+ |on )?(?:the )?/, "").replace(/ side$/, "");
  const found = new Set<number>();
  let best = 0;
  titles.forEach((title, i) => {
    const t = stem(title);
    if (t.length < 3 || /^side\b/.test(t)) return;
    const hit = ` ${n} `.includes(` ${t} side `) || ` ${n} `.includes(` side ${t} `) || (heading && (alike(bare, t) || (bare.includes(" ") && t.startsWith(`${bare} `))));
    if (!hit) return;
    if (t.length > best) found.clear();
    if (t.length >= best) {
      best = t.length;
      found.add(i);
    }
  });
  return found.size === 1 ? [...found][0] : null;
}
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
const DASH = String.raw`[-–—]`;
// Not "love": it is in half the titles of the era.
const CHATTER = /\b(anyone|anybody|someone|know|knows|remember|omg|wtf|what|who|which|track|tune|song|please|pls|help|amazing)\b/i;
// "the b side", "A-side": the other way round from SIDE.
const SIDE_ALT = /\b([abcd])[\s-]*side\b/i;
const whichSide = (line: string, titles: string[] = []): number | null => {
  const named = sideNamed(line, titles);
  if (named !== null) return named;
  const m = line.match(SIDE) ?? line.match(SIDE_ALT) ?? line.match(SIDE_ORD);
  return m ? sideIndex(m[1]) : null;
};
/** A line that is only a side: "Side B", "Side 1 - Technology Has Its Subliminal", "Planet Earth", "the second side". */
const headingSide = (line: string, titles: string[]): number | null => {
  if (line.length >= 60 || new RegExp(TIME).test(line)) return null;
  const named = sideNamed(line, titles, true);
  if (named !== null) return named;
  const m = line.match(SIDE) ?? line.match(/^\W*(?:the\s+)?(1st|2nd|3rd|4th|first|second|third|fourth)[\s-]+side\W*$/i);
  return m ? sideIndex(m[1]) : null;
};
// Someone asking what a track is. The time they give marks a track nobody has ID'd.
const ASK = /\?|\b(?:anyone|anybody|someone|somebody)\b|\bid\b.*\bplease\b|\bwant(?:ed)? to know\b|\bneed\b.*\b(?:id|name|track)\b|\blooking for\b/i;
// A time that isn't a place on the tape: a link to somewhere else, or the clock time of a post.
const NOT_TAPE = /https?:|youtube|mixcloud|soundcloud|\b\d{1,2}:\d{2}\s*[ap]m\b/i;
// Only real tag names, so "A/B>C" in a title is left alone.
const TAGS = "li|ul|ol|p|br|b|i|u|em|strong|a|div|span|blockquote|code|cite|q|del|strike|abbr|acronym";
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
/** Comments arrive as whatever people pasted: old WordPress markup, entities, and broken tag ends like "Song/li>". */
export const plain = (s: string) =>
  s
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, " ") // whole tags
    .replace(new RegExp(String.raw`\/(?:${TAGS})>`, "gi"), " ") // the tail of a closing tag that lost its "<"
    .replace(new RegExp(String.raw`<\/?(?:${TAGS})\s*$`, "gim"), " ") // the head of a tag that lost its ">"
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
const clean = (s: string) =>
  s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[“”"‎]|''/g, "")
    .replace(/\s+/g, " ")
    .replace(new RegExp(String.raw`^[\s:,.${"\\-"}–—]+|[\s:,${"\\-"}–—]+$`, "g"), "")
    // "16:09 is Acid Masters - Voodoo Acid" and a trailing aside such as "(More accurate ID?)" are the
    // commenter talking, not part of the name.
    // "Pot Of Gold discogs: http…": the link is gone by now, its label is left behind.
    .replace(/\s*\bdiscogs\b:?\s*$/i, "")
    .replace(/^is\s+/i, "")
    .replace(/\s*\([^()]*\?\)\s*$/, "")
    .trim();

function split(text: string, prose = false): { artist: string; title: string; known: boolean; quoted?: boolean } | null {
  // The Grid "Flotation (progressive mix)"   Ave Maria 'No Sex Until Marriage' NYC Mix
  // Whatever follows the closing quote is the commenter talking.
  const q = text.match(/^\s*([^"“”]{2,60}?)\s+["“]([^"“”]{2,90})["”]/) ?? text.match(/^\s*([^'‘’"“”]{2,60}?)\s+['‘]([^'‘’]{3,90})['’](?=[\s.,!]|$)/);
  if (q && !/^[\s?]*$/.test(q[1]) && !new RegExp(String.raw`\s${DASH}\s`).test(q[1])) {
    const artist = clean(q[1]).replace(/[’']s$/, "");
    // "I 1st heard that "Original Style" from…" is someone talking, not an artist.
    if (artist && artist.split(" ").length <= 5 && !/^(?:i|it|this|that|he|she|they|we|the track|the song)\b/i.test(artist) && !CHATTER.test(artist)) return { artist, title: clean(q[2]), known: true, quoted: true };
  }
  const t = clean(text);
  if (t.length > 140) return null; // a sentence, not a track name
  if (!t || /^\?+/.test(t)) return { artist: "", title: clean(t.replace(/^\?+/, "")).replace(/^['‘’]|['‘’]$/g, ""), known: false };
  const m = t.match(new RegExp(String.raw`^(.+?)\s*${DASH}\s+(.+)$`));
  if (m) return { artist: clean(m[1]), title: clean(m[2]), known: true };
  // "Shoot by Way Out West": only in a sentence, where a bare title is not otherwise accepted.
  const by = prose ? t.match(/^(.{2,70}?)\s+by\s+(.{2,60}?)(?:\s+on\s+.+)?$/i) : null;
  if (by) return { artist: clean(by[2]), title: clean(by[1]), known: true, quoted: true };
  return { artist: "", title: t, known: true };
}

export function parseComment(content: string, author: string, date: string, titles: string[] = []): Sighting[] {
  const out: Sighting[] = [];
  let side = 0;
  let sideGiven = false;
  // `loose` lines are prose with a time in them, so they only count when they clearly name a record.
  // `listed` lines sit in a tracklist: a name with an artist is taken as written, and a bare one must not read
  // like a remark ("sounds very nice, never heard that before.").
  const push = (s: number, start: number, text: string, end?: number, loose = false, listed = false) => {
    if (!Number.isFinite(start)) return;
    // "1:23:25 - ??????" or "12:10 - unknown": someone marking a track nobody has ID'd yet.
    if (/^(?:\?+|unknown|unidentified|(?:track\s*)?id\s*\?*)$/i.test(clean(text))) {
      out.push({ side: s, start, end, artist: "", title: "", known: false, author, date });
      return;
    }
    const found = split(text, loose);
    if (!found) return;
    const { quoted, ...parts } = found;
    // Chatter after a quoted title was already cut off, so only the name itself is checked.
    if (loose && (!parts.known || !parts.artist || CHATTER.test(quoted ? `${parts.artist} ${parts.title}` : text))) return;
    if (listed && !parts.artist && (CHATTER.test(text) || parts.title.length > 60 || /[,.]\s|\.$/.test(parts.title))) return;
    out.push({ side: s, start, end, ...parts, author, date });
  };
  const lines = plain(content).split(/\r?\n/);
  // Three or more lines that open with a time make a tracklist. Its lines are taken at their word, where a
  // lone line with a time in it has to look like a record before it counts: "Call It What You Want!" is a
  // title in a list and would be a question anywhere else.
  const list = lines.filter((l) => new RegExp(String.raw`^\s*\[?${TIME}\b`).test(l)).length >= 3;
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    // "+ [11:56] Tangerine Dream - Love On A Real Train": layered over the track before it.
    const layer = /^\+\s*\[?\d/.test(line);
    if (layer) line = line.replace(/^\+\s*/, "");
    const before = out.length;

    // A heading on its own switches side for the list that follows.
    const heading = headingSide(line, titles);
    if (heading !== null) {
      side = heading;
      sideGiven = true;
      continue;
    }

    let m: RegExpMatchArray | null;
    // The side is known if this line names it, or a heading above it did.
    const sideHere = whichSide(line, titles);
    const unsure = sideHere === null && !sideGiven ? true : undefined;
    // "The track playing from [10:20] - [16:37] is Artist - Title"
    if ((m = line.match(new RegExp(String.raw`\[?(${TIME})\]?\s*(?:${DASH}|to)\s*\[?(${TIME})\]?\s+is\s+(.+)$`, "i")))) {
      push(side, seconds(m[1]), m[3], seconds(m[2]));
    }
    // "Side A - 5:30 - 13:20 - Artist - Title"
    else if ((m = line.match(new RegExp(String.raw`^${SIDE.source}\s*${DASH}?\s*(${TIME})\s*${DASH}\s*(${TIME})\s*${DASH}?\s*(.+)$`, "i")))) {
      push(sideIndex(m[1]), seconds(m[2]), m[4], seconds(m[3]));
    }
    // "Side B @ 26:30 - Artist - Title"
    // "(Side A) 19:00 Artist - Title"   "Side B, @ 13:15 Artist - Title"
    else if ((m = line.match(new RegExp(String.raw`^\(?${SIDE.source}\)?\s*[,@:]?\s*@?\s*(?:at\s*)?(${TIME})\s*${DASH}?\s*(.+)$`, "i")))) {
      push(sideIndex(m[1]), seconds(m[2]), m[3]);
    }
    // "(B) @21:35 is Artist"
    else if ((m = line.match(new RegExp(String.raw`^\(([ab])\)\s*@?\s*(${TIME})\s*(.+)$`, "i")))) {
      push(sideIndex(m[1]), seconds(m[2]), m[3]);
    }
    // "16:25 on side-B is Artist Title"
    else if ((m = line.match(new RegExp(String.raw`^(${TIME})\s+on\s+${SIDE.source}\s+is\s+(.+)$`, "i")))) {
      push(sideIndex(m[2]), seconds(m[1]), m[3]);
    }
    // "3. [05:15] – Artist – Title"   "3 - 5:15 - Artist - Title"   "19 - 47 - ?? hint"
    // A bare number only counts as a minute when a dash follows it. Otherwise "21. 2 Unlimited - Get Ready
    // for This" reads as track 21 at minute 2 by "Unlimited", and "1st Project" loses its 1.
    else if ((m = line.match(new RegExp(String.raw`^(?:\d{1,2}|-{2,3})\s*[.)${"\\-"}–]\s*\[?\s*(${TIME}|\d{1,2}(?=\s*\]?\s*${DASH}\s))\s*(?:${DASH}\s*)?\]?\s*${DASH}?\s*(.*)$`)))) {
      push(side, seconds(m[1]), m[2]);
    }
    // "[05:15] Artist – Title"   "11:00 Artist - Title"
    // An optional track number may come first, including one squeezed in later: "1.5 [00:00] Artist – Title".
    else if ((m = line.match(new RegExp(String.raw`^(?:\d{1,2}(?:\.\d)?\s+)?\[(${TIME})\]\s*${DASH}?\s*(.+)$`)))) {
      push(side, seconds(m[1]), m[2]);
    } else if ((m = line.match(new RegExp(String.raw`^@?\s*(${TIME})\s*(?:${DASH}|=)?\s*(?:on\s+[\w'’.]+(?:\s+side)?\s+)?(?:is\s*:?\s*)?(.+)$`, "i")))) {
      push(sideHere ?? side, seconds(m[1]), m[2], undefined, !list, list);
    }
    // "13. ??? (26:20 – 28:20)"
    else if ((m = line.match(new RegExp(String.raw`^\d{1,2}\s*[.)]\s*(.+?)\s*\((${TIME})\s*${DASH}\s*(\d{1,2}\s?:\d{2})\)\s*$`)))) {
      push(side, seconds(m[2]), m[1], seconds(m[3].replace(/\s/g, "")));
    }
    // "The song at 28:25 is Artist - Title."   "Then at the 17:30 mark is: Artist "Title"."
    else if ((m = line.match(new RegExp(String.raw`(?:\bat|@)\s*(?:about|around|approx\.?)?\s*(?:the\s+)?@?\s*(${TIME})(?:\s*(?:minute\s+)?mark)?\b[^.?!]{0,40}?\bis\s*:?\s*(?:called\s+|by\s+)?(.{3,})$`, "i")))) {
      // Only the first sentence is the name.
      const name = m[2].split(/(?<=[)\w"”'’])[.!]\s+(?=[A-Z@])/)[0].replace(/[.!:]+$/, "");
      push(sideHere ?? side, seconds(m[1]), name, undefined, true);
      if (unsure) for (let i = before; i < out.length; i++) out[i].unsure = true;
    }
    // "Artist - Title at 30:24"
    else if ((m = line.match(new RegExp(String.raw`^(.{3,90}?)\s+(?:at|@)\s+(${TIME})\b`, "i")))) {
      const s = line.match(SIDE);
      push(s ? sideIndex(s[1]) : side, seconds(m[2]), m[1], undefined, true);
    }
    // "Anyone know the track @40:05?"   "What is the track from 1:00-4:43"   Nothing above found a name in
    // this line, and it is asking for one: the time marks a track nobody has ID'd.
    if (out.length === before && ASK.test(line) && !NOT_TAPE.test(line) && (m = line.match(new RegExp(String.raw`(${TIME})(?:\s*(?:${DASH}|to|thru|through|until|till)\s*(?:around\s+|about\s+)?(${TIME}))?`, "i")))) {
      const end = m[2] ? seconds(m[2]) : undefined;
      out.push({ side: sideHere ?? side, start: seconds(m[1]), end: end && end > seconds(m[1]) ? end : undefined, artist: "", title: "", known: false, unsure, author, date });
    }
    if (layer) for (let i = before; i < out.length; i++) out[i].layer = true;
  }
  return out;
}

/** Another thing someone said about the same moment: a rival ID, or a hint about an unnamed track. */
export type Opinion = { artist: string; title: string; known: boolean; author: string; date: string };
export type Proposal = Sighting & { end: number; voices: number; also: Opinion[]; /** The end is a guess: the last thing anyone timed on this side. */ open?: boolean };

const words = (s: Sighting) => new Set(`${s.artist} ${s.title}`.toLowerCase().replace(/\([^)]*\)/g, "").match(/[a-z0-9]{3,}/g) ?? []);
function sameTrack(a: Sighting, b: Sighting) {
  const wa = words(a);
  const wb = words(b);
  const small = wa.size <= wb.size ? wa : wb;
  const big = small === wa ? wb : wa;
  if (small.size < 2) return false;
  // "Brazllia" and "Brazillia" are the same word to a person.
  const near = (w: string) => big.has(w) || (w.length >= 5 && [...big].some((o) => Math.abs(o.length - w.length) <= 1 && o.slice(0, 3) === w.slice(0, 3) && o.slice(-2) === w.slice(-2)));
  let hit = 0;
  small.forEach((w) => near(w) && hit++);
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
      // A layered record runs to whatever starts next; the record under it runs on to the next one that isn't a layer.
      const isLayer = (grp?: Sighting[]) => Boolean(grp?.length && grp.every((x) => x.layer));
      let j = i + 1;
      if (!isLayer(g)) while (isLayer(groups[j])) j++;
      const next = groups[j]?.[0].start ?? Math.min(length, best.start + 240);
      const end = best.end && best.end > best.start ? Math.min(best.end, length) : next;
      // "Reach Up To Mars at 30:24" a minute into a track already named that is the same track, not a new one.
      const prev = out[out.length - 1];
      if (prev && prev.side === side && best.known && sameTrack(prev, best)) {
        prev.voices = new Set([prev.author, ...g.map((s) => s.author)]).size + Math.max(0, prev.voices - 1);
        prev.end = Math.max(prev.end, end);
        return;
      }
      // Keep what else was said here: IDs that name a different record, and hints about one nobody has named.
      const also: Opinion[] = [];
      for (const s of [...g].sort((a, b) => b.date.localeCompare(a.date))) {
        if (s === best || !(s.artist || s.title)) continue;
        if (s.known && !s.artist) continue; // a bare phrase is more likely talk than a rival ID
        if (s.known ? sameTrack(best, s) : best.known) continue;
        if (!s.known && s.title === best.title) continue;
        if (also.some((o) => o.known === s.known && (s.known ? sameTrack(o as Sighting, s) : o.title === s.title))) continue;
        also.push({ artist: s.artist, title: s.title, known: s.known, author: s.author, date: s.date });
      }
      const open = !(best.end && best.end > best.start) && !groups[j];
      if (end - best.start >= 5) out.push({ ...best, start: g[0].start, end, voices: new Set(g.map((s) => s.author)).size, also, open: open || undefined });
    });
  });
  return out;
}

// ── Running orders: tracklists people posted in order but without times ──

export type Listed = { side: number; n: number; artist: string; title: string; known: boolean; author: string; date: string };

/** Numbered lines with a name and no time, e.g. "6. Moby - Go" under a "Side 1" heading. */
export function parseListing(content: string, author: string, date: string, titles: string[] = []): Listed[] {
  const out: Listed[] = [];
  let side = 0;
  for (const raw of plain(content).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^\d/.test(line) ? null : headingSide(line, titles);
    if (heading !== null) {
      side = heading;
      continue;
    }
    if (new RegExp(TIME).test(line)) continue; // timed lines are sightings, handled above
    const m = line.match(/^(\d{1,2})\s*[.)]\s+(.+)$/);
    if (!m) continue;
    const parts = split(m[2]);
    if (!parts || (parts.known && !parts.artist)) continue;
    out.push({ side, n: Number(m[1]), ...parts, author, date });
  }
  return out;
}

/** The fullest, newest running order for each side. */
export function runningOrders(listed: Listed[], sides: number): Listed[][] {
  return Array.from({ length: sides }, (_, side) => {
    // One list per run of rising numbers. Someone who posts a corrected list the same day starts again at 1,
    // and that is a second list, not more of the first.
    const lists: Listed[][] = [];
    for (const l of listed.filter((x) => x.side === side)) {
      const run = lists[lists.length - 1];
      const last = run?.[run.length - 1];
      if (run && last.author === l.author && last.date === l.date && l.n > last.n) run.push(l);
      else lists.push([l]);
    }
    const best = lists.filter((l) => l.length >= 3).sort((a, b) => b.length - a.length || b[0].date.localeCompare(a[0].date))[0];
    return best ? [...best].sort((a, b) => a.n - b.n) : [];
  });
}

/** True when a marked track already carries this listed name. */
export const isSameRecord = (a: { artist: string; title: string }, b: { artist: string; title: string }) =>
  sameTrack({ ...a, known: true } as Sighting, { ...b, known: true } as Sighting);

