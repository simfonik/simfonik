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
