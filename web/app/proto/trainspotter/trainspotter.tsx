"use client";

// Trainspotter — help ID the music on a tape.
// The timeline is one UI SDK primitive (ranges on tracks). It opens showing what listeners have already
// ID'd in the comments; a visitor plays the tape and IDs what they recognise. Every change goes through the
// SDK's change pipeline, so one history gives undo and redo, and the page is operable by an agent through
// the same bridge that loads the listeners' tracklist.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPointerKind, inputHints } from "@ui-sdk/core";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { usePreference } from "@ui-sdk/react/preferences";
import { createAgent, registerTools } from "@ui-sdk/react/agent";
import { createHistory, type HistoryEntry } from "@ui-sdk/react/history";
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from "@ui-sdk/react/drawer";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxGroupLabel, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@ui-sdk/react/combobox";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { isSameRecord, reconcile, runningOrders, type Listed, type Proposal, type Sighting } from "./parse";
import { DEFAULT_LENGTH, clock, cueLabel, tracklist, type Cue } from "./tracklist-primitive";

type TapeProp = { id: string; title: string; djs: string; djCount: number; released: string; sides: { key: string; title: string; audio: string | null }[] };

// One bridge for the page. Every UI SDK component registers with it, including the timeline.
const agent = typeof window === "undefined" ? null : createAgent();
const pointerKind = createPointerKind();
const toaster = createToaster();

// Pixels per minute. A four-minute track is 160px wide with a mouse and 136px on a phone: room for an artist
// and a title. Seeing a whole 47-minute side at once on a laptop made every block too narrow to read, so the
// tape scrolls and follows the playhead instead. A side that fits at this scale (a short one, or a very wide
// window) is stretched to fill the width.
const PPM = 40;
const PPM_TOUCH = 34;
const GUTTER = 56; // the side label and its gap, to the left of every track
const UNDO_TOAST = "undo"; // one undo toast at a time: a newer one replaces the older

/** A proposal's signature: where it is and what it says. A later comment that corrects a name is a new one. */
const sig = (p: Proposal) => `${p.side}|${p.start}|${p.known ? `${p.artist}|${p.title}`.toLowerCase() : "?"}`;

/** The SDK's keyboard hints for a name, minus its autofill: this is a record's artist, not the visitor's own name. */
const nameHints = (enter: "next" | "done") => {
  const h = inputHints("name", { enter }) as Record<string, string>;
  return { autoCapitalize: h.autoCapitalize, autoCorrect: h.autoCorrect, spellCheck: h.spellCheck === "true", enterKeyHint: enter, autoComplete: "off" } as const;
};

function Track({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "track", { value }, props, "div");
}
function CuePart({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "cue", { value }, props, "div");
}

/** A plain-language line for one history entry, worked out from what changed in the list. */
function describe(e: HistoryEntry): string {
  const before = (Array.isArray(e.previous) ? e.previous : []) as Cue[];
  const after = (Array.isArray(e.value) ? e.value : []) as Cue[];
  const added = after.filter((c) => !before.some((b) => b.id === c.id));
  const removed = before.filter((b) => !after.some((c) => c.id === b.id));
  if (e.source === "agent") return added.length ? `Added ${added.length} ${added.length === 1 ? "track" : "tracks"} from the comments` : "Went back to the IDs from the comments";
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

export function Trainspotter({
  tape,
  sightings,
  listed,
  official,
  others,
}: {
  tape: TapeProp;
  sightings: Sighting[];
  listed: Listed[];
  official: Listed[][];
  /** Every tape with something to work on, in the order the switcher lists them. */
  others: { id: string; label: string; group: string; meta: string }[];
}) {
  const router = useRouter();
  // ── Changing tape: the title is the switcher, and the two links beside it step through the same list ──
  const [switcher, setSwitcher] = useState<HTMLButtonElement | null>(null);
  const [tapeNav, setTapeNav] = useState<HTMLElement | null>(null); // the list lines up with the page's edge, not the button's
  const [tapeQuery, setTapeQuery] = useState("");
  const [tapesOpen, setTapesOpen] = useState(false);
  const tapesOpenRef = useRef(false);
  tapesOpenRef.current = tapesOpen;
  const tapClicked = useRef(false);
  const tapeGroups = useMemo(() => [...new Set(others.map((o) => o.group))].map((group) => ({ group, tapes: others.filter((o) => o.group === group) })), [others]);
  const place = others.findIndex((o) => o.id === tape.id);
  const elsewhere = others.some((o) => o.id !== tape.id);
  const prevTape = elsewhere ? others[(place <= 0 ? others.length : place) - 1] : null;
  const nextTape = elsewhere ? others[(place + 1) % others.length] : null;
  const sides = useMemo(() => tape.sides.map((s) => s.key), [tape.sides]);
  // A set of several tapes (eight DJs, eight recordings) shows one part at a time, chosen from a row of parts.
  // Stacked, the rows would bury the one being listened to under seven that aren't.
  const many = sides.length > 2;
  const storageKey = `simfonik:trainspotter:${tape.id}`;
  // Behaviour forks on the pointer; styling forks on media queries in the stylesheet.
  const touch = usePreference(pointerKind).pointer === "coarse";

  // ── Audio: one element per side ──
  const audios = useRef<(HTMLAudioElement | null)[]>([]);
  // A side's real length, once its audio has reported it. Until then nothing is assumed about where it ends.
  const [durations, setDurations] = useState<(number | null)[]>(() => tape.sides.map(() => null));
  const [failed, setFailed] = useState<boolean[]>(() => tape.sides.map(() => false));
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  // ── What listeners said in the comments, reconciled into one proposal per moment ──
  // An unmeasured side is treated as endless, so a slow connection never drops an ID for being "past the end".
  const proposals = useMemo(() => reconcile(sightings, durations.map((d) => d ?? Infinity)), [sightings, durations]);
  const toCue = useCallback(
    (p: Proposal): Cue => ({ id: `crowd-${p.side}-${p.start}`, track: sides[p.side] ?? sides[0], start: p.start, end: p.end, artist: p.artist, title: p.title, known: p.known, by: p.author, open: p.open }),
    [sides],
  );

  // ── The tracklist value: controlled here, saved in this browser ──
  const [cues, setCues] = useState<Cue[]>([]);
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const [restored, setRestored] = useState<"pending" | "saved" | "fresh">("pending");
  // True once the page holds the tracklist it should: saved work, or the listeners' version on a first visit.
  // Nothing is written to storage before that, so closing the tab mid-load can't save an empty tape.
  const [ready, setReady] = useState(false);
  const saveFailed = useRef(false);
  // Which listener IDs this visitor has already been shown, so only new ones are merged in next time.
  const seen = useRef<Set<string>>(new Set());
  const [seenTick, setSeenTick] = useState(0);
  const markSeen = useCallback(
    (sigs: string[]) => {
      sigs.forEach((x) => seen.current.add(x));
      setSeenTick((n) => n + 1);
      try {
        window.localStorage.setItem(`${storageKey}:seen`, JSON.stringify([...seen.current]));
      } catch {
        /* storage is unavailable */
      }
    },
    [storageKey],
  );
  const seedSeen = useRef(false);
  useEffect(() => {
    let saved: unknown = null;
    let was: unknown = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      was = JSON.parse(window.localStorage.getItem(`${storageKey}:seen`) ?? "null");
    } catch {
      /* nothing saved, or storage is unavailable */
    }
    // An empty list with no record of what was shown is not saved work; it is a first visit that never finished.
    const found = Array.isArray(saved) && (saved.length > 0 || Array.isArray(was));
    if (found) {
      setCues(saved as Cue[]);
      if (Array.isArray(was)) seen.current = new Set(was as string[]);
      // Work saved before this page kept track of what had been shown: assume all of it was.
      else seedSeen.current = true;
      setReady(true);
    }
    setRestored(found ? "saved" : "fresh");
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cues));
      saveFailed.current = false;
    } catch {
      saveFailed.current = true; // private mode, or storage is full; the toasts say so
    }
  }, [cues, ready, storageKey]);

  // The timeline is as long as the longest thing it has to show: a measured side, or the last known track.
  const length = useMemo(() => {
    const shown = (i: number) => !many || i === active;
    const measured = durations.filter((_, i) => shown(i));
    const unmeasured = measured.every((d) => d === null) ? DEFAULT_LENGTH : 0;
    // A track whose end is only a guess (the last one anyone timed on a side) doesn't get to stretch the
    // timeline: until that side's audio reports its length the guess can run four minutes past the real end,
    // which made the whole tape draw at a scrolling scale and then snap to fit a moment later.
    const reach = (x: { start: number; end: number; open?: boolean }) => (x.open ? x.start + 30 : x.end);
    const ends = [...cues.filter((c) => shown(sides.indexOf(c.track))).map(reach), ...proposals.filter((p) => shown(p.side)).map(reach)];
    return Math.max(60, unmeasured, ...measured.map((d) => d ?? 0), ...ends);
  }, [durations, cues, proposals, many, active, sides]);
  const lengthRef = useRef(length);
  lengthRef.current = length;
  const sideLength = (i: number) => durations[i] ?? length;

  // ── Playhead: written straight to the element each frame while playing; React hears once a second ──
  const playheads = useRef<(HTMLDivElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  // The overview under the sides: the whole tape in a strip, with a frame over the part on screen.
  const mapRef = useRef<HTMLDivElement>(null);
  const mapWindowRef = useRef<HTMLDivElement>(null);
  const mapHeadRef = useRef<HTMLDivElement>(null);
  const frame = useCallback(() => {
    const sc = scrollerRef.current;
    const win = mapWindowRef.current;
    const tape = sc ? sc.scrollWidth - GUTTER : 0;
    if (!sc || !win || tape <= 0) return;
    win.style.left = `${(sc.scrollLeft / tape) * 100}%`;
    win.style.width = `${Math.min(1, (sc.clientWidth - GUTTER) / tape) * 100}%`;
  }, []);
  const handsOff = useRef(0); // until when the visitor's own scrolling is left alone
  const sheetOpen = useRef(false);
  const lastSecond = useRef(-1);
  const paint = useCallback(() => {
    const a = audios.current[activeRef.current];
    const t = a?.currentTime ?? 0;
    let x = 0;
    playheads.current.forEach((el, i) => {
      if (!el) return;
      const px = (t / lengthRef.current) * (el.parentElement?.clientWidth ?? 0);
      el.style.transform = `translateX(${px}px)`;
      el.hidden = i !== activeRef.current;
      if (i === activeRef.current) x = px;
    });
    // Where the tape is wider than the screen, follow the playhead as it plays off the edge. Not while the
    // visitor is looking somewhere else: they scrolled there on purpose, or the ID sheet put them there.
    const sc = scrollerRef.current;
    if (sc && a && !a.paused && !sheetOpen.current && performance.now() > handsOff.current && sc.scrollWidth > sc.clientWidth + 4) {
      const left = x + GUTTER - sc.scrollLeft;
      if (left > sc.clientWidth - 48 || left < GUTTER) sc.scrollLeft = Math.max(0, x - 24);
    }
    if (mapHeadRef.current) mapHeadRef.current.style.left = `${Math.min(1, t / lengthRef.current) * 100}%`;
    if (Math.floor(t) !== lastSecond.current) {
      lastSecond.current = Math.floor(t);
      setNow(t);
    }
  }, []);
  const loop = useRef(0);
  const run = useCallback(() => {
    cancelAnimationFrame(loop.current);
    const tick = () => {
      paint();
      const a = audios.current[activeRef.current];
      if (a && !a.paused) loop.current = requestAnimationFrame(tick);
    };
    loop.current = requestAnimationFrame(tick);
  }, [paint]);

  useEffect(() => {
    const offs = audios.current.map((a, i) => {
      if (!a) return () => {};
      const meta = () => {
        if (Number.isFinite(a.duration)) setDurations((d) => d.map((v, j) => (j === i ? Math.round(a.duration) : v)));
      };
      // Whichever side's event this is, the button reflects the side that is active now. The side being
      // left pauses a moment after the switch, and must not leave the button stuck on "Pause".
      const sync = () => {
        setPlaying(Boolean(audios.current[activeRef.current] && !audios.current[activeRef.current]!.paused));
        run();
      };
      const error = () => {
        if (a.getAttribute("src")) setFailed((f) => f.map((v, j) => (j === i ? true : v)));
      };
      if (a.readyState >= 1) meta();
      if (a.error) error();
      a.addEventListener("loadedmetadata", meta);
      a.addEventListener("play", sync);
      a.addEventListener("pause", sync);
      a.addEventListener("error", error);
      return () => {
        a.removeEventListener("loadedmetadata", meta);
        a.removeEventListener("play", sync);
        a.removeEventListener("pause", sync);
        a.removeEventListener("error", error);
      };
    });
    return () => {
      offs.forEach((off) => off());
      cancelAnimationFrame(loop.current);
    };
  }, [run]);

  const seek = useCallback(
    (side: number, t: number, play?: boolean) => {
      // Read this before silencing the other side: changing sides mid-play should keep playing.
      const wasPlaying = audios.current.some((x) => x && !x.paused);
      audios.current.forEach((a, i) => i !== side && a?.pause());
      const a = audios.current[side];
      setActive(side);
      activeRef.current = side;
      if (!a) return;
      a.currentTime = Math.max(0, t);
      lastSecond.current = -1;
      if (play ?? wasPlaying) a.play().catch(() => {});
      run();
    },
    [run],
  );
  const toggle = useCallback(() => {
    const a = audios.current[activeRef.current];
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false); // the ID sheet, on phones
  sheetOpen.current = sheet;
  const quiet = useRef(false); // true while the page itself is writing, so it doesn't select what it adds
  const wantName = useRef(false);
  const pageScroll = useRef(0);
  const openSheet = useCallback((id?: string | null) => {
    // Put the timeline at the top of the screen and the track in the middle of it, then open the sheet
    // below. Otherwise the sheet covers the very thing being ID'd.
    pageScroll.current = window.scrollY;
    toaster.dismiss(); // a lingering confirmation would sit on top of the fields
    const frame = document.querySelector(".ts-root") as HTMLElement | null;
    if (frame) window.scrollTo({ top: frame.getBoundingClientRect().top + window.scrollY - 8 });
    const sc = scrollerRef.current;
    const el = id ? (sc?.querySelector(`[data-span-id="${CSS.escape(id)}"]`) as HTMLElement | null) : null;
    if (sc && el) sc.scrollLeft = Math.max(0, el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2 + GUTTER / 2);
    setSheet(true);
  }, []);
  const closeSheet = useCallback(() => {
    setSheet(false);
    // Back to where the visitor was, such as their place in the unknown list.
    requestAnimationFrame(() => window.scrollTo({ top: pageScroll.current }));
  }, []);
  const focusName = useCallback(
    (id?: string | null) => {
      if (touch) requestAnimationFrame(() => openSheet(id));
      else requestAnimationFrame(() => (document.getElementById("ts-artist") as HTMLInputElement | null)?.focus());
    },
    [touch, openSheet],
  );

  const handle = usePrimitive(tracklist, {
    value: cues,
    onValueChange: (v: Cue[], details: { source?: string }) => {
      // A track a person has just marked is the one they want to ID next.
      const added = v.filter((c) => !cuesRef.current.some((b) => b.id === c.id));
      if (added.length === 1 && details?.source !== "agent" && !quiet.current) setSelected(added[0].id);
      setCues(v);
    },
    sides,
    length,
  });
  const api = handle.api;
  // The timeline learns a new length one render after the page does. Without a second pass, a change of
  // scale (another part of a set, or a side's audio reporting how long it is) leaves every track drawn at
  // the old scale: a three-minute track on a 97-minute part drawn as if the part were 17 minutes long.
  const [, redraw] = useState(0);
  useLayoutEffect(() => {
    redraw((n) => n + 1);
  }, [length]);

  // ── History: every change to the timeline, with who made it. It is the undo stack. ──
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState(0);
  // Undo stops at the listeners' tracklist the page opened with; it never empties the tape.
  const [floor, setFloorState] = useState(0);
  const floorRef = useRef(0);
  const setFloor = (n: number) => {
    floorRef.current = n;
    setFloorState(n);
  };
  const undoToastAt = useRef<number | null>(null);
  useEffect(() => {
    if (!agent) return;
    // One step per action: two separate drags are two undos, not one.
    const history = createHistory(agent, { keys: ["value"], within: () => rootRef.current, coalesce: false });
    historyRef.current = history;
    const off = history.subscribe(() => {
      setEntries([...history.entries()]);
      setPosition(history.position());
      // An Undo offered for one change must not outlive it and undo something else.
      if (undoToastAt.current !== null && history.position() !== undoToastAt.current) {
        undoToastAt.current = null;
        toaster.dismiss(UNDO_TOAST);
      }
    });
    // Offer the timeline to an assistant built into the browser, where the browser supports WebMCP. It may add
    // and ID tracks; replacing, clearing or removing is left to a person.
    const unregister = registerTools(agent, { allow: (step) => !["setValue", "clear", "removeCue"].includes(step.action) });
    (window as unknown as { simfonikAgent?: unknown }).simfonikAgent = agent;
    return () => {
      off();
      unregister?.();
      history.destroy();
      toaster.dismiss();
    };
  }, []);

  const step = useCallback(async (by: number) => {
    const h = historyRef.current;
    if (!h) return;
    await h.seek(Math.max(floorRef.current, h.position() + by));
  }, []);
  /** A confirmation whose Undo belongs to the change just made, and to nothing else. */
  const confirmWithUndo = useCallback((title: string, description?: string) => {
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
  }, []);

  const target = () => agent?.snapshot().find((c) => c.component === "tracklist")?.ref;
  /** Writes listeners' tracks through the agent bridge, so the history knows they weren't typed here. */
  const writeAsListeners = useCallback(async (next: Cue[]) => {
    const ref = target();
    if (!agent || !ref) return false;
    quiet.current = true;
    try {
      await agent.act({ steps: [{ ref, action: "setValue", args: [next] }] });
    } finally {
      quiet.current = false;
    }
    return true;
  }, []);

  // First visit to a tape: open with what is already known. This doesn't wait for the audio.
  const opening = useRef(false);
  useEffect(() => {
    if (restored !== "fresh" || opening.current) return;
    opening.current = true;
    void (async () => {
      if (proposals.length) {
        // The timeline registers with the bridge a moment after it mounts. Wait for it: giving up here would
        // show an empty tape and then save it as this visitor's work.
        let written = false;
        for (let tries = 0; tries < 60 && !written; tries++) {
          written = await writeAsListeners(proposals.map(toCue));
          if (!written) await new Promise((r) => setTimeout(r, 50));
        }
        if (!written) {
          opening.current = false; // nothing saved; the next visit starts clean
          return;
        }
        setFloor(historyRef.current?.position() ?? 0);
      }
      markSeen(proposals.map(sig));
      setReady(true);
    })();
  }, [restored, proposals, toCue, writeAsListeners, markSeen]);

  // The tracks went in before the audio said how long each side is. Once it does, pull back any listener's
  // track that runs past the end of its side. Left alone once the visitor has started making changes.
  useEffect(() => {
    if (!ready || historyRef.current?.position() !== floorRef.current) return;
    let changed = false;
    const next = cuesRef.current.flatMap((c) => {
      const d = durations[sides.indexOf(c.track)];
      if (d == null || c.end <= d || !c.by) return [c];
      changed = true;
      return c.start > d - 5 ? [] : [{ ...c, end: d }];
    });
    if (changed) void writeAsListeners(next).then((ok) => ok && setFloor(historyRef.current?.position() ?? 0));
  }, [durations, ready, sides, writeAsListeners]);

  // Return visit: whatever listeners have posted since is simply added. Nobody approves it.
  // A newer ID replaces an older one from listeners, the way a later comment corrects an earlier one.
  // A track this visitor ID'd or marked themselves is left alone.
  const merged = useRef(false);
  useEffect(() => {
    if (restored !== "saved" || merged.current) return;
    merged.current = true;
    if (seedSeen.current) {
      seedSeen.current = false;
      markSeen(proposals.map(sig));
      return;
    }
    const fresh = proposals.filter((p) => !seen.current.has(sig(p)));
    // A track that came from the comments follows the comments. Its id records where they put it, so one
    // the visitor has since dragged elsewhere is still recognised and keeps its new times. If the comments
    // no longer have anything there it goes; if they now say something else there, it takes that name. This
    // is what clears a misreading once the reader is fixed, instead of leaving it in every browser that
    // saved it. A track the visitor ID'd themselves has no `by` and is never touched.
    let added = 0;
    let corrected = 0;
    let removed = 0;
    const next = cuesRef.current.flatMap((c) => {
      const from = c.by ? c.id.match(/^crowd-(\d+)-(\d+)/) : null;
      if (!from) return [c];
      const p = proposals.find((x) => x.side === Number(from[1]) && Math.abs(x.start - Number(from[2])) <= 20);
      if (!p) {
        removed++;
        return [];
      }
      if (p.artist === c.artist && p.title === c.title && p.known === c.known) return [c];
      corrected++;
      return [{ ...c, artist: p.artist, title: p.title, known: p.known, by: p.author }];
    });
    for (const p of fresh) {
      const cue = { ...toCue(p), id: `crowd-${p.side}-${p.start}-${Date.now().toString(36)}` };
      if (next.some((c) => c.track === cue.track && Math.abs(c.start - cue.start) <= 20)) continue;
      next.push(cue);
      added++;
    }
    markSeen(fresh.map(sig));
    if (!added && !corrected && !removed) return;
    void writeAsListeners(next).then((ok) => {
      if (!ok) return;
      const parts = [added ? `added ${added}` : "", corrected ? `corrected ${corrected}` : "", removed ? `removed ${removed} misread` : ""].filter(Boolean).join(", ");
      confirmWithUndo(`Updated from the comments: ${parts}.`);
    });
    // Runs once, with the proposals as they are when saved work has been restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, seenTick]);

  const startOver = async () => {
    if (await writeAsListeners(proposals.map(toCue))) {
      markSeen(proposals.map(sig));
      setSelected(null);
      confirmWithUndo("Back to the IDs from the comments.");
    }
  };

  const canUndo = position > floor;
  const canRedo = position < entries.length;
  // In a text field these keys belong to the field: they undo typing, not the tracklist.
  const notTyping = () => !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement);
  useShortcut("mod+z", () => canUndo && void step(-1), { description: "Undo", when: notTyping });
  useShortcut("mod+shift+z", () => canRedo && void step(1), { description: "Redo", when: notTyping });
  const undoHint = useShortcutHint("mod+z");
  const redoHint = useShortcutHint("mod+shift+z");

  // ── The track under the playhead on the side that's playing ──
  const playingCue = useMemo(
    () =>
      cues
        .filter((c) => c.track === sides[active] && c.start <= now && now < c.end)
        .sort((a, b) => b.start - a.start)[0] ?? null,
    [cues, sides, active, now],
  );

  // "Mark new track": mark it at the playhead and go straight to ID'ing it.
  const markHere = useCallback(() => {
    const a = audios.current[activeRef.current];
    const t = Math.floor(a?.currentTime ?? 0);
    // A second press within a few seconds means "this one", not "another one on top of it".
    const same = cuesRef.current.find((c) => c.track === sides[activeRef.current] && Math.abs(c.start - t) < 5);
    if (same) {
      setSelected(same.id);
      focusName(same.id);
      return;
    }
    wantName.current = true;
    api.markAt(sides[activeRef.current], t);
  }, [api, sides, focusName]);
  useEffect(() => {
    if (selected && wantName.current) {
      wantName.current = false;
      focusName(selected);
    }
  }, [selected, focusName]);
  const idIt = (id: string) => {
    // Where one part shows at a time, go to the part this track is on, so it is on screen to be ID'd.
    const cue = cuesRef.current.find((c) => c.id === id);
    const side = cue ? sides.indexOf(cue.track) : -1;
    if (many && cue && side >= 0 && side !== activeRef.current) seek(side, cue.start);
    setSelected(id);
    focusName(id);
  };
  // Changing part leaves behind a selection that is no longer on screen.
  useEffect(() => {
    if (many) setSelected((id) => (cuesRef.current.find((c) => c.id === id)?.track === sides[active] ? id : null));
  }, [many, active, sides]);

  // ← and →: the previous or next track, from wherever the keyboard is. The audio goes with it, and keeps
  // playing if it was playing. With no track picked, it steps from the one under the playhead.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const stepTrack = useCallback(
    (dir: -1 | 1) => {
      const picked = cuesRef.current.find((c) => c.id === selectedRef.current);
      const side = picked ? sides.indexOf(picked.track) : activeRef.current;
      const row = cuesRef.current.filter((c) => c.track === sides[side]).sort((a, b) => a.start - b.start);
      let to: Cue | undefined;
      if (picked) to = row[row.indexOf(picked) + dir];
      else {
        const t = audios.current[side]?.currentTime ?? 0;
        const sofar = row.filter((c) => c.start <= t);
        to = dir > 0 ? row.find((c) => c.start > t) : (sofar[sofar.length - 2] ?? sofar[0]);
      }
      if (!to) return;
      const id = to.id;
      setSelected(id);
      seek(side, to.start);
      // Focus the block: it scrolls into view, and the keys that act on a track now act on this one.
      requestAnimationFrame(() => (scrollerRef.current?.querySelector(`[data-span-id="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus());
    },
    [sides, seek],
  );

  // M marks and Space plays, unless the key belongs to a field or a control. A focused track is neither.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) {
        // Not where arrows already mean something: a text field, the scrubber, the part picker, an open list.
        if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("[role=slider],[role=radio],[role=radiogroup],[role=option],[role=listbox],[role=combobox],[role=dialog]")) return;
        e.preventDefault();
        stepTrack(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || t.closest("[role=slider],[role=option],[role=dialog]")) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        markHere();
      } else if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [markHere, toggle, stepTrack]);

  // ── Names waiting for a time: the site's own tracklist if there is one, else a commenter's running order ──
  const orders = useMemo(() => {
    const fromComments = runningOrders(listed, sides.length);
    return sides.map((_, i) => (official[i]?.length ? official[i] : (fromComments[i] ?? [])));
  }, [listed, official, sides]);
  const fromSite = official.some((o) => o.length > 0);
  const waiting = useMemo(
    () => orders.map((order, side) => order.filter((l) => l.known && !cues.some((c) => c.track === sides[side] && c.known && isSameRecord(c, l)))),
    [orders, cues, sides],
  );
  const namesTotal = orders.reduce((n, o) => n + o.filter((l) => l.known).length, 0);
  const namesWaiting = waiting.reduce((n, w) => n + w.length, 0);

  const sel = cues.find((c) => c.id === selected) ?? null;
  // For an unknown track, the names most likely to belong to it: the ones nearest its place in the order.
  const nextNames = useMemo(() => {
    if (!sel || sel.known) return [];
    const side = sides.indexOf(sel.track);
    const order = orders[side] ?? [];
    const place = cues.filter((c) => c.track === sel.track && c.start < sel.start).length;
    return (waiting[side] ?? [])
      .map((l) => ({ l, d: Math.abs(order.indexOf(l) - place) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.l)
      .sort((a, b) => a.n - b.n);
  }, [sel, sides, orders, waiting, cues]);
  // What else listeners said about the selected track's moment.
  const opinions = useMemo(() => {
    if (!sel) return [];
    const side = sides.indexOf(sel.track);
    return proposals.find((p) => p.side === side && Math.abs(p.start - sel.start) <= 20)?.also ?? [];
  }, [sel, sides, proposals]);

  // An unknown track's "title" is only a listener's clue ("you can't run"), so it never pre-fills the field.
  const shownTitle = sel?.known ? sel.title : "";
  const [draft, setDraft] = useState({ artist: "", title: "" });
  useEffect(() => {
    setDraft({ artist: sel?.artist ?? "", title: shownTitle });
  }, [sel?.id, sel?.artist, shownTitle]);
  const saveId = (artist = draft.artist, title = draft.title) => {
    const a = artist.trim();
    const t = title.trim();
    if (!sel || (a === sel.artist && t === shownTitle)) return false;
    if (!a && !t) {
      // Both fields emptied on an ID'd track: that is how it goes back to unknown. On an unknown one there
      // is nothing to save.
      if (!sel.known) return false;
      api.renameCue(sel.id, "", "");
      confirmWithUndo("Set back to unknown.");
      return true;
    }
    api.renameCue(sel.id, a, t);
    confirmWithUndo(`ID’d: ${[a, t].filter(Boolean).join(" — ")}`, "Saved on this device.");
    return true;
  };
  const remove = (cue: Cue | null = sel) => {
    if (!cue) return;
    // Keep the keyboard somewhere useful: the next track on that side, or the one before.
    const row = cuesRef.current.filter((c) => c.track === cue.track).sort((a, b) => a.start - b.start);
    const i = row.findIndex((c) => c.id === cue.id);
    const neighbour = row[i + 1] ?? row[i - 1];
    api.removeCue(cue.id);
    setSelected(null);
    if (sheet) closeSheet();
    else if (neighbour) requestAnimationFrame(() => (scrollerRef.current?.querySelector(`[data-span-id="${CSS.escape(neighbour.id)}"]`) as HTMLElement | null)?.focus());
    confirmWithUndo(`Removed ${cueLabel(cue)}.`);
  };

  // ── Timeline geometry: fill the width on a wide screen, scroll on a narrow one ──
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      setAvail(el.clientWidth);
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    // The visitor moving the timeline themselves puts following on hold for a few seconds.
    const hold = () => {
      handsOff.current = performance.now() + 5000;
    };
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    el.addEventListener("touchstart", hold, { passive: true });
    // The time under a mouse pointer, written straight to the element: no render per pixel moved.
    const ghost = ghostRef.current;
    const point = (e: PointerEvent) => {
      if (!ghost) return;
      const canvas = el.firstElementChild as HTMLElement | null;
      const box = canvas?.getBoundingClientRect();
      const x = box ? e.clientX - box.left - GUTTER : -1;
      const w = box ? box.width - GUTTER : 0;
      // Not while dragging, not over the side labels, not for a finger.
      if (e.pointerType !== "mouse" || e.buttons || x < 0 || x > w || e.clientX - el.getBoundingClientRect().left < GUTTER) return ghost.removeAttribute("data-on");
      ghost.style.transform = `translateX(${x + GUTTER}px)`;
      const name = (e.target as HTMLElement).closest?.<HTMLElement>(".ts-cue")?.dataset.name ?? "";
      const label = ghost.firstElementChild as HTMLElement;
      (label.firstElementChild as HTMLElement).textContent = clock((x / w) * lengthRef.current);
      (label.lastElementChild as HTMLElement).textContent = name;
      // Keep the label on screen: it opens to the left once it would run off the right edge.
      ghost.toggleAttribute("data-flip", e.clientX + label.offsetWidth + 12 > el.getBoundingClientRect().right);
      ghost.setAttribute("data-on", "");
    };
    const unpoint = () => ghost?.removeAttribute("data-on");
    el.addEventListener("pointermove", point);
    el.addEventListener("pointerleave", unpoint);
    el.addEventListener("scroll", frame, { passive: true });
    return () => {
      el.removeEventListener("scroll", frame);
      el.removeEventListener("pointermove", point);
      el.removeEventListener("pointerleave", unpoint);
      ro.disconnect();
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchstart", hold);
    };
  }, [paint, frame]);
  // Fit the whole side when there is room for it to stay readable; otherwise keep a fixed scale and scroll.
  const fit = avail - GUTTER - 2;
  const ppm = touch ? PPM_TOUCH : PPM;
  const width = fit >= (length / 60) * ppm ? fit : Math.round((length / 60) * ppm);
  const minutes = Math.ceil(length / 60);
  // More tape than fits: the overview strip shows the rest and takes you there.
  const scrolls = avail > 0 && width > fit + 1;
  useEffect(() => {
    paint(); // the playhead is placed in pixels, so it moves when the scale does
    frame();
  }, [width, length, paint, frame, scrolls, active]);
  // Press or drag on the overview: bring that part of the tape to the middle of the screen.
  const mapTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollerRef.current;
    if (!sc || !(e.buttons & 1)) return;
    const box = e.currentTarget.getBoundingClientRect();
    const at = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    handsOff.current = performance.now() + 5000; // the visitor is steering; don't snap back to the playhead
    sc.scrollLeft = at * (sc.scrollWidth - GUTTER) - (sc.clientWidth - GUTTER) / 2;
  };

  // Scrubbing: the marker follows the finger at once; the audio follows a few times a second and settles on
  // release, so one drag is a handful of requests to the audio host instead of dozens.
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const lastSeek = useRef(0);
  const scrub = (v: number | number[]) => {
    const t = Math.min(v as number, sideLength(activeRef.current));
    setScrubAt(t);
    if (performance.now() - lastSeek.current > 120) {
      lastSeek.current = performance.now();
      seek(activeRef.current, t);
    }
  };
  const scrubEnd = (v: number | number[]) => {
    seek(activeRef.current, Math.min(v as number, sideLength(activeRef.current)));
    setScrubAt(null);
  };

  // A press that didn't travel is a click: on bare tape it moves the playhead. A drag is the SDK's to handle.
  const down = useRef<{ x: number; y: number } | null>(null);
  const wasClick = (e: React.MouseEvent) => {
    const d = down.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5;
  };

  // Only what this visitor ID'd goes in the comment. Pasting everyone's IDs would re-credit the whole tape to them.
  const mine = cues.filter((c) => c.known && !c.by);
  const asComment = () =>
    tape.sides
      .map((side) => {
        const rows = mine.filter((c) => c.track === side.key).sort((a, b) => a.start - b.start);
        return rows.length ? [`Side ${side.key}`, ...rows.map((c) => `[${clock(c.start)}] ${[c.artist, c.title].filter(Boolean).join(" - ")}`)].join("\n") : "";
      })
      .filter(Boolean)
      .join("\n\n");
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asComment());
      setCopied("yes");
      setTimeout(() => setCopied("no"), 1500);
    } catch {
      setCopied("failed"); // show the text so it can be copied by hand
    }
  };

  // Before the tracklist is in place (the first paint, and the server's HTML), count from what listeners posted.
  const counted = ready ? cues : proposals;
  const knownCount = counted.filter((c) => c.known).length;
  const unknownCount = counted.length - knownCount;
  const audioFailed = failed[active];

  // The unknown list follows the timeline: every side of a two-sided tape, or the one part on screen.
  const unknownHere = cues.filter((c) => !c.known && (!many || c.track === sides[active])).sort((a, b) => a.track.localeCompare(b.track) || a.start - b.start);
  const elsewhereUnknown = cues.filter((c) => !c.known && c.track !== sides[active]).length;
  const unknownParts = sides.filter((k) => k !== sides[active] && cues.some((c) => !c.known && c.track === k));
  // A compilation is named by its title and the part being heard, not by a line of eight DJs.
  const compactTitle = tape.djCount > 3;
  const partTitle = (i: number) => (tape.sides[i]?.title && !/^side\b/i.test(tape.sides[i].title) ? tape.sides[i].title : null);
  const partName = partTitle(active);
  const markLabel = touch ? "New track" : "Mark new track";
  // What to do, in one line. The counts are in the list of tapes and the lists below; here they were a
  // sentence of numbers in front of the instruction.
  const intro =
    namesWaiting > 0
      ? `We know what’s on this tape, but not when each track comes in. Press play, and press “${markLabel}” each time one starts.`
      : counted.length
        ? unknownCount
          ? "Press play and help ID the unknowns."
          : `Press play, and when you hear a track that isn’t marked, press “${markLabel}” and ID it.`
        : `Nothing ID’d on this tape yet. Press play, and press “${markLabel}” when you hear a track you know.`;

  // The ID form: inline under the timeline with a mouse, in a sheet above the keyboard on a phone.
  const chips = nextNames.length > 0 && (
    <div className="w-full">
      <p className="ts-label">{fromSite ? "Is it one of these, from the tape’s tracklist?" : `Is it one of these, from ${nextNames[0].author}’s list?`}</p>
      <div className="flex flex-wrap gap-2">
        {nextNames.map((l) => (
          <button
            key={`${l.side}-${l.n}`}
            type="button"
            onClick={() => {
              saveId(l.artist, l.title);
              if (touch) closeSheet();
              else requestAnimationFrame(() => (scrollerRef.current?.querySelector("[data-selected]") as HTMLElement | null)?.focus());
            }}
            className="ts-chip"
          >
            <span className="font-mono text-xs tabular-nums opacity-70">{l.n}</span> {l.artist} — {l.title}
          </button>
        ))}
      </div>
    </div>
  );
  const clueNote = Boolean(sel && !sel.known && sel.title && !touch && sel.id !== playingCue?.id);
  const idForm = sel && (
    <form
      className="ts-nameform"
      onSubmit={(e) => {
        e.preventDefault();
        saveId();
        if (touch) closeSheet();
      }}
      // With a mouse, leaving the form saves. Moving between its two fields does not.
      onBlur={(e) => {
        if (!touch && !e.currentTarget.contains(e.relatedTarget as Node | null)) saveId();
      }}
      // Escape abandons what was typed.
      onKeyDown={(e) => {
        if (e.key === "Escape" && !touch) {
          setDraft({ artist: sel.artist, title: shownTitle });
          (scrollerRef.current?.querySelector("[data-selected]") as HTMLElement | null)?.focus();
        }
      }}
    >
      {/* One-tap answers come before the fields that need typing. */}
      {chips}
      {/* On a phone the sheet covers the player, so the clue is repeated here. With a mouse the player already
          shows it for the track that is playing; see the note under the fields for one that isn't. */}
      {touch && !sel.known && sel.title && (
        <p className="w-full text-[15px] text-[var(--text)]">
          Clue from {sel.by ?? "a comment"}: “{sel.title}”
        </p>
      )}
      <Field className="min-w-0 flex-1 basis-40">
        <FieldLabel className="ts-label">Artist</FieldLabel>
        <Input
          id={touch ? "ts-artist-sheet" : "ts-artist"}
          value={draft.artist}
          onValueChange={(v: string) => setDraft((d) => ({ ...d, artist: v }))}
          // The keyboard's Next key sends Enter. It should go to Title, not save half an ID.
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              (e.currentTarget.form?.querySelector("[data-title]") as HTMLInputElement | null)?.focus();
            }
          }}
          {...nameHints("next")}
          className="ts-input"
        />
      </Field>
      <Field className="min-w-0 flex-[1.4] basis-48">
        <FieldLabel className="ts-label">Title</FieldLabel>
        <Input data-title value={draft.title} onValueChange={(v: string) => setDraft((d) => ({ ...d, title: v }))} {...nameHints("done")} className="ts-input" />
      </Field>
      <div className="flex flex-none flex-wrap items-end gap-2">
        <button type="submit" className="ts-btn ts-btn-solid">
          Save
        </button>
        {/* With a mouse, clicking the track plays it, so a button for that would say what is already
            happening. The phone's sheet covers the timeline, so there it stays, as a way to hear it again. */}
        {touch && (
          <button type="button" onClick={() => seek(sides.indexOf(sel.track), sel.start, true)} className="ts-link">
            Replay
          </button>
        )}
        <button type="button" onClick={() => remove()} className="ts-link" data-agent-confirm="Remove this track from the tracklist?">
          Remove
        </button>
      </div>
      {/* Only what can't be read anywhere else: a clue for a picked track that isn't the one playing (the
          player shows the playing one's), and other IDs people gave for this spot, one click to take. */}
      {(clueNote || opinions.length > 0) && (
        <p className="w-full text-sm text-[var(--muted)]">
          {clueNote ? `Clue from ${sel.by ?? "a comment"}: “${sel.title}”` : ""}
          {opinions.map((o, i) => (
            <span key={i}>
              {" "}
              {o.known ? (
                <>
                  {o.author} thought it was{" "}
                  <button type="button" onClick={() => saveId(o.artist, o.title)} className="ts-inline-link text-[var(--text)]">
                    {[o.artist, o.title].filter(Boolean).join(" — ")}
                  </button>
                  .
                </>
              ) : (
                <>
                  {o.author} heard “{o.title}”.
                </>
              )}
            </span>
          ))}
        </p>
      )}
    </form>
  );

  const undoRedo = (
    <>
      <button type="button" onClick={() => void step(-1)} disabled={!canUndo} className="ts-link" aria-keyshortcuts={undoHint.ariaKeyshortcuts} title={`Undo (${undoHint.text})`}>
        Undo
      </button>
      <button type="button" onClick={() => void step(1)} disabled={!canRedo} className="ts-link" aria-keyshortcuts={redoHint.ariaKeyshortcuts} title={`Redo (${redoHint.text})`}>
        Redo
      </button>
    </>
  );

  const root = usePart(
    handle,
    "root",
    {},
    {
      ref: rootRef,
      "aria-label": "Tracklist timeline",
      className: "ts-rows",
      children: ({ cues: live }: { cues: Cue[] }) => (
        <>
          {tape.sides.map((side, i) => (many && i !== active ? null : (
            <div key={side.key} className="ts-row">
              <button type="button" className="ts-side" onClick={() => seek(i, audios.current[i]?.currentTime ?? 0)} aria-pressed={i === active} aria-label={`Listen to side ${side.key}${side.title && side.title !== `Side ${side.key}` ? `, ${side.title}` : ""}`}>
                {side.key}
              </button>
              <Track
                value={side.key}
                className="ts-track"
                style={{ width, backgroundSize: `${(60 / length) * 100}% 100%` }}
                onPointerDown={(e: React.PointerEvent) => {
                  down.current = { x: e.clientX, y: e.clientY };
                }}
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                  // Click bare tape to go there.
                  if (wasClick(e)) seek(i, Math.min(api.spans.valueAt(side.key, e.clientX, e.clientY), sideLength(i)));
                }}
              >
                {durations[i] !== null && durations[i]! < length && <div className="ts-beyond" style={{ left: `${(durations[i]! / length) * 100}%` }} aria-hidden />}
                {live
                  .filter((c) => c.track === side.key)
                  .map((c) => (
                    <CuePart
                      key={c.id}
                      value={c.id}
                      className="ts-cue"
                      // Read by the pointer's time label, which names the track it is over.
                      data-name={c.known ? cueLabel(c) : c.title ? `Unknown. Clue: “${c.title}”` : "Unknown"}
                      data-selected={c.id === selected ? "" : undefined}
                      data-playing={c.id === playingCue?.id ? "" : undefined}
                      aria-current={c.id === selected ? "true" : undefined}
                      onClick={(e: React.MouseEvent) => {
                        // A click on a track picks it and plays it from its start, whichever side it is on.
                        // It stops here so the tape underneath doesn't also seek to wherever the click landed.
                        e.stopPropagation();
                        if (!wasClick(e)) return;
                        setSelected(c.id);
                        seek(i, c.start, true);
                      }}
                      onFocus={() => setSelected(c.id)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          idIt(c.id);
                        } else if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          remove(c);
                        }
                      }}
                    >
                      <span className="ts-edge" data-span-edge="start" aria-hidden />
                      <span className="ts-cue-text">
                        {/* An unknown track shows nothing but its hatching. Its label, the pointer's time label and the
                            list below say "unknown" in words; a mark repeated in every block was noise. */}
                        {c.known && (
                          <>
                            <b>{c.artist || c.title}</b>
                            <i>{c.artist ? c.title : ""}</i>
                          </>
                        )}
                      </span>
                      <span className="ts-edge" data-span-edge="end" aria-hidden />
                    </CuePart>
                  ))}
                <div
                  ref={(el) => {
                    playheads.current[i] = el;
                  }}
                  className="ts-playhead"
                  hidden={i !== active}
                  aria-hidden
                />
              </Track>
            </div>
          )))}
        </>
      ),
    },
    "div",
  );

  return (
    <section className="ts-page mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-label="Help ID the tracks on this tape">
      {tape.sides.map((s, i) => (
        <audio
          key={s.key}
          ref={(el) => {
            audios.current[i] = el;
          }}
          src={s.audio ?? undefined}
          // Of eight recordings, only the one on screen is worth asking the audio host about.
          preload={many && i !== active ? "none" : "metadata"}
          playsInline
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
      {/* Getting around: step to the next tape, or open the whole list with each tape's progress. The list is a
          combobox with its search inside the popup; on a phone it presents as a sheet. */}
      <Combobox
        value={tape.id}
        onValueChange={(v: unknown) => {
          if (typeof v === "string" && v !== tape.id) router.push(`/proto/trainspotter/${v}`);
        }}
        // The search text is ours so it can be emptied each time the list opens; left to itself the field would
        // open holding the current tape's name. It is committed at once: the combobox picks which match to
        // highlight straight after telling us, and a render later it would highlight a match for the letters
        // before this one.
        query={tapeQuery}
        onQueryChange={(q: string) => flushSync(() => setTapeQuery(q))}
        open={tapesOpen}
        onOpenChange={(open: boolean) => {
          setTapesOpen(open);
          if (open) setTapeQuery("");
        }}
        onOpenChangeComplete={(open: boolean) => !open && switcher?.focus()}
        presentation="auto"
        autoHighlight
      >
        <nav aria-label="Tapes" className="ts-nav" ref={setTapeNav}>
          {elsewhere && (
            <Link href={`/proto/trainspotter/${prevTape!.id}`} className="ts-link" aria-label={`Previous tape: ${prevTape!.label}`}>
              ‹ Prev
            </Link>
          )}
          <ComboboxTrigger
            ref={setSwitcher}
            className="ts-link ts-nav-all"
            // A finger tap normally arrives as a click and the combobox opens itself. In WebKit's touch
            // emulation the click never comes, so if a tap ends and nothing followed, open it here.
            onClick={() => {
              tapClicked.current = true;
            }}
            onPointerUp={(e: React.PointerEvent) => {
              if (e.pointerType !== "touch") return;
              tapClicked.current = false;
              const wasOpen = tapesOpenRef.current;
              setTimeout(() => !tapClicked.current && tapesOpenRef.current === wasOpen && setTapesOpen(!wasOpen), 150);
            }}
          >
            <span>All tapes</span>
            <span className="tabular-nums opacity-60">{place >= 0 ? `${place + 1} of ${others.length}` : others.length}</span>
            <span aria-hidden>▾</span>
          </ComboboxTrigger>
          {elsewhere && (
            <Link href={`/proto/trainspotter/${nextTape!.id}`} className="ts-link" aria-label={`Next tape: ${nextTape!.label}`}>
              Next ›
            </Link>
          )}
        </nav>
        <ComboboxContent anchor={tapeNav} align="start" alignOffset={10} sideOffset={4} className="ts-tapes">
          <div className="ts-tapes-search">
            <ComboboxInput autoFocus aria-label="Search tapes" placeholder="Search by DJ or tape" autoComplete="off" spellCheck={false} className="ts-input" />
          </div>
          <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">No tape by that name has track IDs to work with yet.</ComboboxEmpty>
          <ComboboxList className="ts-tapes-list">
            {tapeGroups.map(({ group, tapes }) => (
              <ComboboxGroup key={group}>
                <ComboboxGroupLabel className="ts-tapes-group">{group}</ComboboxGroupLabel>
                {tapes.map((t) => (
                  <ComboboxItem key={t.id} value={t.id} label={t.label} className="ts-option">
                    <span className="min-w-0 flex-1 truncate" title={t.label}>{t.label}</span>
                    <span className="flex-none font-mono text-xs tabular-nums opacity-70">{t.id === tape.id ? "You’re here" : t.meta}</span>
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {/* Above the title: its tall letters reach up past their own line and would otherwise sit over this link. */}
      <p className="relative z-[1] font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Released {tape.released} ·{" "}
        <Link href={`/tapes/${tape.id}`} className="ts-inline-link">
          Tape page
        </Link>
      </p>
      </div>
      <h1 className="mt-5 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-6xl">
        {compactTitle ? (
          <>
            {tape.title} <span className="text-[var(--muted)]">{partName ?? `${tape.djCount} DJs`}</span>
          </>
        ) : (
          <>
            {tape.djs} <span className="text-[var(--muted)]">{tape.title}</span>
          </>
        )}
      </h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-[var(--text)] [text-wrap:pretty]">{intro}</p>

      {/* The player, with a mouse: play, what is playing, where in the side, and the one thing to do about it,
          on one line: the button, the clock and the action all sit on the track's name, and who ID'd it hangs
          below the name alone. The button says whether it is playing and the clock says where, so neither is
          said twice. On a phone the pinned bar does this job. */}
      <div className="ts-fine-only ts-player mt-6 border-t-[1.5px] border-[var(--text)] pt-5">
        <button type="button" onClick={toggle} disabled={audioFailed} className="ts-btn ts-btn-solid min-w-[6rem]" aria-keyshortcuts="Space">
          {playing ? "Pause" : "Play"}
        </button>
        <p className="ts-player-title truncate font-display text-3xl leading-tight text-[var(--text)] sm:text-4xl" title={playingCue?.known ? cueLabel(playingCue) : undefined}>{playingCue ? (playingCue.known ? cueLabel(playingCue) : "Unknown track") : "Nothing ID’d here yet"}</p>
        <p className="flex-none font-mono text-sm tabular-nums text-[var(--text)]">
          <span className="sr-only">Side </span>
          {sides[active]} {clock(now)} <span className="text-[var(--muted)]">/ {durations[active] === null ? "–:––:––" : clock(durations[active]!)}</span>
        </p>
        <div className="flex flex-none flex-wrap items-center gap-2">
          {/* Both actions keep their place and their size whatever is playing. Only the fill changes, to show
              which one matters now: ID an unknown, or mark a track where nothing is marked. Before, they swapped
              between a boxed button and a text link, and the clock and both buttons jumped sideways each time
              the tape moved on to the next track. */}
          <button type="button" onClick={() => playingCue && idIt(playingCue.id)} disabled={!playingCue} className={`ts-btn min-w-[7.5rem] ${playingCue && !playingCue.known ? "ts-btn-solid" : ""}`}>
            {playingCue?.known ? "Fix ID" : "ID track"}
          </button>
          <button type="button" onClick={markHere} className={`ts-btn ${playingCue ? "" : "ts-btn-solid"}`} aria-keyshortcuts="M" title="Mark where a new track starts, at the current time (M)">
            Mark new track
          </button>
        </div>
        <p className="ts-player-sub min-h-[1.25rem] truncate text-sm text-[var(--muted)]">
            {audioFailed
              ? `Side ${sides[active]}’s audio didn’t load. Check your connection and reload the page.`
              : playingCue
                ? playingCue.known
                  ? playingCue.by
                    ? `ID’d by ${playingCue.by}`
                    : "ID’d by you"
                  : playingCue.title
                    ? `Nobody has ID’d it. Clue: “${playingCue.title}”`
                    : "Nobody has ID’d this one. Do you know it?"
                : `If a track is playing here, press “${markLabel}” and ID it.`}
          </p>
      </div>

      {many && (
        <SegmentedControl
          aria-label="Part of this set"
          value={sides[active]}
          onValueChange={(v: string | null) => {
            const i = v === null ? -1 : sides.indexOf(v);
            if (i >= 0 && i !== active) seek(i, audios.current[i]?.currentTime ?? 0);
          }}
          className="ts-parts mt-5"
        >
          {tape.sides.map((side, i) => {
            const left = cues.filter((c) => c.track === side.key && !c.known).length;
            return (
              <SegmentedControlItem key={side.key} value={side.key} className="ts-part">
                <b>{side.key}</b>
                {partTitle(i) && <span>{partTitle(i)}</span>}
                {left > 0 && <i aria-label={`${left} unknown`}>{left}</i>}
              </SegmentedControlItem>
            );
          })}
        </SegmentedControl>
      )}

      <div className={`ts-root ${many ? "mt-2" : "mt-4"}`}>
        <div className="ts-scroller" ref={scrollerRef} data-proto-keys>
          <div className="ts-canvas" style={{ width: width + GUTTER }}>
            {/* The ruler is the scrubber: a slider the width of the tape. It sits outside the tracklist
                so that moving through the audio is never recorded as a change to the tracklist. */}
            <div className="ts-ruler" style={{ marginLeft: GUTTER, width }}>
              <Slider value={Math.min(scrubAt ?? now, length)} onValueChange={scrub} onValueCommit={scrubEnd} min={0} max={length} step={1} largeStep={15} format={clock}>
                <SliderControl className="ts-scrub">
                  <SliderTrack className="ts-scrub-track">
                    {Array.from({ length: Math.floor(minutes / 5) + 1 }, (_, i) => (
                      <span key={i} className="ts-tick" style={{ left: `${((i * 300) / length) * 100}%` }} aria-hidden>
                        {clock(i * 300)}
                      </span>
                    ))}
                    <SliderIndicator className="ts-scrub-fill" />
                    <SliderThumb className="ts-scrub-thumb" aria-label={`Position in side ${sides[active]}`} />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </div>
            {root}
            <div ref={ghostRef} className="ts-ghost" aria-hidden>
              <span className="ts-ghost-time">
                <b className="font-normal" />
                <span />
              </span>
            </div>
          </div>
        </div>
        {/* The whole tape at a glance, when it doesn't all fit: a lane per side, unknowns in full strength,
            the playhead, and a frame around what is on screen. Press or drag it to go there. It is a second
            way to scroll, so it stays out of the accessibility tree; the timeline itself scrolls for everyone. */}
        {scrolls && (
          <div
            ref={mapRef}
            className="ts-map"
            style={{ marginLeft: GUTTER }}
            aria-hidden
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              mapTo(e);
            }}
            onPointerMove={mapTo}
          >
            {tape.sides.map((side, i) =>
              many && i !== active ? null : (
                <div key={side.key} className="ts-map-lane">
                  {durations[i] !== null && durations[i]! < length && <span style={{ left: `${(durations[i]! / length) * 100}%` }} />}
                  {cues
                    .filter((c) => c.track === side.key)
                    .map((c) => (
                      <i key={c.id} data-known={c.known ? "" : undefined} style={{ left: `${(c.start / length) * 100}%`, width: `${((c.end - c.start) / length) * 100}%` }} />
                    ))}
                </div>
              ),
            )}
            <div ref={mapHeadRef} className="ts-map-head" />
            <div ref={mapWindowRef} className="ts-map-window" />
          </div>
        )}
      </div>

      {/* With a mouse the ID fields sit under the timeline. On a phone they open in a sheet that stays above the keyboard. */}
      <div className="ts-namebar">
        {/* Always here, so undo is never hidden behind the ID form: what is picked (or what to do) on the left,
            undo, redo and the keys on the right. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 text-sm text-[var(--muted)]">
          {/* With a track picked there is nothing to add here: where it sits is on the timeline above. */}
          <div>
            {!sel && (
              <>
                <p className="ts-fine">Click a track to play it and ID it.</p>
                <p className="ts-coarse">Tap a track to play it, then “ID it”.</p>
              </>
            )}
          </div>
          <div className="-mr-2.5 flex items-center gap-1">
            {(!touch || canUndo || canRedo) && undoRedo}
            {/* Everything else the page can do is shown where it happens: the time under the pointer, the grips
                on a track. The keys are a click away for whoever wants them. */}
            <Popover>
              <PopoverTrigger className="ts-link ts-fine-only">Keyboard shortcuts</PopoverTrigger>
              <PopoverContent side="top" align="end" sideOffset={6} className="ts-keys">
                <PopoverTitle className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Keyboard shortcuts</PopoverTitle>
                <dl>
                  {[
                    ["Space", "Play or pause"],
                    ["← →", "Previous or next track"],
                    ["M", "Mark new track"],
                    ["Enter", "ID the selected track"],
                    ["Delete", "Remove it"],
                    ["Alt ← →", "Move it a second"],
                    ["Alt Shift ← →", "Trim where it ends"],
                    [undoHint.text, "Undo"],
                    [redoHint.text, "Redo"],
                  ].map(([key, what]) => (
                    <div key={key} className="contents">
                      <dt>{key}</dt>
                      <dd>{what}</dd>
                    </div>
                  ))}
                </dl>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {sel &&
          (touch ? (
            <div className="flex w-full items-center gap-3">
              {/* Artist and title each get a line of their own, and the title may take two: side by side on one
                  line a name was cut off after a couple of words. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--text)]">{sel.known ? sel.artist || sel.title : "Unknown track"}</p>
                <p className="line-clamp-3 text-sm text-[var(--muted)]">{sel.known ? (sel.artist ? sel.title : "") : sel.title ? `Clue: “${sel.title}”` : "Nobody has ID’d it yet"}</p>
              </div>
              <button type="button" onClick={() => openSheet(sel.id)} className="ts-btn ts-btn-solid flex-none">
                {sel.known ? "Fix ID" : "ID it"}
              </button>
            </div>
          ) : (
            idForm
          ))}
      </div>

      <Drawer open={sheet && Boolean(sel) && touch} onOpenChange={(open: boolean) => (open ? setSheet(true) : closeSheet())}>
        <DrawerBackdrop className="ts-backdrop" />
        <DrawerContent className="ts-sheet">
          <div data-slot="grip" className="ts-grip" aria-hidden />
          {sel && (
            <>
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="font-display text-2xl leading-tight text-[var(--text)]">{sel.known ? "Fix ID" : "What is this track?"}</DrawerTitle>
                <DrawerClose className="ts-link flex-none">Close</DrawerClose>
              </div>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)] tabular-nums">
                {sel.track} {clock(sel.start)}–{clock(sel.end)}
              </p>
              <div className="mt-3">{idForm}</div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* The job, as a list: every track nobody has ID'd. Easier to hit than a narrow block on the timeline. */}
      {ready && unknownCount > 0 && (
        <div className="mt-8">
          {/* Where one part shows at a time, the list is that part's, so it matches the timeline above it. */}
          <h2 className="font-display text-2xl leading-none text-[var(--text)]">
            Still unknown{many && <span className="text-[var(--muted)]"> on {sides[active]}{partName ? ` · ${partName}` : ""}</span>}
          </h2>
          {unknownHere.length === 0 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Nothing is marked as unknown on this part. {elsewhereUnknown} still unknown on {unknownParts.join(", ")}.
            </p>
          )}
          <ul className="ts-list ts-unknowns mt-3" hidden={unknownHere.length === 0}>
            {unknownHere
              .map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => seek(sides.indexOf(c.track), c.start, true)} className="ts-list-row" aria-label={`Hear side ${c.track} from ${clock(c.start)}${c.title ? `. Clue: ${c.title}` : ""}`}>
                    <span className="flex-none font-mono text-xs tabular-nums text-[var(--muted)]">
                      {c.track} {clock(c.start)}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={c.title || undefined}>{c.title ? `Clue: “${c.title}”` : "No clues yet"}</span>
                    <span className="flex-none text-xs text-[var(--muted)]">Hear it</span>
                  </button>
                  <button type="button" onClick={() => idIt(c.id)} className="ts-chip flex-none" aria-label={`ID the track at ${clock(c.start)}, side ${c.track}`}>
                    ID it
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none text-[var(--text)]">Send it in</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] text-[var(--muted)] [text-wrap:pretty]">
            What you ID here is saved on this device. To add it to the archive, copy your IDs and post them as a comment on the tape’s page. The other IDs on this timeline came from comments there.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copy} disabled={!mine.length} className="ts-btn min-w-[12.5rem]">
              {copied === "yes" ? "Copied ✓" : mine.length ? `Copy my IDs (${mine.length})` : "Copy my IDs"}
            </button>
            <Link href={`/tapes/${tape.id}`} className="ts-link">
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

        <div className="min-w-0">
          {namesTotal > 0 && (
            <Collapsible className="ts-fold" defaultOpen={namesWaiting === namesTotal}>
              <CollapsibleTrigger className="ts-fold-trigger">
                <span>{fromSite ? "The tape’s tracklist" : "A tracklist from the comments, in order"}</span>
                <span className="font-mono text-xs tabular-nums text-[var(--muted)]">{namesWaiting} without a time</span>
              </CollapsibleTrigger>
              <CollapsiblePanel className="ts-fold-panel">
                <ol className="ts-list ts-names">
                  {orders.flatMap((order, side) =>
                    order
                      .filter((l) => l.known)
                      .map((l) => {
                        // A name is on the timeline once a track there carries it: show when it plays, and go
                        // there on a click. A name with no time yet is the work still to do.
                        const at = cues.find((c) => c.track === sides[side] && c.known && isSameRecord(c, l));
                        return (
                          <li key={`${side}-${l.n}`} data-placed={at ? "" : undefined}>
                            <span className="flex-none font-mono text-xs tabular-nums text-[var(--muted)]">
                              {sides[side]} {l.n}
                            </span>
                            <span className="min-w-0 flex-1">
                              {l.artist} — {l.title}
                            </span>
                            {at ? (
                              <button type="button" onClick={() => seek(side, at.start, true)} className="ts-inline-link flex-none font-mono text-xs tabular-nums" aria-label={`Hear it at ${clock(at.start)}`}>
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
          )}
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
                      <button type="button" onClick={() => seek(p.side, p.start, true)} className="ts-list-row" aria-label={`Hear side ${sides[p.side]} at ${clock(p.start)}: ${cueLabel(toCue(p))}`}>
                        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
                          {sides[p.side]} {clock(p.start)}
                        </span>
                        <span className="min-w-0 flex-1 truncate" title={cueLabel(toCue(p))}>{cueLabel(toCue(p))}</span>
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
          <Collapsible className="ts-fold">
            <CollapsibleTrigger className="ts-fold-trigger">
              <span>What you’ve changed</span>
              <span className="font-mono text-xs tabular-nums text-[var(--muted)]">{Math.max(0, entries.length - floor)}</span>
            </CollapsibleTrigger>
            <CollapsiblePanel className="ts-fold-panel">
              {entries.length > floor ? (
                <ol className="ts-list">
                  {entries
                    .map((e, i) => ({ e, n: i + 1 }))
                    .filter((x) => x.n > floor)
                    .reverse()
                    .map(({ e, n }) => (
                      <li key={e.id} className="ts-history-row" data-undone={n > position || e.reverted ? "" : undefined}>
                        <span className="ts-source">{e.source === "agent" ? "Comments" : "You"}</span>
                        <span className="min-w-0 flex-1">
                          {describe(e)}
                          {n > position || e.reverted ? " (undone)" : ""}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="py-3 text-sm text-[var(--muted)]">Nothing yet.</p>
              )}
            </CollapsiblePanel>
          </Collapsible>
          {proposals.length > 0 && (
            <button type="button" onClick={() => void startOver()} className="ts-link -ml-2.5 mt-2 !text-[var(--muted)] hover:!text-[var(--text)]">
              Start over from the comments’ IDs
            </button>
          )}
        </div>
      </div>

      {/* Phone: play, the clock and the two ID actions stay under the thumb wherever the page is scrolled. */}
      <div className="ts-bar" role="group" aria-label="Player">
        <p className="ts-bar-now">
          <span className="min-w-0 flex-1 truncate">{audioFailed ? "This side’s audio didn’t load" : playingCue ? (playingCue.known ? cueLabel(playingCue) : "Unknown track") : "Nothing ID’d here yet"}</span>
          <span className="flex-none font-mono text-xs tabular-nums text-[var(--muted)]">
            {sides[active]} {clock(now)}
          </span>
        </p>
        <div className="ts-bar-row">
          <button type="button" onClick={toggle} disabled={audioFailed} className="ts-bar-btn ts-bar-primary">
            {playing ? "Pause" : "Play"}
          </button>
          {/* Always here, so the button beside it never moves under the thumb. */}
          <button type="button" onClick={() => playingCue && idIt(playingCue.id)} disabled={!playingCue} className="ts-bar-btn">
            {playingCue?.known ? "Fix ID" : "ID track"}
          </button>
          <button type="button" onClick={markHere} className="ts-bar-btn">
            New track
          </button>
        </div>
      </div>

      <ToastRegion toaster={toaster} side="bottom" align="center" className="ts-toasts">
        {() => (
          <Toast className="ts-toast">
            <div className="min-w-0 flex-1">
              <ToastTitle className="text-[15px] font-medium leading-snug" />
              <ToastDescription className="mt-0.5 text-sm opacity-75" />
            </div>
            <ToastAction className="ts-toast-btn" />
            <ToastClose className="ts-toast-btn" aria-label="Dismiss">
              ✕
            </ToastClose>
          </Toast>
        )}
      </ToastRegion>
    </section>
  );
}
