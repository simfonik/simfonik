"use client";

// Every change to the timeline, with who made it: the undo stack, and the two other hands on the tape.
// The page loads the comments' tracklist through the SDK's agent bridge, so the history records those writes
// as not the visitor's, and the same bridge is offered to an assistant built into the visitor's browser.
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createAgent, registerTools } from "@ui-sdk/react/agent";
import { createHistory, type HistoryEntry } from "@ui-sdk/react/history";
import type { Toaster } from "@ui-sdk/react/toast";
import { describe, madeBy, stepFrom } from "./changes";
import type { Cue } from "./tracklist-primitive";

const agent = typeof window === "undefined" ? null : createAgent();
const UNDO_TOAST = "undo"; // one undo toast at a time: a newer one replaces the older

export function useChanges({ toaster, saveFailed }: { toaster: Toaster<ReactNode>; /** The last save to this device didn't go through. */ saveFailed: RefObject<boolean> }) {
  /** The timeline's element: the history hears only what happens inside it. */
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState(0);
  // Undo stops at the listeners' tracklist the page opened with; it never empties the tape.
  const [floor, setFloor] = useState(0);
  const floorRef = useRef(0);
  /** True while the page itself is writing, so it can tell its own changes from a person's. */
  const writing = useRef(false);

  const undoToastAt = useRef<number | null>(null);
  /** A confirmation whose Undo belongs to the change just made, and to nothing else. */
  const confirmWithUndo = useCallback(
    (title: string, description?: string) => {
      // Wait a frame so the history has recorded the change this is about.
      requestAnimationFrame(() => {
        const h = historyRef.current;
        const at = h?.position() ?? 0;
        undoToastAt.current = at;
        toaster(title, {
          id: UNDO_TOAST,
          description: saveFailed.current ? "Couldn’t save on this device. It will be gone when you leave the page." : description,
          action: {
            label: "Undo",
            onAction: () => {
              if (h && h.position() === at && at > floorRef.current) void h.seek(at - 1);
            },
          },
        });
      });
    },
    [toaster, saveFailed],
  );

  useEffect(() => {
    if (!agent) return;
    // One step per action: two separate drags are two undos, not one.
    const history = createHistory(agent, { keys: ["value"], within: () => rootRef.current, coalesce: false });
    historyRef.current = history;
    let newest: string | undefined;
    const off = history.subscribe(() => {
      setEntries([...history.entries()]);
      setPosition(history.position());
      // A change the visitor didn't make with their own hands is said out loud, with a way back.
      const last = history.entries().at(-1);
      if (last && last.id !== newest && history.position() === history.entries().length) {
        newest = last.id;
        if (madeBy(last) === "Assistant") confirmWithUndo("Changed by your browser’s assistant", describe(last));
      }
      // An Undo offered for one change must not outlive it and undo something else.
      if (undoToastAt.current !== null && history.position() !== undoToastAt.current) {
        undoToastAt.current = null;
        toaster.dismiss(UNDO_TOAST);
      }
    });
    // Offer the timeline to an assistant built into the browser, where the browser supports WebMCP. It may mark
    // and ID tracks. Replacing the whole tracklist is the page's own way of loading the comments, and refused.
    const unregister = registerTools(agent, { allow: (step) => step.action !== "setValue" });
    return () => {
      off();
      unregister?.();
      history.destroy();
      toaster.dismiss();
    };
  }, [confirmWithUndo, toaster]);

  /** Undo (-1) or redo (+1), one step: see `steps`. */
  const step = useCallback(async (by: -1 | 1) => {
    const h = historyRef.current;
    if (!h) return;
    await h.seek(Math.max(floorRef.current, stepFrom(h.entries(), h.position(), by)));
  }, []);

  /** Writes listeners' tracks through the agent bridge, so the history knows they weren't typed here. */
  const writeAsListeners = useCallback(async (next: Cue[]) => {
    // The timeline as the bridge lists it. A timeline that has left the page (the tape before this one) can
    // still be listed, marked as gone, and can't be written to.
    const ref = agent?.snapshot().find((c) => c.component === "tracklist" && !c.offPage)?.ref;
    if (!agent || !ref) return false;
    writing.current = true;
    try {
      return (await agent.act({ steps: [{ ref, action: "setValue", args: [next] }] })).ok;
    } finally {
      writing.current = false;
    }
  }, []);

  // The timeline registers with the bridge a moment after it mounts, so a write made as the page opens waits
  // for it instead of being dropped.
  const writeWhenReady = useCallback(
    async (next: Cue[]) => {
      for (let tries = 0; tries < 60; tries++) {
        if (await writeAsListeners(next)) return true;
        await new Promise((r) => setTimeout(r, 50));
      }
      return false;
    },
    [writeAsListeners],
  );

  /** Nothing has changed since the page finished setting up. */
  const untouched = useCallback(() => historyRef.current?.position() === floorRef.current, []);
  /** What is on the timeline now is the page's own setting up: undo stops here. */
  const settle = useCallback(() => {
    floorRef.current = historyRef.current?.position() ?? 0;
    setFloor(floorRef.current);
  }, []);

  return { rootRef, writing, entries, position, floor, canUndo: position > floor, canRedo: position < entries.length, step, confirmWithUndo, writeAsListeners, writeWhenReady, untouched, settle };
}
