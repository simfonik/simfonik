// Names in order without times: the site's own tracklist, or a list someone kept in the comments. These
// functions work out which of those names are already on the timeline, and which could belong to a track
// nobody has named. No React here.
import { isSameRecord, runningOrders, type Listed } from "./parse";
import type { Cue } from "./tracklist-primitive";

/** Each side's names in order: the site's own tracklist where it has one, else the comments' running order. */
export function ordersFor(listed: Listed[], official: Listed[][], sideCount: number): Listed[][] {
  const fromComments = runningOrders(listed, sideCount);
  return Array.from({ length: sideCount }, (_, i) => (official[i]?.length ? official[i] : (fromComments[i] ?? [])));
}

/**
 * Which track on a side's timeline carries each listed name. A record played twice is listed twice, and the
 * first listing is the earlier track: each track answers for one line of the list.
 */
export function placeNames(order: Listed[], onSide: Cue[]): Map<Listed, Cue> {
  const named = onSide.filter((c) => c.known).sort((a, b) => a.start - b.start);
  const taken = new Set<string>();
  const at = new Map<Listed, Cue>();
  for (const l of order) {
    const cue = l.known ? named.find((c) => !taken.has(c.id) && isSameRecord(c, l)) : undefined;
    if (!cue) continue;
    taken.add(cue.id);
    at.set(l, cue);
  }
  return at;
}

/**
 * For a track nobody has named, the listed names that could be it, three at most, in list order.
 *
 * A name with no time still has a place: after the last line before it whose time is known, and before the
 * next one. If any names have a place that takes in this track, those are the answer. If none do, the list
 * and the timeline disagree somewhere, and the names nearest this track in the order are offered instead.
 * A track the list itself marks unknown at this spot gets none: its keeper has every other line down as some
 * other track.
 */
export function suggestNames(subject: Cue, order: Listed[], at: Map<Listed, Cue>, onSide: Cue[]): Listed[] {
  if (subject.known) return [];
  if (order.some((l) => !l.known && l.at !== undefined && Math.abs(l.at - subject.start) <= 20)) return [];
  const when = (l: Listed) => at.get(l)?.start ?? l.at;
  const before = onSide.filter((c) => c.start < subject.start).length;
  const ranked = order
    .filter((l) => l.known && !at.has(l))
    .map((l) => {
      const i = order.indexOf(l);
      const lo = order.slice(0, i).map(when).findLast((t) => t !== undefined) ?? -Infinity;
      const hi = order.slice(i + 1).map(when).find((t) => t !== undefined) ?? Infinity;
      return { l, out: subject.start < lo ? lo - subject.start : subject.start > hi ? subject.start - hi : 0, far: Math.abs(l.n - 1 - before) };
    })
    .sort((a, b) => a.out - b.out || a.far - b.far);
  const fitting = ranked.filter((x) => x.out === 0);
  return (fitting.length ? fitting : ranked)
    .slice(0, 3)
    .map((x) => x.l)
    .sort((a, b) => a.n - b.n);
}
