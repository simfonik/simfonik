"use client";

// What sits under the timeline: the tracks still to ID as a list, how to send IDs in, and three lists that
// stay folded until asked for (the names without times, what the comments said, what this visitor changed).
import { useState } from "react";
import { announce } from "@ui-sdk/core";
import Link from "next/link";
import type { HistoryEntry } from "@ui-sdk/react/history";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import type { Listed, Proposal } from "./parse";
import { describe, madeBy, steps } from "./changes";
import { clock, cueLabel, type Cue } from "./tracklist-primitive";

/** The job, as a list: every track nobody has ID'd. Easier to hit than a narrow block on the timeline. */
export function StillUnknown({
  tracks,
  part,
  elsewhere,
  onHear,
  onId,
}: {
  /** The unknown tracks on what the timeline is showing. */
  tracks: Cue[];
  /** Where one part shows at a time, which one: the list is that part's, so it matches the timeline above it. */
  part: string | null;
  /** The unknown tracks on the other parts, for when this one has none. */
  elsewhere: { count: number; parts: string[] };
  onHear: (track: Cue) => void;
  onId: (id: string) => void;
}) {
  return (
    <div className="mt-8">
      {/* Where one part shows at a time, the list is that part's, so it matches the timeline above it. */}
      <h2 className="font-display text-2xl leading-none text-[var(--text)]">
        Still unknown{part && <span className="text-[var(--muted)]"> on {part}</span>}
      </h2>
      {tracks.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Nothing is marked as unknown on this part. {elsewhere.count} still unknown on {elsewhere.parts.join(", ")}.
        </p>
      )}
      <ul className="ts-list ts-unknowns mt-3" hidden={tracks.length === 0}>
        {tracks
          .map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onHear(c)} className="ts-list-row" aria-label={`Hear side ${c.track} from ${clock(c.start)}${c.title ? `. Clue: ${c.title}` : ""}`}>
                <span className="flex-none font-mono text-xs tabular-nums text-[var(--muted)]">
                  {c.track} {clock(c.start)}
                </span>
                <span className="min-w-0 flex-1 truncate" title={c.title || undefined}>{c.title ? `Clue: “${c.title}”` : "No clues yet"}</span>
                <span className="flex-none text-xs text-[var(--muted)]">Hear it</span>
              </button>
              <button type="button" onClick={() => onId(c.id)} className="ts-chip flex-none" aria-label={`ID the track at ${clock(c.start)}, side ${c.track}`}>
                ID it
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Copying this visitor's IDs so they can be posted as a comment on the tape's page. */
export function SendItIn({ tapeId, sides, cues }: { tapeId: string; sides: string[]; cues: Cue[] }) {
  // Only what this visitor ID'd goes in the comment. Pasting everyone's IDs would re-credit the whole tape to them.
  const mine = cues.filter((c) => c.known && !c.by);
  const asComment = () =>
    sides
      .map((side) => {
        const rows = mine.filter((c) => c.track === side).sort((a, b) => a.start - b.start);
        return rows.length ? [`Side ${side}`, ...rows.map((c) => `[${clock(c.start)}] ${[c.artist, c.title].filter(Boolean).join(" - ")}`)].join("\n") : "";
      })
      .filter(Boolean)
      .join("\n\n");
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asComment());
      setCopied("yes");
      announce("Copied");
      setTimeout(() => setCopied("no"), 1500);
    } catch {
      setCopied("failed"); // show the text so it can be copied by hand
    }
  };
  return (
    <div className="min-w-0">
      <h2 className="font-display text-2xl leading-none text-[var(--text)]">Send it in</h2>
      <p className="mt-2 max-w-[52ch] text-[15px] text-[var(--muted)] [text-wrap:pretty]">
        What you ID here is saved on this device. To add it to the archive, copy your IDs and post them as a comment on the tape’s page. The other IDs on this timeline came from comments there.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={copy} disabled={!mine.length} className="ts-btn min-w-[12.5rem]">
          {copied === "yes" ? "Copied ✓" : mine.length ? `Copy my IDs (${mine.length})` : "Copy my IDs"}
        </button>
        <Link href={`/tapes/${tapeId}`} className="ts-link">
          Open the tape page
        </Link>
      </div>
      {!mine.length && <p className="mt-2 text-sm text-[var(--muted)]">Nothing to copy yet. ID a track and it will appear here.</p>}
      {copied === "failed" && (
        <label className="mt-3 block">
          <span className="ts-label">Your browser wouldn’t copy it. Select this and copy it yourself:</span>
          <textarea readOnly value={asComment()} rows={Math.min(8, mine.length + 2)} onFocus={(e) => e.currentTarget.select()} className="ts-input h-auto py-2 font-mono text-sm" />
        </label>
      )}
    </div>
  );
}

/** The names in order, the site's or the comments': when each plays if it is on the timeline, and which still need a time. */
export function NamesFold({
  orders,
  placed,
  sides,
  fromSite,
  onHear,
}: {
  orders: Listed[][];
  /** For each side, the track on the timeline that carries each listed name. */
  placed: Map<Listed, Cue>[];
  sides: string[];
  /** The list is the site's own tracklist, not one from the comments. */
  fromSite: boolean;
  onHear: (side: number, time: number) => void;
}) {
  const total = orders.reduce((n, order) => n + order.filter((l) => l.known).length, 0);
  const waiting = orders.reduce((n, order, side) => n + order.filter((l) => l.known && !placed[side].has(l)).length, 0);
  if (!total) return null;
  return (
    <Collapsible className="ts-fold" defaultOpen={waiting === total}>
      <CollapsibleTrigger className="ts-fold-trigger">
        <span>{fromSite ? "The tape’s tracklist" : "Named in the comments, without times"}</span>
        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">{waiting} without a time</span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="ts-fold-panel">
        <ol className="ts-list ts-names">
          {orders.flatMap((order, side) =>
            order
              .filter((l) => l.known)
              .map((l) => {
                // A name is on the timeline once a track there carries it: show when it plays, and go
                // there on a click. A name with no time yet is the work still to do.
                const at = placed[side].get(l);
                return (
                  <li key={`${side}-${l.n}`} data-placed={at ? "" : undefined}>
                    <span className="flex-none font-mono text-xs tabular-nums text-[var(--muted)]">
                      {sides[side]} {l.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      {l.artist} — {l.title}
                    </span>
                    {at ? (
                      <button type="button" onClick={() => onHear(side, at.start)} className="ts-inline-link flex-none font-mono text-xs tabular-nums" aria-label={`Hear it at ${clock(at.start)}`}>
                        {clock(at.start)}
                      </button>
                    ) : (
                      <span className="flex-none text-xs text-[var(--muted)]">no time yet</span>
                    )}
                  </li>
                );
              }),
          )}
        </ol>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** Every timed ID the comments gave, with who gave it and when. */
export function CommentsFold({ proposals, sides, onHear }: { proposals: Proposal[]; sides: string[]; onHear: (side: number, time: number) => void }) {
  return (
    <Collapsible className="ts-fold">
      <CollapsibleTrigger className="ts-fold-trigger">
        <span>IDs from the comments</span>
        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">{proposals.length}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="ts-fold-panel">
        {proposals.length ? (
          <ul className="ts-list">
            {proposals.map((p) => (
              <li key={`${p.side}-${p.start}`}>
                <button type="button" onClick={() => onHear(p.side, p.start)} className="ts-list-row" aria-label={`Hear side ${sides[p.side]} at ${clock(p.start)}: ${cueLabel(p)}`}>
                  <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
                    {sides[p.side]} {clock(p.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={cueLabel(p)}>{cueLabel(p)}</span>
                  <span className="flex-none text-xs text-[var(--muted)]">
                    {p.author}, {p.date.slice(0, 4)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-[var(--muted)]">Nobody has posted a timed ID in this tape’s comments yet.</p>
        )}
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** This visitor's changes, newest first. It is the undo stack, read out. */
export function ChangesFold({ entries, floor, position }: { entries: HistoryEntry[]; /** How many entries were the page's own setting up, not the visitor's. */ floor: number; position: number }) {
  const made = steps(entries).filter((s) => s.end > floor);
  return (
    <Collapsible className="ts-fold">
      <CollapsibleTrigger className="ts-fold-trigger">
        <span>What you’ve changed</span>
        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">{made.length}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="ts-fold-panel">
        {made.length ? (
          <ol className="ts-list">
            {made.reverse().map(({ entry, end }) => (
              <li key={entry.id} className="ts-history-row" data-undone={end > position || entry.reverted ? "" : undefined}>
                <span className="ts-source">{madeBy(entry)}</span>
                <span className="min-w-0 flex-1">
                  {describe(entry)}
                  {end > position || entry.reverted ? " (undone)" : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-3 text-sm text-[var(--muted)]">Nothing yet.</p>
        )}
      </CollapsiblePanel>
    </Collapsible>
  );
}
