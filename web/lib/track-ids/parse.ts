// Reads the timed track IDs that visitors have been leaving in comments since 2009 and reconciles them
// into one proposal per moment of tape. Pure functions, no I/O.
import { ONE_MOMENT } from './compose';

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
  /** No side was said on its line or above it, so it sits on the first side for want of anything better.
      Not used on a tape with more than two sides (see `trusted`). */
  sideless?: boolean;
  /** Placed by the site's own form (compose.ts), to the second. A time typed into a sentence is rougher. */
  exact?: boolean;
  /** Not a sighting but the taking away of one: whatever was said of this moment before it no longer stands. */
  gone?: boolean;
  /** Worked out, not stated: the first track in a list of a side, taken to start the side. Anything someone
      actually timed at that moment is believed over it. */
  weak?: boolean;
  author: string;
  date: string;
};

/**
 * What each side of a tape goes by: its title, or every name it has. On a set of several DJs' tapes a side is
 * known by who played it ("Tracklist for Barry Weaver"), whatever it is titled.
 */
export type SideNames = (string | string[])[];
/** The names of a tape's sides, as its data has them: each side's title and whoever is credited with it. */
export const sideNames = (sides: { title?: string; djs?: { name: string }[] }[]): SideNames => sides.map((side) => [side.title ?? "", ...(side.djs ?? []).map((dj) => dj.name)]);

const seconds = (t: string) => {
  const p = t.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
};

// "Side A", "side-b", "Part 2", and "Side.A" (a dot only when nothing follows it, so "that side. A friend" is not a side).
const SIDE = /\b(?:side|part)(?:[\s-]*|\.)(a|b|c|d|1|2|3|4|one|two|uno|dos)\b/i;
const sideIndex = (s: string) =>
  ({ a: 0, "1": 0, "1st": 0, first: 0, one: 0, uno: 0, b: 1, "2": 1, "2nd": 1, second: 1, two: 1, dos: 1, c: 2, "3": 2, "3rd": 2, third: 2, d: 3, "4": 3, "4th": 3, fourth: 3 })[s.toLowerCase()] ?? 0;
// "the second side", "1st side"
const SIDE_ORD = /\b(1st|2nd|3rd|4th|first|second|third|fourth|uno|dos)[\s-]+side\b/i;
const squash = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
// "Doc Martin's set" is about Doc Martin, and "Omar's side" is the Omar side.
const unowned = (s: string) => squash(s.replace(/[’']s\b/gi, ""));
// The name of a side as people write it: "Technology Has Its Subliminal Side" is "Technology Has Its Subliminal".
const stem = (s: string) => unowned(s).replace(/ side$/, "");
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
// What people write round a side's name when they head a list with it: "Tracklist for Barry Weaver", "Mark Lewis
// Tracklist", "Current tracklist for Scott Hardkiss:", "Doc Martin's set", "Barry Weaver IDs". The word for the
// list has to be there; the small words round it are only dropped along with it, so "For Love" is not the Love side.
const LIST = /\b(?:track ?list(?:ing)?|set ?list|track ids?|ids?|set|mix)\b/g;
const LIST_FILLER = /\b(?:current|updated|latest|complete|full|partial|preliminary|so far|for|of|the)\b/g;
/**
 * Which side a piece of text names by one of the side's own names: "on the Cookie side", "Planet Earth", "Side 1 -
 * Technology Has Its Subliminal", "Tracklist for Barry Weaver". The name wins over a letter or number beside it:
 * commenters number the sides in the order they played them, and "Side 1" is not always the tape's A. A bare name,
 * or a name with the words of a list round it, only counts as a heading (a line that is nothing else); inside a
 * sentence it must be followed or preceded by the word "side", so a DJ's name in a track credit is left alone.
 */
function sideNamed(text: string, names: SideNames, heading = false): number | null {
  const n = unowned(text);
  const bare = n.replace(/^(?:side \w+ |on )?(?:the )?/, "").replace(/ side$/, "");
  const listed = bare.replace(LIST, " ").replace(LIST_FILLER, " ").replace(/ +/g, " ").trim();
  const heads = heading && bare.search(LIST) >= 0;
  const found = new Set<number>();
  let best = 0;
  names.forEach((side, i) => {
    for (const name of [side].flat()) {
      const t = stem(name);
      if (t.length < 3 || /^side\b/.test(t)) continue;
      const hit =
        ` ${n} `.includes(` ${t} side `) ||
        ` ${n} `.includes(` side ${t} `) ||
        (heading && (alike(bare, t) || (bare.includes(" ") && t.startsWith(`${bare} `)) || (n.startsWith(`${t} `) && n.endsWith(" side")))) ||
        (heads && alike(listed, t));
      if (!hit) continue;
      if (t.length > best) found.clear();
      if (t.length >= best) {
        best = t.length;
        found.add(i);
      }
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
const whichSide = (line: string, titles: SideNames = []): number | null => {
  const named = sideNamed(line, titles);
  if (named !== null) return named;
  const m = line.match(SIDE) ?? line.match(SIDE_ALT) ?? line.match(SIDE_ORD);
  return m ? sideIndex(m[1]) : null;
};
// The shape of a record's name: something, a dash with a space after it, something.
const NAMED = new RegExp(String.raw`\S\s*${DASH}\s+\S`);
/** A line that is only a side: "Side B", "Side 1 - Technology Has Its Subliminal", "Planet Earth", "the second side". */
const headingSide = (line: string, titles: SideNames): number | null => {
  if (line.length >= 60 || new RegExp(TIME).test(line)) return null;
  const named = sideNamed(line, titles, true);
  if (named !== null) return named;
  const m = line.match(SIDE) ?? line.match(/^\W*(?:the\s+)?(1st|2nd|3rd|4th|first|second|third|fourth|uno|dos)[\s-]+side\W*$/i);
  if (!m) return null;
  // "Acid Junkies Part 1 - Sector 9" and "Dreams Of Avarice (Part2)" are records, not the start of a side.
  // "Part 2" is a heading only at the start of its line; "Side B" in a line shaped like a name ("DJ Trance -
  // Side A") only at the start or the end of it.
  const at = m.index ?? 0;
  const opens = !/[a-z0-9]/i.test(line.slice(0, at));
  const closes = !/[a-z0-9]/i.test(line.slice(at + m[0].length));
  if (/^part/i.test(m[0]) ? !opens : NAMED.test(line) && !opens && !closes) return null;
  return sideIndex(m[1]);
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
const clean = (s: string, whole = true) =>
  s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(?<!\b(?:7|10|12))"|[“”‎]|''/g, "") // quotes go; the inch mark in 12" stays
    .replace(/\s+/g, " ")
    .replace(new RegExp(String.raw`^[\s:,.${"\\-"}–—]+|[\s:,${"\\-"}–—]+$`, "g"), "")
    // "16:09 is Acid Masters - Voodoo Acid" and a trailing aside such as "(More accurate ID?)" are the
    // commenter talking, not part of the name.
    // "Pot Of Gold discogs: http…": the link is gone by now, its label is left behind.
    .replace(/\s*\bdiscogs\b:?\s*$/i, "")
    // Only off the front of the whole name. An artist or a title of its own may begin with it: "Is This Real".
    .replace(whole ? /^is\s+/i : /^$/, "")
    .replace(/\s*\([^()]*\?\)\s*$/, "")
    .trim();

/** What someone said about a track they couldn't name, without the question marks and brackets around it. */
const hint = (t: string) =>
  clean(t.replace(/^\?+/, ""))
    .replace(/^\(([^()]*)\)$/, "$1")
    .replace(/^['‘’]|['‘’]$/g, "")
    .trim();

function split(text: string, prose = false): { artist: string; title: string; known: boolean; quoted?: boolean } | null {
  // The Grid "Flotation (progressive mix)"   Ave Maria 'No Sex Until Marriage' NYC Mix
  // Whatever follows the closing quote is the commenter talking.
  const q = text.match(/^\s*([^"“”]{2,60}?)\s+["“]([^"“”]{2,90})["”]/) ?? text.match(/^\s*([^'‘’"“”]{2,60}?)\s+['‘]([^'‘’]{3,90})['’](?=[\s.,!]|$)/);
  if (q && !/^[\s?]*$/.test(q[1]) && !new RegExp(String.raw`\s${DASH}\s`).test(q[1])) {
    const artist = clean(q[1]).replace(/[’']s$/, "");
    // "I 1st heard that "Original Style" from…" is someone talking, not an artist.
    // 'Keep On Pumpin' (Acapella): a bracket naming the mix belongs to the title. "(Pork Recordings)" doesn't.
    const mix = text.slice((q.index ?? 0) + q[0].length).match(/^\s*(\([^()?]{0,30}\b(?:mix|remix|dub|version|edit|a+c+apella|instrumental|vocal|original)\b[^()?]{0,12}\))/i);
    if (artist && artist.split(" ").length <= 5 && !/^(?:i|it|this|that|he|she|they|we|the track|the song)\b/i.test(artist) && !CHATTER.test(artist))
      return { artist, title: clean(mix ? `${q[2]} ${mix[1]}` : q[2]), known: true, quoted: true };
  }
  const t = clean(text);
  if (t.length > 140) return null; // a sentence, not a track name
  // "30:15 ?? (ambient)" and "17:06 (ambient)": nobody has named it, and the remark is the clue.
  if (!t || /^\?+/.test(t) || /^\([^()]*\)$/.test(t)) return { artist: "", title: hint(t), known: false };
  const m = t.match(new RegExp(String.raw`^(.+?)\s*${DASH}\s+(.+)$`));
  if (m) return { artist: clean(m[1], false), title: clean(m[2], false), known: true };
  // "Shoot by Way Out West": only in a sentence, where a bare title is not otherwise accepted.
  const by = prose ? t.match(/^(.{2,70}?)\s+by\s+(.{2,60}?)(?:\s+on\s+.+)?$/i) : null;
  if (by) return { artist: clean(by[2]), title: clean(by[1]), known: true, quoted: true };
  return { artist: "", title: t, known: true };
}

// Where one sentence ends and the next begins, for a name that is followed by more talk. "Dr. Motte" is one name.
const SENTENCE = /(?<=[)\w"”'’])(?<!\b(?:Dr|Mr|Mrs|Ms|St|vs|feat|ft|Vol|No|Pt))[.!]\s+(?=[A-Z@])/;
const firstSentence = (s: string) => s.replace(/https?:\/\/\S+/g, "").split(SENTENCE)[0].replace(/[.!:\s]+$/, "");
// "The first track on Side A is…": said about a side, that is a time, 0:00.
const FIRST = /\b(?:first|1st|opening)\s+(?:track|song|tune|record|cut)\b([^.?!:]{0,40}?)(?:\bis\b\s*:?|:)\s*(.{3,})$/i;

/**
 * The timed tracks in one comment. `listing` says the comment is known to be a tracklist (see `digest`), so its
 * lines are taken at their word however few of them carry a time.
 */
export function parseComment(content: string, author: string, date: string, titles: SideNames = [], listing = false): Sighting[] {
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
  // "…the B side at 21:15 is! It's Signs of Chaos - Funky Frequencies. And 15:28 on Side B is Funky Junky -
  // Rushin": two statements on one line. Each sentence that carries a time is read on its own, with the
  // sentences after it that don't.
  const lines = plain(content)
    .split(/\r?\n/)
    .flatMap((l) => {
      if ((l.match(new RegExp(TIME, "g")) ?? []).length < 2 || new RegExp(String.raw`^\s*(?:\d{1,2}\s*[.)]\s*)?\[?${TIME}`).test(l)) return [{ text: l, of: l }];
      const parts: string[] = [];
      for (const piece of l.split(SENTENCE)) {
        if (parts.length && !new RegExp(TIME).test(piece)) parts[parts.length - 1] += `. ${piece}`;
        else parts.push(piece.replace(/^\s*(?:and|also|then|plus)\s+/i, ""));
      }
      // Each keeps the line it came from: a side named in the first sentence holds for the rest.
      return parts.map((text) => ({ text, of: l }));
    });
  // Three or more lines that open with a time make a tracklist. Its lines are taken at their word, where a
  // lone line with a time in it has to look like a record before it counts: "Call It What You Want!" is a
  // title in a list and would be a question anywhere else.
  const list = listing || lines.filter((l) => new RegExp(String.raw`^\s*\[?${TIME}\b`).test(l.text)).length >= 3;
  for (const { text: raw, of } of lines) {
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
    const sideHere = whichSide(line, titles) ?? (of === raw ? null : whichSide(of, titles));
    const unsure = sideHere === null && !sideGiven ? true : undefined;
    // "(B) @21:35" says its side with a letter that `whichSide` doesn't look for.
    let lettered = false;
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
      lettered = true;
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
      // "…at 21:15 is! It's Signs of Chaos - Funky Frequencies": the name starts after the commenter's "It's".
      const name = firstSentence(m[2].replace(/^[\s!?.]*(?:it['’]?s|that['’]?s)\s+/i, ""));
      push(sideHere ?? side, seconds(m[1]), name, undefined, true);
      if (unsure) for (let i = before; i < out.length; i++) out[i].unsure = true;
    }
    // "Artist - Title at 30:24"
    else if ((m = line.match(new RegExp(String.raw`^(.{3,90}?)\s+(?:at|@)\s+(${TIME})\b`, "i")))) {
      const s = line.match(SIDE);
      push(s ? sideIndex(s[1]) : side, seconds(m[2]), m[1], undefined, true);
    }
    // "The first track on Side A is "The Camonist" by 3 Phase": the start of a side is a time. Only when the
    // side is said (or the tape has one), and not "the first track after the intro".
    else if (!new RegExp(TIME).test(line) && (m = line.match(FIRST)) && !/\bafter\b/i.test(m[1]) && (sideHere !== null || titles.length === 1)) {
      push(sideHere ?? 0, 0, firstSentence(m[2].replace(/^(?:(?:indeed|actually|definitely|probably|certainly)\s+)?(?:(?:a\s+)?(?:re)?mix\s+of\s+)?/i, "")), undefined, true);
    }
    // "Anyone know the track @40:05?"   "What is the track from 1:00-4:43"   Nothing above found a name in
    // this line, and it is asking for one: the time marks a track nobody has ID'd.
    if (out.length === before && ASK.test(line) && !NOT_TAPE.test(line) && (m = line.match(new RegExp(String.raw`(${TIME})(?:\s*(?:${DASH}|to|thru|through|until|till)\s*(?:around\s+|about\s+)?(${TIME}))?`, "i")))) {
      const end = m[2] ? seconds(m[2]) : undefined;
      out.push({ side: sideHere ?? side, start: seconds(m[1]), end: end && end > seconds(m[1]) ? end : undefined, artist: "", title: "", known: false, unsure, author, date });
    }
    if (layer) for (let i = before; i < out.length; i++) out[i].layer = true;
    if (sideHere === null && !sideGiven && !lettered) for (let i = before; i < out.length; i++) out[i].sideless = true;
  }
  return out;
}

/**
 * The sightings a tape with this many sides can use. One read out of a sentence that didn't say which side is
 * believed only where there is one side. A list that never said its side is taken to open on the first side of
 * a tape with two (`splitWholeTape` then moves what runs past its end). With more than two there is no telling:
 * on a set of five DJs' tapes the first is the wrong guess four times in five, and a track shown on the wrong
 * recording is worse than a track not shown.
 */
export const trusted = (sightings: Sighting[], sides: number) => sightings.filter((s) => (!s.unsure || sides === 1) && (!s.sideless || sides <= 2));

/** Another thing someone said about the same moment: a rival ID, or a hint about an unnamed track. */
export type Opinion = { artist: string; title: string; known: boolean; author: string; date: string };
export type Proposal = Sighting & {
  end: number;
  voices: number;
  also: Opinion[];
  /** The end is a guess: the last thing anyone timed on this side. */
  open?: boolean;
  /**
   * The same record said again further on, with nothing else between: one play, which this proposal is.
   * The later sayings are kept, as the proposals they would otherwise have been, because they are plays of
   * their own again as soon as something comes between them and this, or this is taken away.
   */
  again?: { start: number; end: number; artist: string; title: string; author: string; date: string }[];
};

type Named = { artist: string; title: string };
const words = (s: Named) => new Set(`${s.artist} ${s.title}`.toLowerCase().replace(/\([^)]*\)/g, "").match(/[a-z0-9]{3,}/g) ?? []);
function sameTrack(a: Named, b: Named) {
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

/**
 * Some lists time a two-sided tape as one recording: the clock runs on through side B, whose tracks are then
 * at 47:04, 51:08 … 1:27:43. Those times mean nothing on a side that starts again at 0:00, so once the page
 * knows how long the sides are, such a list is split. What comes before side B's first track is side A's; the
 * rest is side B's, timed from that track.
 *
 * Where side B starts on the commenter's clock is read from their list, because their recording is rarely as
 * long as ours to the second (on two tapes it differs by more than a minute). A list of a tape's tracks has
 * an entry for the one that opens side B, so it is the entry nearest the end of our side A. Failing one
 * within two minutes of it, our side A's length stands in.
 *
 * A list is taken to be on the whole tape's clock only when at least two of its times are past the end of the
 * side they were read onto, they reach a quarter of the way into side B, and all of them fit on it. One time
 * past the end is a slip, and so are two just past it.
 */
export function splitWholeTape(sightings: Sighting[], lengths: number[]): Sighting[] {
  if (lengths.length !== 2 || !lengths.every(Number.isFinite)) return sightings;
  const [a, b] = lengths;
  const lists = new Map<string, Sighting[]>();
  for (const s of sightings) {
    const posted = `${s.author}\n${s.date}`;
    lists.set(posted, [...(lists.get(posted) ?? []), s]);
  }
  return [...lists.values()].flatMap((posted) => {
    // Only what the commenter timed: a track taken to open a side because it heads a list has no clock to be on.
    const list = posted.filter((s) => !s.weak);
    const past = list.filter((s) => s.start >= lengths[s.side]);
    if (past.length < 2) return posted;
    const opener = list.filter((s) => Math.abs(s.start - a) <= 120).sort((x, y) => Math.abs(x.start - a) - Math.abs(y.start - a))[0];
    const zero = opener?.start ?? a;
    const reach = Math.max(...past.map((s) => s.start)) - zero;
    if (past.some((s) => s.start < zero) || reach < b / 4 || reach >= b) return posted;
    // Read onto side B from top to bottom (nothing above the list said "side A"): its first part is side A's.
    const allOnB = list.every((s) => s.side === 1);
    return posted.map((s) => (s.weak ? s : s.start >= zero ? { ...s, side: 1, start: s.start - zero, end: s.end === undefined ? undefined : s.end - zero } : allOnB ? { ...s, side: 0 } : s));
  });
}

/** One proposal per moment: the newest identification wins, and an ID always beats a question mark. */
export function reconcile(read: Sighting[], lengths: number[]): Proposal[] {
  const sightings = splitWholeTape(read, lengths);
  const out: Proposal[] = [];
  lengths.forEach((length, side) => {
    const here = sightings.filter((s) => s.side === side && !s.gone && s.start < length).sort((a, b) => a.start - b.start || a.date.localeCompare(b.date));
    // Where a moment starts: the earliest time anyone actually gave for it.
    const shown = (g: Sighting[]) => (g.find((s) => !s.weak) ?? g[0]).start;
    // What people type is rough: said within 20 seconds, it is said of one moment.
    const groups: Sighting[][] = [];
    for (const s of here.filter((x) => !x.exact)) {
      const g = groups[groups.length - 1];
      if (g && s.start - g[0].start <= 20) g.push(s);
      else groups.push([s]);
    }
    // A time from the site's own form is exact. It is said of the moment that starts within ONE_MOMENT of
    // it, and is otherwise a moment of its own, whoever said what nearby: twelve seconds into a track, an
    // ID made with the form is the next track, not that one put right. (The tape page works on the same
    // rule before anything is posted: `withChanges` in side.ts.)
    for (const s of here.filter((x) => x.exact)) {
      const g = groups.find((group) => Math.abs(shown(group) - s.start) <= ONE_MOMENT);
      if (g) g.splice(0, g.length, ...[...g, s].sort((a, b) => a.start - b.start || a.date.localeCompare(b.date)));
      else groups.push([s]);
    }
    groups.sort((a, b) => a[0].start - b[0].start);
    // A mark taken away (see compose.ts) is taken from the moment that starts where it says, and takes with
    // it everything said of that moment before. What is said after stands: the track can be ID'd again.
    for (const gone of sightings.filter((s) => s.side === side && s.gone)) {
      const i = groups.findIndex((g) => Math.abs(shown(g) - gone.start) <= ONE_MOMENT);
      if (i < 0) continue;
      groups[i] = groups[i].filter((s) => s.date >= gone.date);
      if (groups[i].length === 0) groups.splice(i, 1);
    }
    groups.forEach((g, i) => {
      const known = g.filter((s) => s.known && (s.artist || s.title));
      const stated = known.filter((s) => !s.weak);
      const best = (stated.length ? stated : known.length ? known : g).reduce((a, b) => (b.date >= a.date ? b : a));
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
        if (end - best.start >= 5) prev.again = [...(prev.again ?? []), { start: shown(g), end, artist: best.artist, title: best.title, author: best.author, date: best.date }];
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
      if (end - best.start >= 5) out.push({ ...best, start: shown(g), end, voices: new Set(g.map((s) => s.author)).size, also, open: open || undefined });
    });
  });
  return out;
}

// Running orders: tracklists people posted in order but without times.

export type Listed = {
  side: number;
  n: number;
  artist: string;
  title: string;
  known: boolean;
  author: string;
  date: string;
  /** From a whole side written out in order (see `digest`), where `n` is the track's place on the side. */
  running?: boolean;
  /** When the list itself says this line plays, in seconds: written beside it, or in an earlier version. */
  at?: number;
};

/** Numbered lines with a name and no time, e.g. "6. Moby - Go" under a "Side 1" heading. */
function parseListing(content: string, author: string, date: string, titles: SideNames = []): Listed[] {
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
    // A side someone keeps written out in full is the order: the fullest such list, and of two as full, the newer.
    const kept = new Map<string, Listed[]>();
    for (const l of listed) if (l.running && l.side === side) kept.set(`${l.date} ${l.author}`, [...(kept.get(`${l.date} ${l.author}`) ?? []), l]);
    const fullest = [...kept.entries()].sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0]?.[1];
    // Someone who posts their list twice in a day has every number in it twice. The later saying of a line is
    // the one that stands: it is the same line, or that line put right.
    if (fullest) return [...new Map(fullest.map((l) => [l.n, l])).values()].sort((a, b) => a.n - b.n);
    // One list per run of rising numbers. Someone who posts a corrected list the same day starts again at 1,
    // and that is a second list, not more of the first.
    const lists: Listed[][] = [];
    for (const l of listed.filter((x) => x.side === side && !x.running)) {
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
export const isSameRecord = (a: Named, b: Named) => sameTrack(a, b);


// Running tracklists: a side written out in order, and written out again each time a track is ID'd.
//
// Some tapes have a keeper. They post each side as a list, a name where the track is known and a time with
// "??" where it isn't, and when someone IDs one they post the whole list again with that line changed:
//
//     7:48 ??                          THC - Nice Up the Land
//     S.E.T.I. - Twister       then    S.E.T.I. - Twister
//     10:18 ??                         10:18 ??
//
// Read one comment at a time, that is a pile of question marks that were answered long ago, and names with
// no times. Read as versions of one list: the newest version is what its keeper believes now, a name that
// replaced a timed "??" takes that time, and the list is the side's running order.

/** One line of such a list. `n` is its number: the one it was written with, or its place on the side. */
type Row = { side: number; n: number; /** The line as written. */ raw?: string; numbered?: boolean; start?: number; end?: number; artist: string; title: string; known: boolean; layer?: boolean; /** Not a track anyone named or timed: "(Voice mail montage)". It still has a place in the order. */ note?: boolean };
// A time as these lists write it, including ":58" for under a minute.
const ROW_TIME = String.raw`(?:\d{1,2}:\d{2}(?::\d{2})?|:\d{2})`;
const ABBREVIATION = /\b(?:Dr|Mr|Mrs|Ms|St|vs|feat|ft|Vol|No|Pt)\.\s/gi;
const NO_NAME = /^(?:unknown|unidentified|(?:track\s*)?id\s*\?*)$/i;

/** `expect` is the number this line should carry if the list is numbered, so "17 Dance 2 Trance - Atlantis"
    after a "16." is read as the seventeenth line with its dot left off. */
function rowOf(raw: string, expect?: number): (Omit<Row, "side" | "n"> & { n?: number }) | null {
  let line = raw.trim();
  if (NOT_TAPE.test(line)) return null; // "DECEMBER 18, 2013 12:23 AM" is when someone posted, not a place on the tape
  const layer = /^\+\s*\S/.test(line) || undefined;
  line = line.replace(/^\+\s*/, "");
  // "12. Name"   "12.Name"   "12) Name"   "12 - 1:55 - Name"
  const num =
    line.match(/^(\d{1,2})\s*[.)]\s*(?=[^\d\s])/) ??
    line.match(/^(\d{1,2})(?:\.\d)?\s*[.)]\s+/) ??
    line.match(new RegExp(String.raw`^(\d{1,2})\s*${DASH}\s*(?=\[?\s*\d{1,2}:\d{2})`)) ??
    // With spaces round both dashes, or "9-10-Boy - Revenge of the Gatorade" is track 9 at minute 10.
    line.match(new RegExp(String.raw`^(\d{1,2})\s+${DASH}\s+(?=\d{1,2}\s+${DASH}\s)`)) ??
    (expect === undefined ? null : line.match(new RegExp(String.raw`^(${expect})\s+(?=\S)`)));
  const n = num ? Number(num[1]) : undefined;
  if (num) line = line.slice(num[0].length);
  // "Side A - 5:30 - 13:20 - Artist - Title" is a sentence about a side; `parseComment` knows how to read it.
  if (/^\(?(?:side|part)\b/i.test(line)) return null;
  // "…helicopter buzz)  he uses the mid track breakdown as an intro": after the gap, the keeper is talking.
  line = line.replace(/(\))\s{2,}[a-z].*$/, "$1");
  let start: number | undefined;
  let end: number | undefined;
  // "1 - 00 - ???"   "19 - 47 - ?? hint": after a track number, a bare number before a dash is the minute.
  const minute = n === undefined ? null : line.match(new RegExp(String.raw`^(\d{1,2})\s+${DASH}\s+`));
  if (minute) {
    start = Number(minute[1]) * 60;
    line = line.slice(minute[0].length);
  }
  const t = minute ? null : line.match(new RegExp(String.raw`(?:(?:@|\bat)\s*(?:approx\.?|about|around)?\s*)?[([]?\s*(${ROW_TIME})\s*\]?(?:\s*(?:${DASH}|to)\s*\[?(${ROW_TIME})\]?)?\s*[)\]]?`, "i"));
  if (t) {
    start = seconds(t[1]);
    if (t[2] && seconds(t[2]) > start) end = seconds(t[2]);
    line = `${line.slice(0, t.index)} ${line.slice((t.index ?? 0) + t[0].length)}`;
  }
  const rest = clean(line, false).replace(/[\s.]+$/, "");
  // "7:48 ??"   "? 12:48"   "?"   "54:24 ?? I Need You"   "17:06 (ambient)"   "14. ??? (26:20 - 28:20)"
  if (/^\?/.test(rest) || (start !== undefined && (!rest || /^\([^()]*\)$/.test(rest) || NO_NAME.test(rest))) || (n !== undefined && !rest))
    return { n, start, end, layer, artist: "", title: NO_NAME.test(rest) ? "" : hint(rest), known: false };
  if (rest.length > 120) return null;
  // A dash with a space on both sides, else after it, else before it: "Synth-Problem – L.A. Factory" splits
  // at the second dash, "SIL -Windows" at its only one.
  const m =
    rest.match(new RegExp(String.raw`^(.+?)\s+${DASH}\s+(.+)$`)) ?? rest.match(new RegExp(String.raw`^(.+?)${DASH}\s+(.+)$`)) ?? rest.match(new RegExp(String.raw`^(.+?)\s+${DASH}(.+)$`));
  // "1:30 come together keep the faith hiphouse": a time and what the keeper could make out, no name.
  if (!m) return start !== undefined && rest.length <= 80 ? { n, start, end, layer, artist: "", title: hint(rest), known: false } : null;
  const artist = clean(m[1], false);
  const title = clean(m[2], false);
  // A sentence with a dash in it is not a record: "I hear MNO - …", "Last is Gypsy - …", "Nice one. That - …".
  // An initial is not the end of a sentence: "O. Walters", "L.A. Style", "K. Hand".
  if (!artist || !title || /^\d+$/.test(artist) || artist.split(" ").length > 8) return null;
  if (/[a-z]{3,}[.!?]\s+\S/i.test(artist.replace(ABBREVIATION, "")) || /^(?:i|it|this|that|he|she|they|we|last|first|next|then|also|and|but)\s/i.test(artist)) return null;
  return { n, start, end, layer, artist, title, known: true };
}

/**
 * The comment as a running tracklist, or null if it isn't one. It is one when it has at least five rows, at
 * least two of them names with no time (a list where every line has a time is read by `parseComment` alone,
 * as before), and next to nothing between its rows that isn't a row. `prose` is everything else in the
 * comment, for the things said around the list.
 *
 * Which side a row is on comes from the heading above it, and a list whose sides can't be told is not used:
 * on a tape with more than one side, a list with no headings could be either, and "Marques's side" alone
 * doesn't say which. Two labels this page doesn't know, on a tape with two sides ("Side X", then "Side E"),
 * are taken in the order the tape runs.
 */
function parseRunning(content: string, titles: SideNames = []): { rows: Row[]; headed: boolean; prose: string } | null {
  const lines = plain(content).split(/\r?\n/);
  const time = new RegExp(TIME);
  // A line that names a side: one this page can place, or one it can't ("Side X", "Marques's side").
  const sideOf = (line: string): number | "?" | null => {
    if (!line || line.length >= 60 || time.test(line)) return null;
    const letter = line.match(/^\W*([a-d])\W*$/i);
    if (letter) return sideIndex(letter[1]);
    const known = headingSide(line, titles);
    if (known !== null && (!rowOf(line) || /^\W*(?:side|part)\b/i.test(line) || sideNamed(line, titles, true) !== null)) return known;
    return !rowOf(line) && /\bside\b/i.test(line) && line.length < 40 && !/[.!?]\s+\S/.test(line) ? "?" : null;
  };
  const marks = lines.map((l) => sideOf(l.trim()));
  const placed = marks.filter((m): m is number => typeof m === "number");
  const labels = [...new Set(lines.filter((_, i) => marks[i] === "?").map((l) => squash(l)))];
  const inOrder = labels.length > 0 && placed.length === 0 && labels.length === titles.length;
  if (labels.length > 0 && !inOrder) return null;
  const headed = placed.length > 0 || inOrder;
  if (!headed && titles.length > 1) return null;

  const rows: Row[] = [];
  const prose: string[] = [];
  const at: number[] = [];
  const strays: number[] = [];
  const count: number[] = [];
  let side = 0;
  // With headings, what comes before the first is the commenter talking, unless the first heading is for a
  // later side: then the list simply opened on side A without saying so.
  let begun = !headed || (placed[0] ?? 0) > 0;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (marks[i] !== null) {
      side = marks[i] === "?" ? labels.indexOf(squash(line)) : (marks[i] as number);
      begun = true;
      if (marks[i] !== "?") prose.push(raw);
      return;
    }
    const last = rows[rows.length - 1];
    let row = begun ? rowOf(line, last?.numbered ? last.n + 1 : undefined) : null;
    // Something short between the rows that is no record and no time: "(Voice mail montage)", "Monty Python".
    // It keeps its place, so the tracks after it keep their numbers and the one after it is not the opener.
    const note = !row && begun && line.length <= 60 && !time.test(line) && !/[.!?:]\s+\S|[:!]$/.test(line);
    if (note) row = { artist: "", title: hint(clean(line)), known: false, note: true };
    if (!row) {
      prose.push(raw);
      strays.push(i);
      return;
    }
    // Its own number if it was written with one (some lists count straight on through side B), else its place.
    count[side] = row.n ?? (count[side] ?? 0) + 1;
    rows.push({ side, ...row, raw: line, n: count[side], numbered: row.n !== undefined || undefined });
    if (note) strays.push(i);
    else at.push(i);
  });
  const real = rows.filter((r) => !r.note);
  if (real.length < 5 || real.filter((r) => r.known && r.start === undefined).length < 2) return null;
  if (strays.filter((i) => i > at[0] && i < at[at.length - 1]).length > real.length * 0.2) return null;
  // Notes after the last real row are the commenter signing off.
  while (rows.length && rows[rows.length - 1].note) rows.pop();
  return { rows, headed, prose: prose.join("\n") };
}

const sameRow = (a: Row, b: Row) => sameTrack(a, b) || squash(`${a.artist} ${a.title}`) === squash(`${b.artist} ${b.title}`);

/**
 * Passes times from one version of a side to the next. Rows that are the same in both are the fixed points;
 * between two fixed points, if both versions have the same number of rows, they are the same tracks in the
 * same order, and a row that had a time before and has none now (a "??" that got its name) keeps it. If the
 * numbers differ, the keeper added or dropped a track there and nothing is assumed.
 */
function carry(older: Row[], newer: Row[]) {
  const same = (a: Row, b: Row) => (a.known && b.known ? sameRow(a, b) : !a.known && !b.known && a.start !== undefined && b.start !== undefined && Math.abs(a.start - b.start) <= 20);
  // Longest common run of rows, by the usual table.
  const table = Array.from({ length: older.length + 1 }, () => new Array<number>(newer.length + 1).fill(0));
  for (let i = older.length - 1; i >= 0; i--) for (let j = newer.length - 1; j >= 0; j--) table[i][j] = same(older[i], newer[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const give = (from: Row, to: Row) => {
    if (to.start === undefined && from.start !== undefined && to.known) to.start = from.start;
  };
  let i = 0;
  let j = 0;
  let gapI = 0;
  let gapJ = 0;
  const closeGap = () => {
    if (i - gapI === j - gapJ) for (let k = 0; k < i - gapI; k++) give(older[gapI + k], newer[gapJ + k]);
  };
  while (i < older.length && j < newer.length) {
    if (same(older[i], newer[j])) {
      closeGap();
      give(older[i], newer[j]);
      i++;
      j++;
      gapI = i;
      gapJ = j;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  i = older.length;
  j = newer.length;
  closeGap();
}

export type Said = { author: string; date: string; content: string };
// "Josh" and "Josh McClintock" are one keeper.
const sameAuthor = (a: string, b: string) => {
  const [x, y] = [squash(a), squash(b)];
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
};

/**
 * Everything the comments on a tape say about what plays when: timed tracks, and names in order without
 * times. Comments are read one by one, except a keeper's running tracklist (above): its older versions are
 * set aside, apart from what was said around them, and the newest stands for all of them.
 */
export function digest(comments: Said[], titles: SideNames = []): { sightings: Sighting[]; listed: Listed[] } {
  const read = comments.map((c) => ({ c, list: parseRunning(c.content, titles) }));
  // Oldest first; comments arrive in the order they were posted, which settles two on the same day.
  const lists = read.flatMap(({ c, list }) => (list ? [{ c, list }] : [])).sort((a, b) => a.c.date.localeCompare(b.c.date));
  const replaced = new Set<Said>();
  const heads = new Map<Said, Row[]>();
  for (let h = lists.length - 1; h >= 0; h--) {
    const head = lists[h];
    if (replaced.has(head.c)) continue;
    const rows = head.list.rows.map((r) => ({ ...r }));
    // Its earlier versions: the same keeper's lists that are mostly in this one. Walked oldest to newest so a
    // time passes down the whole line of them.
    const versions = lists.slice(0, h).filter((v) => {
      if (replaced.has(v.c) || !sameAuthor(v.c.author, head.c.author)) return false;
      const names = v.list.rows.filter((r) => r.known);
      return names.length > 0 && names.filter((r) => rows.some((x) => x.known && sameRow(x, r))).length >= Math.max(2, names.length * 0.5);
    });
    let prior: Row[] | null = null;
    for (const v of [...versions, { c: head.c, list: { ...head.list, rows } }]) {
      const now = v.c === head.c ? rows : v.list.rows.map((r) => ({ ...r }));
      if (prior) for (const side of new Set(now.map((r) => r.side))) carry(prior.filter((r) => r.side === side), now.filter((r) => r.side === side));
      prior = now;
    }
    versions.forEach((v) => replaced.add(v.c));
    heads.set(head.c, rows);
  }

  const sightings: Sighting[] = [];
  const listed: Listed[] = [];
  const inferred: { s: Sighting; once: boolean }[] = [];
  // Where each comment's sightings begin in the list of them all.
  const begins: number[] = [];
  for (const { c, list } of read) {
    begins.push(sightings.length);
    const rows = heads.get(c);
    // A running list is read here, row by row, so that its sides are the ones its headings were found to
    // mean. What was said around it, in any version, is read as any comment is.
    if (list && (rows || replaced.has(c))) sightings.push(...parseComment(list.prose, c.author, c.date, titles));
    else {
      sightings.push(...parseComment(c.content, c.author, c.date, titles));
      listed.push(...parseListing(c.content, c.author, c.date, titles));
    }
    if (!rows || !list) continue;
    const own = list.rows;
    rows.forEach((r, k) => {
      listed.push({ side: r.side, n: r.n, artist: r.artist, title: r.title, known: r.known, author: c.author, date: c.date, running: true, at: r.start });
      const said = { side: r.side, artist: r.artist, title: r.title, known: r.known, author: c.author, date: c.date };
      // Written with its time: read as a timed line always has been (it knows more ways of writing one than
      // a row needs to), and put on the side this list's headings were found to mean.
      const written = own[k].start;
      if (written !== undefined) {
        // (An unnamed row is the exception: "0:55 ?? (ambient track)" keeps its clue as a row reads it.)
        const line = r.known ? parseComment(r.raw ?? "", c.author, c.date, titles, true) : [];
        sightings.push(...(line.length ? line.map((s) => ({ ...s, side: r.side, sideless: undefined, unsure: undefined })) : [{ ...said, start: written, end: r.end, layer: r.layer }]));
      }
      else if (!r.known) return;
      // A time handed down from an earlier version of the list: the keeper's own, but worked out from where
      // the line sits (see the end of this function for what it gives way to).
      else if (r.start !== undefined) inferred.push({ s: { ...said, start: r.start }, once: rows.filter((x) => x.side === r.side && x.known && sameRow(x, r)).length === 1 });
      // The first track listed on a side starts the side (a keeper writes "0:00 ??" when it opens on something
      // else). First means first: under a side heading, and numbered 1 or carrying on from the side before.
      else if (rows.findIndex((x) => x.side === r.side) === k && (list.headed || titles.length === 1) && (!r.numbered || r.n === 1 || (k > 0 && rows[k - 1].numbered && rows[k - 1].n === r.n - 1)))
        inferred.push({ s: { ...said, start: 0, weak: true }, once: true });
    });
  }
  // What each comment timed, in the order the comments were posted.
  const posts = begins.map((from, i) => sightings.slice(from, begins[i + 1]));
  // "23:38 is The Slippers - Tribal Hen", in reply to a keeper whose list has "23:38 ???" under Side 2: the
  // reply didn't say the side because the list had. A time with no side goes to the side where a keeper's
  // list, in any version, has that very time, if there is one such side.
  if (titles.length > 1) {
    const timed = lists.flatMap((l) => l.list.rows.flatMap((r) => (r.start === undefined ? [] : [{ side: r.side, start: r.start }])));
    for (const s of sightings) {
      if (!s.sideless) continue;
      const near = timed.filter((r) => Math.abs(r.start - s.start) <= 5);
      const best = Math.min(...near.map((r) => Math.abs(r.start - s.start)));
      const sides = new Set(near.filter((r) => Math.abs(r.start - s.start) === best).map((r) => r.side));
      if (sides.size === 1) {
        s.side = [...sides][0];
        s.sideless = undefined;
      }
    }
    // A list posted again with a line filled in is seldom headed again: "Nice work! I added one ID and cleaned
    // it up.", and then the list, by whoever tidied it. A list that says no side and has in it at least half
    // of what an earlier comment timed on a side (and three of those times or more, each to within five
    // seconds and none with a different record at it) is that list again, and sits where it sat. Oldest
    // first, so a third copy follows the second.
    const named = (x: Sighting) => x.known && Boolean(x.artist || x.title);
    posts.forEach((post, p) => {
      const loose = post.filter((x) => x.sideless);
      if (loose.length < 3) return;
      const again = (e: Sighting) => loose.some((x) => Math.abs(x.start - e.start) <= 5 && !(named(x) && named(e) && !sameTrack(x, e)));
      let most = 0;
      let where: number | null = null;
      for (const earlier of posts.slice(0, p)) {
        for (const side of new Set(earlier.filter((e) => !e.sideless).map((e) => e.side))) {
          const theirs = earlier.filter((e) => !e.sideless && e.side === side);
          const shared = theirs.filter(again).length;
          if (shared < 3 || shared < theirs.length / 2 || shared < most) continue;
          // As much of two different sides: it could be either, so it is neither.
          where = shared === most && where !== side ? null : side;
          most = shared;
        }
      }
      if (where === null) return;
      for (const x of loose) {
        x.side = where;
        x.sideless = undefined;
        x.unsure = undefined;
      }
    });
  }
  // A time worked out from an earlier version gives way to one somebody stated for the same record: a
  // keeper's "22:15 ??" and a reply's "21:15 is…" are one track, and where the two are far apart it is the
  // working-out that slipped. Unless the list has the record more than once: played three times on a side it
  // is three tracks, and then only a stated time close by is the same one.
  const stated = [...sightings];
  for (const { s, once } of inferred)
    if (s.weak || !stated.some((x) => x.side === s.side && x.known && sameTrack(x, s) && (once || Math.abs(x.start - s.start) <= 120))) sightings.push(s);
  return { sightings, listed };
}
