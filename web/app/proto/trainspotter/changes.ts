// "What you've changed": who made each change in the undo history, and what it was, in plain words.
import type { HistoryEntry } from "@ui-sdk/react/history";
import { REPLACED, clock, cueLabel, type Cue } from "./tracklist-primitive";

/**
 * Who made a change. The page puts the comments' tracklist in place through the agent bridge, as a whole
 * (`setValue`), which nothing else may do: a browser's assistant is refused it. So a whole-list write by an
 * agent is the comments', and any other change by an agent is an assistant's.
 */
export const madeBy = (e: HistoryEntry) => (e.source !== "agent" ? "You" : e.reason === REPLACED ? "Comments" : "Assistant");

/** A plain-language line for one history entry, worked out from what changed in the list. */
export function describe(e: HistoryEntry): string {
  const before = (Array.isArray(e.previous) ? e.previous : []) as Cue[];
  const after = (Array.isArray(e.value) ? e.value : []) as Cue[];
  const added = after.filter((c) => !before.some((b) => b.id === c.id));
  const removed = before.filter((b) => !after.some((c) => c.id === b.id));
  if (madeBy(e) === "Comments") return added.length ? `Added ${added.length} ${added.length === 1 ? "track" : "tracks"} from the comments` : "Went back to the IDs from the comments";
  if (added.length === 1 && removed.length <= 1) return `Marked a new track at ${clock(added[0].start)}, side ${added[0].track}`;
  if (removed.length === 1 && !added.length) return `Removed ${cueLabel(removed[0])}`;
  if (!added.length && !removed.length) {
    const changed = after.find((c) => {
      const b = before.find((x) => x.id === c.id);
      return b && (b.start !== c.start || b.end !== c.end || b.track !== c.track || b.artist !== c.artist || b.title !== c.title);
    });
    const b = changed && before.find((x) => x.id === changed.id);
    if (changed && b) {
      if (b.artist !== changed.artist || b.title !== changed.title) return changed.known ? `ID’d the track at ${clock(changed.start)}: ${cueLabel(changed)}` : `Set the track at ${clock(changed.start)} back to unknown`;
      return `Moved ${cueLabel(changed)} to ${clock(changed.start)}–${clock(changed.end)}`;
    }
  }
  return `Changed the tracklist (${after.length} ${after.length === 1 ? "track" : "tracks"})`;
}

const sameBut = (a: Cue, b: Cue) => a.track === b.track && a.artist === b.artist && a.title === b.title && a.known === b.known;

/** The one track an entry moved or trimmed by a second with the ⌥ arrow keys, changing nothing else. */
function nudged(e: HistoryEntry): string | null {
  if (e.source === "agent" || e.reason !== "imperative") return null; // a drag reports "drag", and stays a step of its own
  const before = (Array.isArray(e.previous) ? e.previous : []) as Cue[];
  const after = (Array.isArray(e.value) ? e.value : []) as Cue[];
  if (before.length !== after.length) return null;
  let id: string | null = null;
  for (const c of after) {
    const b = before.find((x) => x.id === c.id);
    if (!b || !sameBut(b, c)) return null;
    if (b.start === c.start && b.end === c.end) continue;
    if (id) return null;
    id = c.id;
  }
  return id;
}

/** One undo step: usually one entry, or a run of them read as one. `end` is the history position after it. */
export type Step = { entry: HistoryEntry; end: number };

/**
 * The history as undo steps. The SDK's history can fold a run of changes to one control into one entry, but
 * the whole timeline is one control, so it would fold two separate drags of two tracks as well. The page keeps
 * every entry and folds only this: a run of ⌥ arrow presses on one track, so holding the key to move a track
 * thirty seconds is one undo, not thirty.
 */
export function steps(entries: readonly HistoryEntry[]): Step[] {
  const out: Step[] = [];
  let run: string | null = null;
  entries.forEach((e, i) => {
    const id = nudged(e);
    const last = out.at(-1);
    if (id && id === run && last) out[out.length - 1] = { entry: { ...e, id: last.entry.id, previous: last.entry.previous }, end: i + 1 };
    else out.push({ entry: e, end: i + 1 });
    run = id;
  });
  return out;
}

/** Where undo (`by` of -1) or redo (+1) lands from `position`: the nearest step boundary that way. */
export function stepFrom(entries: readonly HistoryEntry[], position: number, by: -1 | 1): number {
  const ends = [0, ...steps(entries).map((s) => s.end)];
  return by < 0 ? Math.max(0, ...ends.filter((n) => n < position)) : Math.min(entries.length, ...ends.filter((n) => n > position));
}
