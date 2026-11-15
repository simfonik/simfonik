"use client";

// Trainspotter — help ID the music on a tape.
// The timeline is one UI SDK primitive (ranges on tracks). It opens showing what listeners have already
// ID'd in the comments; a visitor plays the tape and IDs what they recognise. Every change goes through the
// SDK's change pipeline, so one history gives undo and redo, and the page is operable by an agent through
// the same bridge that loads the listeners' tracklist.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPointerKind, inputHints } from "@ui-sdk/core";
import { solveSpring } from "@ui-sdk/core/gesture";
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
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { isSameRecord, reconcile, runningOrders, type Listed, type Proposal, type Sighting } from "./parse";
import { DEFAULT_LENGTH, clock, cueLabel, tracklist, type Cue } from "./tracklist-primitive";
import { TapeSwitcher, type TapeEntry } from "./tape-switcher";

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

/** A place on the tape, as the comments give it: which side, and the second a track starts. */
type Spot = { side: number; start: number };
/** The same track, give or take: comments rarely agree to the second. */
const near = (a: Spot, b: Spot) => a.side === b.side && Math.abs(a.start - b.start) <= 20;
/** Where the comments put a track that came from them (its id records it), or null for one the visitor
    marked or ID'd themselves. Still right after the visitor drags the track somewhere else. */
const origin = (c: Cue): Spot | null => {
  const from = c.by ? c.id.match(/^crowd-(\d+)-(\d+)/) : null;
  return from ? { side: Number(from[1]), start: Number(from[2]) } : null;
};
/**
 * Play, or pause while playing, as the sign everyone knows. It marks the one button here that is not an edit,
 * and it reads at a glance where a word that changes has to be read. The triangle's box sits a pixel right
 * of centre, because its weight is on its left.
 */
const PlayGlyph = ({ playing }: { playing: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
    {playing ? <path d="M2 1h3.5v12H2zM8.5 1H12v12H8.5z" /> : <path d="M3 1l10 6-10 6z" />}
  </svg>
);

/** What is kept in this browser for a tape. */
type Saved = { v: 2; cues: Cue[]; removed: Spot[]; /** The comment tracks whose times this visitor set themselves, by id. */ moved?: string[] };

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
  others: TapeEntry[];
}) {
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
  // The comment tracks this visitor took off the timeline, by where the comments have them. This record is
  // the only thing that keeps a comment's track away: on a return visit, a track the comments have and the
  // timeline lacks is put back unless it is listed here. Before, the page only remembered which tracks it
  // had once shown, so one that went missing for any other reason stayed missing for good.
  const gone = useRef<Spot[]>([]);
  // The comment tracks whose start or end this visitor has set: dragged, trimmed, nudged, or cut short by a
  // track marked inside them. Those times are theirs. Every other comment track keeps following the comments,
  // times included. `null` for work saved before this was recorded.
  const moved = useRef<Set<string> | null>(new Set());
  useEffect(() => {
    let saved: unknown = null;
    let legacy = false;
    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      legacy = window.localStorage.getItem(`${storageKey}:seen`) !== null;
    } catch {
      /* nothing saved, or storage is unavailable */
    }
    // Two shapes: today's, and the bare list of tracks that earlier versions of this page saved. A bare
    // empty list with no sign the page ever finished opening is a first visit that was cut short.
    const current = saved && typeof saved === "object" && !Array.isArray(saved) && Array.isArray((saved as Saved).cues) ? (saved as Saved) : null;
    const earlier = Array.isArray(saved) && (saved.length > 0 || legacy) ? (saved as Cue[]) : null;
    const found = current ?? (earlier ? { cues: earlier, removed: [] } : null);
    if (found) {
      setCues(found.cues);
      gone.current = Array.isArray(found.removed) ? found.removed : [];
      moved.current = Array.isArray((found as Saved).moved) ? new Set((found as Saved).moved) : null;
      setReady(true);
    }
    setRestored(found ? "saved" : "fresh");
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ v: 2, cues, removed: gone.current, moved: [...(moved.current ?? [])] } satisfies Saved));
      window.localStorage.removeItem(`${storageKey}:seen`); // the earlier versions' bookkeeping
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
  // The playhead is one element: the marker on the ruler and the line down the side that is playing. It is
  // moved by a single transform, once per frame, from one time. While the marker is being dragged that time
  // is the dragged one (scrubT), so marker and line stay under the pointer instead of trailing the audio.
  const headRef = useRef<HTMLDivElement>(null);
  const scrubT = useRef<number | null>(null);
  // Layout the frame loop needs, kept in refs so it never measures the page while it draws.
  const widthRef = useRef(0); // the tape, in px
  const availRef = useRef(0); // the scroller's visible width, in px
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
    // More tape to the right of what's on screen: the stylesheet fades that edge.
    sc.toggleAttribute("data-more", sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2);
  }, []);
  const handsOff = useRef(0); // until when the visitor's own scrolling is left alone
  const sheetOpen = useRef(false);
  const lastSecond = useRef(-1);
  // The tape's glide to the playhead after a seek, and until when a key press asks for no glide at all.
  const glide = useRef<{ spring: ReturnType<typeof solveSpring>; t0: number; to: number } | null>(null);
  const snapUntil = useRef(0);
  const reduceMotion = useRef(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => {
      reduceMotion.current = q.matches;
    };
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  const paint = useCallback(() => {
    const a = audios.current[activeRef.current];
    const t = scrubT.current ?? a?.currentTime ?? 0;
    const part = Math.min(1, t / lengthRef.current);
    const x = part * widthRef.current;
    // Whole device pixels: a 1px line drawn between two pixels is smeared across both.
    const dpr = window.devicePixelRatio || 1;
    const snap = (px: number) => Math.round(px * dpr) / dpr;
    if (headRef.current) headRef.current.style.transform = `translate3d(${snap(x)}px, 0, 0)`;
    // Where the tape is wider than the screen, the tape follows the playhead. Three kinds of movement, each
    // chosen for what caused it:
    //  · Playing along: the playhead rides at a fixed spot a little past the middle and the tape slides under
    //    it at the speed of the music, under a pixel a frame. What is coming is always in view, and the
    //    playhead never reaches the faded edge. This replaces turning the page when it hit the edge, which
    //    moved the whole row in a single frame.
    //  · After a click that lands the playhead far from that spot: a short spring to it. A spring, because a
    //    second click mid-flight should bend the motion, not restart it; no bounce, settled in about a third of a second.
    //  · After a key press: no animation. The tape is simply there. Keys are for moving fast.
    // With reduced motion there is no sliding at all: the tape turns the page, just before the faded edge.
    // None of it while the visitor is looking somewhere else (they scrolled there, or the ID sheet did).
    const sc = scrollerRef.current;
    const visible = availRef.current - GUTTER;
    const far = Math.max(0, widthRef.current + GUTTER - availRef.current); // the furthest the tape can scroll
    const following = sc && a && !a.paused && scrubT.current === null && !sheetOpen.current && performance.now() > handsOff.current && far > 4;
    if (!following) glide.current = null;
    else {
      const nowMs = performance.now();
      const at = x - sc.scrollLeft; // where the playhead is, across the visible tape
      const ride = visible * 0.6;
      if (reduceMotion.current) {
        if (at > visible * 0.85 || at < 0) sc.scrollLeft = Math.max(0, Math.min(x - visible * 0.15, far));
      } else {
        const target = at > ride ? x - ride : at < 0 ? x - visible * 0.15 : null;
        const want = target === null ? null : Math.max(0, Math.min(target, far));
        let g = glide.current;
        // A new goal while still moving: carry on from here at the speed it already has.
        if (g && want !== null && Math.abs(want - g.to) > 3) g = glide.current = { spring: solveSpring(0.24, 1, sc.scrollLeft - want, g.spring.velocity(nowMs - g.t0)), t0: nowMs, to: want };
        if (g) {
          const off = g.spring.position(nowMs - g.t0);
          const done = Math.abs(off) < 0.5 && Math.abs(g.spring.velocity(nowMs - g.t0)) < 0.005;
          sc.scrollLeft = done ? g.to : g.to + off;
          if (done) glide.current = null;
        } else if (want !== null) {
          const gap = want - sc.scrollLeft;
          if (Math.abs(gap) < 3 || nowMs < snapUntil.current) sc.scrollLeft = want;
          else glide.current = { spring: solveSpring(0.24, 1, -gap, 0), t0: nowMs, to: want };
        }
      }
    }
    if (mapHeadRef.current) mapHeadRef.current.style.transform = `translate3d(${snap(part * Math.max(0, visible))}px, 0, 0)`;
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
      // A time changed by anything but the page's own writing from the comments is the visitor's.
      if (!quiet.current)
        for (const c of v) {
          const was = cuesRef.current.find((b) => b.id === c.id);
          if (was && c.by && (was.start !== c.start || was.end !== c.end)) (moved.current ??= new Set()).add(c.id);
        }
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

  // First visit to a tape: open with what is already known. This doesn't wait for the audio.
  const opening = useRef(false);
  useEffect(() => {
    if (restored !== "fresh" || opening.current) return;
    opening.current = true;
    void (async () => {
      if (proposals.length) {
        // Giving up here would show an empty tape and then save it as this visitor's work.
        if (!(await writeWhenReady(proposals.map(toCue)))) {
          opening.current = false; // nothing saved; the next visit starts clean
          return;
        }
        setFloor(historyRef.current?.position() ?? 0);
      }
      setReady(true);
    })();
  }, [restored, proposals, toCue, writeWhenReady]);

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

  // Return visit: the timeline is brought back in line with the comments. Nobody approves any of it.
  //  · A track that came from the comments follows the comments. If they no longer have anything there, it
  //    goes; if they now say something else there, it takes that name, and their times with it. That is
  //    what clears a misreading once the reader is fixed, instead of leaving it in every browser that saved
  //    it. Times the visitor set themselves are kept.
  //  · A track the comments have and the timeline lacks is put back, unless the visitor removed it. That
  //    covers what was posted since the last visit and anything that went missing for any other reason.
  //  · A track the visitor marked or ID'd themselves is never touched.
  const merged = useRef(false);
  useEffect(() => {
    if (restored !== "saved" || merged.current) return;
    merged.current = true;
    let added = 0;
    let corrected = 0;
    let removed = 0;
    const next = cuesRef.current.flatMap((c) => {
      const from = origin(c);
      if (!from) return [c];
      const p = proposals.find((x) => near(x, from));
      if (!p) {
        removed++;
        return [];
      }
      // Its times follow the comments too, unless the visitor set them. Otherwise a track the comments now
      // end sooner (someone timed another one inside it) would run on over its new neighbour. For work saved
      // before the page recorded whose times were whose, a start still where the comments put it is theirs.
      const mine = moved.current ? moved.current.has(c.id) : c.start !== from.start;
      // (The last track on a side keeps its end: the comments only guess it, and the page has since cut it to
      // the side's real length.)
      const last = !proposals.some((x) => x.side === p.side && x.start >= p.end);
      const next = { ...c, ...(mine ? {} : { start: p.start, end: last ? c.end : p.end, open: last ? c.open : p.open }), artist: p.artist, title: p.title, known: p.known, by: p.author };
      if (next.start === c.start && next.end === c.end && next.artist === c.artist && next.title === c.title && next.known === c.known) return [c];
      corrected++;
      return [next];
    });
    for (const p of proposals) {
      if (gone.current.some((spot) => near(spot, p))) continue;
      // Already there: a track that came from this spot (wherever it has been dragged), or any track at it.
      const there = next.some((c) => {
        const from = origin(c);
        return (from && near(from, p)) || near({ side: sides.indexOf(c.track), start: c.start }, p);
      });
      if (there) continue;
      next.push({ ...toCue(p), id: `crowd-${p.side}-${p.start}-${Date.now().toString(36)}` });
      added++;
    }
    if (!added && !corrected && !removed) return;
    void writeWhenReady(next).then((ok) => {
      if (!ok) return;
      const parts = [added ? `added ${added}` : "", corrected ? `corrected ${corrected}` : "", removed ? `removed ${removed} misread` : ""].filter(Boolean).join(", ");
      confirmWithUndo(`Updated from the comments: ${parts}.`);
    });
    // Runs once, with the comments as they are when saved work has been restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const startOver = async () => {
    gone.current = []; // starting over forgets what was removed, too
    moved.current = new Set(); // and whose times were whose
    if (await writeAsListeners(proposals.map(toCue))) {
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
  // The hint already knows the platform: it writes ⌘ on a Mac and Ctrl elsewhere.
  const onMac = undoHint.text.includes("⌘");
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
      snapUntil.current = performance.now() + 600; // a key press: the tape goes there without a glide
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
  // Which track on the timeline carries each listed name. A record played twice is listed twice, and the
  // first listing is the earlier track: each track answers for one line of the list.
  const placed = useMemo(
    () =>
      orders.map((order, side) => {
        const here = cues.filter((c) => c.track === sides[side] && c.known).sort((a, b) => a.start - b.start);
        const taken = new Set<string>();
        const at = new Map<Listed, Cue>();
        for (const l of order) {
          const cue = l.known ? here.find((c) => !taken.has(c.id) && isSameRecord(c, l)) : undefined;
          if (!cue) continue;
          taken.add(cue.id);
          at.set(l, cue);
        }
        return at;
      }),
    [orders, cues, sides],
  );
  const waiting = useMemo(() => orders.map((order, side) => order.filter((l) => l.known && !placed[side].has(l))), [orders, placed]);
  const namesTotal = orders.reduce((n, o) => n + o.filter((l) => l.known).length, 0);
  const namesWaiting = waiting.reduce((n, w) => n + w.length, 0);

  const sel = cues.find((c) => c.id === selected) ?? null;
  // The track the ID fields are about: the one picked, or failing that the one under the playhead. So the
  // fields are always there and always about something: press play, hear a track you know, and type. Putting
  // the cursor in a field picks that track, so it stays put while the tape plays on to the next one.
  const subject = sel ?? playingCue;
  // For an unknown track, the names most likely to belong to it. A listed name with no time still has a
  // place: after the last line before it whose time is known, and before the next one. Names whose place takes
  // in this track come first; after those, the ones nearest it in the order. A track the list itself marks
  // unknown at this spot gets no names from it: its keeper has every other line down as some other track.
  const nextNames = useMemo(() => {
    if (!subject || subject.known) return [];
    const side = sides.indexOf(subject.track);
    const order = orders[side] ?? [];
    const at = placed[side];
    const when = (l: Listed) => at?.get(l)?.start ?? l.at;
    if (order.some((l) => !l.known && l.at !== undefined && Math.abs(l.at - subject.start) <= 20)) return [];
    const before = cues.filter((c) => c.track === subject.track && c.start < subject.start).length;
    const outside = (l: Listed) => {
      const i = order.indexOf(l);
      const lo = order.slice(0, i).map(when).findLast((t) => t !== undefined) ?? -Infinity;
      const hi = order.slice(i + 1).map(when).find((t) => t !== undefined) ?? Infinity;
      return subject.start < lo ? lo - subject.start : subject.start > hi ? subject.start - hi : 0;
    };
    return (waiting[side] ?? [])
      .map((l) => ({ l, out: outside(l), d: Math.abs(l.n - 1 - before) }))
      .sort((a, b) => a.out - b.out || a.d - b.d)
      .slice(0, 3)
      .map((x) => x.l)
      .sort((a, b) => a.n - b.n);
  }, [subject, sides, orders, waiting, placed, cues]);
  // What else people said about that track's moment.
  const opinions = useMemo(() => {
    if (!subject) return [];
    const side = sides.indexOf(subject.track);
    return proposals.find((p) => p.side === side && Math.abs(p.start - subject.start) <= 20)?.also ?? [];
  }, [subject, sides, proposals]);

  // An unknown track's "title" is only a listener's clue ("you can't run"), so it never pre-fills the field.
  const shownTitle = subject?.known ? subject.title : "";
  const [draft, setDraft] = useState({ artist: "", title: "" });
  useEffect(() => {
    setDraft({ artist: subject?.artist ?? "", title: shownTitle });
  }, [subject?.id, subject?.artist, shownTitle]);
  // The picked track is let go when the playhead leaves it, by the tape playing on or by being moved. From
  // then on the fields, and the bar on a phone, are about what you are hearing, not what you tapped a minute
  // ago. Not while you are IDing it: the sheet open, the cursor in a field, or something typed and not saved.
  const heard = useRef<string | null>(null);
  useEffect(() => {
    const was = heard.current;
    heard.current = playingCue?.id ?? null;
    if (was === null || was === heard.current || selected !== was) return;
    const typed = draft.artist.trim() !== (sel?.artist ?? "") || draft.title.trim() !== (sel?.known ? sel.title : "");
    if (!sheetOpen.current && !document.activeElement?.closest(".ts-idbar-fields") && !typed) setSelected(null);
    // Only when the track under the playhead changes; what was picked and typed is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingCue?.id]);
  const saveId = (artist = draft.artist, title = draft.title) => {
    const a = artist.trim();
    const t = title.trim();
    if (!subject || (a === subject.artist && t === shownTitle)) return false;
    if (!a && !t) {
      // Both fields emptied on an ID'd track: that is how it goes back to unknown. On an unknown one there
      // is nothing to save.
      if (!subject.known) return false;
      api.renameCue(subject.id, "", "");
      confirmWithUndo("Set back to unknown.");
      return true;
    }
    api.renameCue(subject.id, a, t);
    confirmWithUndo(`ID’d: ${[a, t].filter(Boolean).join(" — ")}`, "Saved on this device.");
    return true;
  };
  const remove = (cue: Cue | null = subject) => {
    if (!cue) return;
    // Keep the keyboard somewhere useful: the next track on that side, or the one before.
    const row = cuesRef.current.filter((c) => c.track === cue.track).sort((a, b) => a.start - b.start);
    const i = row.findIndex((c) => c.id === cue.id);
    const neighbour = row[i + 1] ?? row[i - 1];
    // Removing a track the comments supplied is remembered, so it doesn't come back on the next visit.
    const from = origin(cue);
    if (from) gone.current = [...gone.current.filter((spot) => !near(spot, from)), from];
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
    el.addEventListener("pointerup", hold); // counted from letting go: a long drag must not end in the view springing away
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
      el.removeEventListener("pointerup", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchstart", hold);
    };
  }, [paint, frame]);
  // Fit the whole side when there is room for it to stay readable; otherwise keep a fixed scale and scroll.
  const fit = avail - GUTTER - 2;
  const ppm = touch ? PPM_TOUCH : PPM;
  const width = fit >= (length / 60) * ppm ? fit : Math.round((length / 60) * ppm);
  widthRef.current = width;
  availRef.current = avail;
  const minutes = Math.ceil(length / 60);
  // The playhead's line runs down the row of the side that is playing. Measured when that changes, not per frame.
  useLayoutEffect(() => {
    const head = headRef.current;
    const canvas = head?.parentElement;
    const row = canvas?.querySelectorAll<HTMLElement>(".ts-row")[many ? 0 : active];
    if (!head || !canvas || !row) return;
    const box = row.getBoundingClientRect();
    head.style.setProperty("--row-top", `${box.top - canvas.getBoundingClientRect().top}px`);
    head.style.setProperty("--row-h", `${box.height}px`);
    // On its way to a lower row the line only passes through the rows above, so it is drawn faint there.
    head.style.setProperty("--pass", many || active === 0 ? "1" : "0.3");
  }, [active, many, sides.length, avail]);
  // More tape than fits: the overview strip shows the rest and takes you there.
  const scrolls = avail > 0 && width > fit + 1;
  useEffect(() => {
    paint(); // the playhead is placed in pixels, so it moves when the scale does
    frame();
  }, [width, length, paint, frame, scrolls, active]);
  // Press or drag on the overview: bring that part of the tape to the middle of the screen.
  const mapTo = (e: React.PointerEvent<HTMLDivElement>, released = false) => {
    const sc = scrollerRef.current;
    if (!sc || !(released || e.buttons & 1)) return;
    const box = e.currentTarget.getBoundingClientRect();
    const at = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    handsOff.current = performance.now() + 5000; // the visitor is steering; don't snap back to the playhead
    sc.scrollLeft = at * (sc.scrollWidth - GUTTER) - (sc.clientWidth - GUTTER) / 2;
  };
  // A finger on the overview may be on its way down the page. The strip takes a sideways drag, or a tap (on
  // release); a swipe up or down is the page's, and the browser tells us so by cancelling the touch.
  const mapTouch = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const mapDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") {
      mapTouch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    mapTo(e);
  };
  const mapMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return mapTo(e);
    const t = mapTouch.current;
    if (!t || t.id !== e.pointerId) return;
    if (!t.dragging) {
      const dx = Math.abs(e.clientX - t.x);
      if (dx < 6 || dx <= Math.abs(e.clientY - t.y)) return;
      t.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    mapTo(e);
  };
  const mapUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = mapTouch.current;
    mapTouch.current = null;
    if (t && t.id === e.pointerId && !t.dragging && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 6) mapTo(e, true);
  };

  // Scrubbing: the marker follows the finger at once; the audio follows a few times a second and settles on
  // release, so one drag is a handful of requests to the audio host instead of dozens.
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const lastSeek = useRef(0);
  const scrubTo = (t: number) => {
    setScrubAt(t);
    scrubT.current = t;
    paint(); // marker and line move with the pointer now; the audio catches up below
    if (performance.now() - lastSeek.current > 120) {
      lastSeek.current = performance.now();
      seek(activeRef.current, t);
    }
  };
  // While the ruler is held, the time comes from where the pointer is on the tape, not from the slider. The
  // slider measures its track once, at the press, so its value goes stale as soon as the tape moves under
  // the pointer. And the tape does move: held near either end of what is on screen, it scrolls that way,
  // faster the nearer the edge, with the playhead staying under the pointer. Without that, a finger could
  // only reach the part of a long tape that happened to be on screen.
  const held = useRef<{ id: number; x: number; left: number; right: number; origin: number; grab: number; carry: number; last: number; frame: number } | null>(null);
  const heldTime = () => {
    const h = held.current!;
    const along = (h.x - h.origin + (scrollerRef.current?.scrollLeft ?? 0)) / Math.max(1, widthRef.current);
    return Math.max(0, Math.min(sideLength(activeRef.current), Math.max(0, Math.min(1, along)) * lengthRef.current + h.grab));
  };
  const scrub = (v: number | number[]) => scrubTo(held.current ? heldTime() : Math.min(v as number, sideLength(activeRef.current)));
  const scrubEnd = (v: number | number[]) => {
    const t = held.current ? heldTime() : Math.min(v as number, sideLength(activeRef.current));
    scrubT.current = null;
    seek(activeRef.current, t);
    setScrubAt(null);
  };
  const scrubToRef = useRef(scrubTo);
  scrubToRef.current = scrubTo;
  const scrubEndRef = useRef(scrubEnd);
  scrubEndRef.current = scrubEnd;
  const rulerPress = useRef<AbortController | null>(null);
  const rulerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollerRef.current;
    if (!sc || (e.pointerType === "mouse" && e.button !== 0)) return;
    rulerPress.current?.abort();
    const press = (rulerPress.current = new AbortController());
    const view = sc.getBoundingClientRect();
    const h = { id: e.pointerId, x: e.clientX, left: view.left, right: view.right, origin: e.currentTarget.getBoundingClientRect().left + sc.scrollLeft, grab: 0, carry: 0, last: performance.now(), frame: 0 };
    held.current = h;
    // Taken by its handle, the playhead keeps the distance it had from the pointer instead of jumping to it.
    if ((e.target as HTMLElement).closest(".ts-scrub-thumb")) h.grab = (scrubT.current ?? audios.current[activeRef.current]?.currentTime ?? 0) - heldTime();
    // Sideways only, and by the clock, so it is the same speed on any screen. The band on the left starts
    // past the side's label, which stays put over the tape.
    const EDGE = 48;
    const tick = (now: number) => {
      if (held.current !== h) return;
      const dt = Math.min(0.05, (now - h.last) / 1000);
      h.last = now;
      const lo = h.left + GUTTER + EDGE;
      const hi = h.right - EDGE;
      const push = h.x > hi ? Math.min(1, (h.x - hi) / EDGE) : h.x < lo ? -Math.min(1, (lo - h.x) / EDGE) : 0;
      h.carry = push ? h.carry + push * (reduceMotion.current ? 420 : 840) * dt : 0;
      const step = Math.trunc(h.carry);
      if (step) {
        h.carry -= step;
        const before = sc.scrollLeft;
        sc.scrollLeft = before + step;
        if (sc.scrollLeft !== before) scrubToRef.current(heldTime());
      }
      h.frame = requestAnimationFrame(tick);
    };
    h.frame = requestAnimationFrame(tick);
    press.signal.addEventListener("abort", () => cancelAnimationFrame(h.frame));
    window.addEventListener("pointermove", (ev) => ev.pointerId === h.id && (h.x = ev.clientX), { signal: press.signal });
    // The slider only reports the end of a drag whose value changed. A drag that comes back to where it began
    // would leave the playhead held at the drag's time with the audio running on, so the press itself ends
    // the scrub on release, once the slider has had its turn.
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== h.id) return;
      press.abort();
      setTimeout(() => {
        const t = scrubT.current;
        if (held.current === h) held.current = null;
        if (t !== null) scrubEndRef.current(t);
      }, 0);
    };
    window.addEventListener("pointerup", up, { signal: press.signal });
    window.addEventListener("pointercancel", up, { signal: press.signal });
  };
  useEffect(
    () => () => {
      rulerPress.current?.abort();
      held.current = null;
    },
    [],
  );

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
  // What is on screen: the one part of a multi-part tape, else the whole tape. The intro and the lines shown
  // when nothing is picked speak about this, so they never mention tracks that are on some other part.
  const here = ready ? cues.filter((c) => !many || c.track === sides[active]) : proposals.filter((p) => !many || p.side === active);
  const audioFailed = failed[active];

  // The unknown list follows the timeline: every side of a two-sided tape, or the one part on screen.
  const unknownHere = cues.filter((c) => !c.known && (!many || c.track === sides[active])).sort((a, b) => a.track.localeCompare(b.track) || a.start - b.start);
  const elsewhereUnknown = cues.filter((c) => !c.known && c.track !== sides[active]).length;
  const unknownParts = sides.filter((k) => k !== sides[active] && cues.some((c) => !c.known && c.track === k));
  // A compilation is named by its title and the part being heard, not by a line of eight DJs.
  const compactTitle = tape.djCount > 3;
  const partTitle = (i: number) => (tape.sides[i]?.title && !/^side\b/i.test(tape.sides[i].title) ? tape.sides[i].title : null);
  const partName = partTitle(active);
  // What to do, in one line, always the same shape: press play and do one thing. The counts are in the list
  // of tapes and the lists below.
  const intro =
    namesWaiting > 0 && fromSite
      ? "We know the tracklist but not the times. Press play and mark where each track starts."
      : // Names someone listed in a comment are a start, not the tracklist.
        namesWaiting > 0 && !counted.length
        ? "Some tracks are named in the comments, without times. Press play and mark where each one starts."
        : here.length
        ? here.some((c) => !c.known)
          ? "Press play and help ID the unknowns."
          : "Press play and mark any track that’s missing."
        : "Press play and mark the first track you know.";

  // The ID form: inline under the timeline with a mouse, in a sheet above the keyboard on a phone.
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

  // Everything else the page can do is shown where it happens: the time under the pointer, the grips on a
  // track. The keys are a click away for whoever wants them.
  const shortcuts = (
    <Popover>
      <PopoverTrigger className="ts-link ts-fine-only">Keyboard shortcuts</PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={6} className="ts-keys">
        <PopoverTitle className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Keyboard shortcuts</PopoverTitle>
        <dl>
          {[
            ["Space", "Play or pause"],
            ["← →", "Previous or next track"],
            ["M", "Mark new track"],
            // Keys are named the way they are printed on the keyboard in front of the visitor.
            [onMac ? "Return" : "Enter", "ID the selected track"],
            ["Delete", "Remove it"],
            [onMac ? "⌥ ← →" : "Alt ← →", "Move it a second"],
            [onMac ? "⌥ ⇧ ← →" : "Alt Shift ← →", "Trim where it ends"],
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
  );

  // The two fields, shared by the bar under the timeline (mouse) and the sheet (phone).
  const fields = (artistId: string) => (
    <>
      <Field className="min-w-0 flex-1 basis-40" disabled={!subject}>
        <FieldLabel className="ts-label">Artist</FieldLabel>
        <Input
          id={artistId}
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
      <Field className="min-w-0 flex-[1.4] basis-48" disabled={!subject}>
        <FieldLabel className="ts-label">Title</FieldLabel>
        <Input data-title value={draft.title} onValueChange={(v: string) => setDraft((d) => ({ ...d, title: v }))} {...nameHints("done")} className="ts-input" />
      </Field>
    </>
  );
  const pickedBlock = () => scrollerRef.current?.querySelector("[data-selected]") as HTMLElement | null;
  const otherIds = opinions.map((o, i) => (
    <span key={i}>
      {i > 0 ? " " : ""}
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
  ));

  // With a mouse: the ID bar under the timeline. It is always there and always the same height, whatever is
  // picked or playing: two fields and their buttons, then one line that holds whichever applies (what to do,
  // likely names from the tracklist, other people's IDs, a clue) beside undo, redo and the keys. Built to
  // appear only once a track was picked, it pushed the rest of the page down on the first click, again when
  // a clue turned up mid-typing, and again when suggestions did.
  const barForm = (
    <form
      className="ts-idbar"
      onSubmit={(e) => {
        e.preventDefault();
        saveId();
      }}
      // Leaving the bar saves. Moving between its fields and buttons does not.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) saveId();
      }}
      // Escape abandons what was typed.
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !subject) return;
        setDraft({ artist: subject.artist, title: shownTitle });
        pickedBlock()?.focus();
      }}
    >
      <div
        className="ts-idbar-fields"
        // Typing about the track under the playhead picks it, so the fields don't move on when the tape does.
        onFocus={() => {
          if (!sel && playingCue) setSelected(playingCue.id);
        }}
      >
        {fields("ts-artist")}
        <div className="flex flex-none items-center gap-2">
          <button type="submit" disabled={!subject} className="ts-btn ts-btn-solid">
            Save
          </button>
          {/* Pulled out by its own padding, so its last letter ends where "Keyboard shortcuts" below it does. */}
          <button type="button" disabled={!subject} onClick={() => remove()} className="ts-link -mr-2.5" data-agent-confirm="Remove this track from the tracklist?">
            Remove
          </button>
        </div>
      </div>
      <div className="ts-idbar-foot">
        <div className="ts-idbar-context">
          {!subject ? (
            here.length ? (
              "Click a track to play it and ID it."
            ) : (
              "Nothing marked yet. Play, then “Mark new track”."
            )
          ) : nextNames.length > 0 ? (
            <>
              <span className="flex-none">{fromSite ? "From the tracklist:" : `From ${nextNames[0].author}’s list:`}</span>
              {nextNames.map((l) => (
                <button
                  key={`${l.side}-${l.n}`}
                  type="button"
                  onClick={() => {
                    saveId(l.artist, l.title);
                    requestAnimationFrame(() => pickedBlock()?.focus());
                  }}
                  className="ts-chip ts-chip-inline"
                  title={`${l.artist} — ${l.title}`}
                >
                  <span className="font-mono text-xs tabular-nums opacity-70">{l.n}</span>
                  <span className="truncate">
                    {l.artist} — {l.title}
                  </span>
                </button>
              ))}
            </>
          ) : opinions.length > 0 ? (
            <span className="truncate">{otherIds}</span>
          ) : !subject.known && subject.title && subject.id !== playingCue?.id ? (
            // The player already shows the clue of the track that is playing; this is for one that isn't.
            <span className="truncate">
              Clue from {subject.by ?? "a comment"}: “{subject.title}”
            </span>
          ) : null}
        </div>
        <div className="-mr-2.5 flex flex-none items-center gap-1">
          {undoRedo}
          {shortcuts}
        </div>
      </div>
    </form>
  );

  // On a phone the same job is a sheet that stays above the keyboard. Height is free there, so the likely
  // names and the clue get lines of their own.
  const sheetForm = sel && (
    <form
      className="ts-nameform"
      onSubmit={(e) => {
        e.preventDefault();
        saveId();
        closeSheet();
      }}
    >
      {/* One-tap answers come before the fields that need typing. */}
      {nextNames.length > 0 && (
        <div className="w-full">
          <p className="ts-label">{fromSite ? "Is it one of these, from the tape’s tracklist?" : `Is it one of these, from ${nextNames[0].author}’s list?`}</p>
          <div className="flex flex-wrap gap-2">
            {nextNames.map((l) => (
              <button
                key={`${l.side}-${l.n}`}
                type="button"
                onClick={() => {
                  saveId(l.artist, l.title);
                  closeSheet();
                }}
                className="ts-chip"
              >
                <span className="font-mono text-xs tabular-nums opacity-70">{l.n}</span> {l.artist} — {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* The sheet covers the player, so the clue is said here. */}
      {!sel.known && sel.title && (
        <p className="w-full text-[15px] text-[var(--text)]">
          Clue from {sel.by ?? "a comment"}: “{sel.title}”
        </p>
      )}
      {fields("ts-artist-sheet")}
      <div className="flex flex-none flex-wrap items-end gap-2">
        <button type="submit" className="ts-btn ts-btn-solid">
          Save
        </button>
        {/* The sheet covers the timeline, so this is the way to hear the track again from here. */}
        <button type="button" onClick={() => seek(sides.indexOf(sel.track), sel.start, true)} className="ts-link">
          Replay
        </button>
        <button type="button" onClick={() => remove()} className="ts-link" data-agent-confirm="Remove this track from the tracklist?">
          Remove
        </button>
      </div>
      {opinions.length > 0 && <p className="w-full text-sm text-[var(--muted)]">{otherIds}</p>}
    </form>
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
        <TapeSwitcher tapes={others} currentId={tape.id} />
        {/* Above the title: its tall letters reach up past their own line and would otherwise sit over this link. */}
        <p className="relative z-[1] -mr-[0.14em] font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Released {tape.released} ·{" "}
          <Link href={`/tapes/${tape.id}`} className="ts-inline-link">
            Tape page
          </Link>
        </p>
      </div>
      <h1 className="-ml-[0.038em] mt-5 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-6xl">
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
        <button type="button" onClick={toggle} disabled={audioFailed} className="ts-btn ts-btn-solid ts-play" aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space">
          <PlayGlyph playing={playing} />
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
                : "Know what’s playing? Mark it."}
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
            <div className="ts-ruler" style={{ marginLeft: GUTTER, width }} onPointerDownCapture={rulerDown}>
              <Slider value={Math.min(scrubAt ?? now, length)} onValueChange={scrub} onValueCommit={scrubEnd} min={0} max={length} step={1} largeStep={15} format={clock}>
                <SliderControl
                  className="ts-scrub"
                  // A press focuses the handle, and browsers show a focus ring for it as if it were keyboard
                  // focus (on a phone, a box around the marker for as long as it stays focused). The ring is
                  // for the keyboard: a press silences it until a key is used or focus leaves.
                  onPointerDownCapture={(e: React.PointerEvent<HTMLElement>) => e.currentTarget.setAttribute("data-quiet", "")}
                  onKeyDownCapture={(e: React.KeyboardEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-quiet")}
                  onBlur={(e: React.FocusEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-quiet")}
                >
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
            {/* The playhead. One element, so the marker and the line cannot part company: built as two, the
                marker (a slider handle, placed in percent once a second) ticked along while the line (placed in
                pixels every frame) glided, and they could sit a pixel apart. The slider's handle is still under
                the marker, invisible, for dragging and for the keyboard. */}
            <div ref={headRef} className="ts-head" style={{ left: GUTTER }} aria-hidden>
              {/* The cap: drawn as a path, not clipped from a box, so its curves and its point are exact. Eleven
                  wide around a one-pixel line, so its point lands dead centre on the line. */}
              <svg className="ts-head-cap" width="11" height="13" viewBox="0 0 11 13">
                <path d="M2 0h7a2 2 0 0 1 2 2v4.4L5.5 13 0 6.4V2a2 2 0 0 1 2-2Z" />
              </svg>
              <span className="ts-head-pole" />
              <span className="ts-head-pass" />
              <span className="ts-head-line" />
            </div>
            <div ref={ghostRef} className="ts-ghost" aria-hidden>
              <span className="ts-ghost-time">
                <b className="font-normal" />
                <span />
              </span>
            </div>
          </div>
        </div>
        {/* The whole tape at a glance, when it doesn't all fit: the rows above in miniature, drawn the same way
            (grey for ID'd, hatched for unknown, solid for what's playing), with the part that is off screen
            dimmed and a frame around what is on screen. Press or drag it to go there (a finger: tap, or drag sideways). It is a second
            way to scroll, so it stays out of the accessibility tree; the timeline itself scrolls for everyone. */}
        {scrolls && (
          <div
            ref={mapRef}
            className="ts-map"
            style={{ marginLeft: GUTTER }}
            aria-hidden
            onPointerDown={mapDown}
            onPointerMove={mapMove}
            onPointerUp={mapUp}
            onPointerCancel={() => {
              mapTouch.current = null;
            }}
          >
            {/* Inside a clipped box of its own, so the frame can dim everything outside itself. */}
            <div className="ts-map-tape">
              {tape.sides.map((side, i) =>
                many && i !== active ? null : (
                  <div key={side.key} className="ts-map-lane">
                    {durations[i] !== null && durations[i]! < length && <span style={{ left: `${(durations[i]! / length) * 100}%` }} />}
                    {cues
                      .filter((c) => c.track === side.key)
                      .map((c) => (
                        <i key={c.id} data-known={c.known ? "" : undefined} data-playing={c.id === playingCue?.id ? "" : undefined} style={{ left: `${(c.start / length) * 100}%`, width: `${((c.end - c.start) / length) * 100}%` }} />
                      ))}
                  </div>
                ),
              )}
              <div ref={mapHeadRef} className="ts-map-head" />
              <div ref={mapWindowRef} className="ts-map-window" />
            </div>
          </div>
        )}
      </div>

      {/* Under the timeline. Both layouts are in the page and the stylesheet shows the one that fits the
          pointer, so a phone never paints the mouse layout first and then swaps it. Each keeps one height in
          every state. */}
      <div className="ts-namebar">
        <div className="ts-fine-only">{barForm}</div>
        {/* Phone: the track's name, what to do with it and its ID button are all in the bar pinned to the
            bottom of the screen, once. Undo and Redo are what is left here. */}
        <div className="ts-coarse-only">
          <div className="-mr-2.5 flex h-11 items-center justify-end gap-1">{undoRedo}</div>
        </div>
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
              <div className="mt-3">{sheetForm}</div>
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
                <span>{fromSite ? "The tape’s tracklist" : "Named in the comments, without times"}</span>
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
        {/* Two lines, always: artist over title, as on a record's label. On one line a name was cut off after a
            few words, and this is the only place a phone shows it. They are about the track the button acts
            on (the one tapped, else the one playing, the same rule as the fields on a desktop). When there is
            no such track, the second line says what to do. */}
        <div className="ts-bar-now">
          <p className="ts-bar-line">
            <span className="min-w-0 flex-1 truncate">
              {audioFailed ? "This side’s audio didn’t load" : subject ? (subject.known ? subject.artist || subject.title : "Unknown track") : here.length ? "Nothing ID’d here yet" : "Nothing marked yet"}
            </span>
            <span className="flex-none font-mono text-xs font-normal tabular-nums text-[var(--muted)]">
              {sides[active]} {clock(now)}
            </span>
          </p>
          <p className="ts-bar-line ts-bar-sub">
            <span className="min-w-0 flex-1 truncate">
              {audioFailed
                ? ""
                : subject
                  ? subject.known
                    ? subject.artist
                      ? subject.title
                      : ""
                    : subject.title
                      ? `Clue: “${subject.title}”`
                      : "Nobody has ID’d it yet"
                  : here.length
                    ? "Tap a track to play it, then “ID track”."
                    : "Play, then tap “New track”."}
            </span>
          </p>
        </div>
        <div className="ts-bar-row">
          <button type="button" onClick={toggle} disabled={audioFailed} className="ts-bar-btn ts-bar-primary" aria-label={playing ? "Pause" : "Play"}>
            <PlayGlyph playing={playing} />
          </button>
          {/* Always here, so the button beside it never moves under the thumb. */}
          <button type="button" onClick={() => subject && idIt(subject.id)} disabled={!subject} className="ts-bar-btn">
            {subject?.known ? "Fix ID" : "ID track"}
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
