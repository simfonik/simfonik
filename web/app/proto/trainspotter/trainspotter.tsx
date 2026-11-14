"use client";

// Trainspotter — help name the music on a tape.
// The timeline is one UI SDK primitive (ranges on tracks). It opens showing what listeners have already
// identified in the comments; a visitor plays the tape and names what they recognise. Every change goes
// through the SDK's change pipeline, so one history gives undo and redo, and the page is operable by an
// agent through the same bridge that loads the listeners' tracklist.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPointerKind } from "@ui-sdk/core";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { usePreference } from "@ui-sdk/react/preferences";
import { createAgent, registerTools } from "@ui-sdk/react/agent";
import { createHistory, type HistoryEntry } from "@ui-sdk/react/history";
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from "@ui-sdk/react/drawer";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { isSameRecord, reconcile, runningOrders, type Listed, type Proposal, type Sighting } from "./parse";
import { cueLabel, tracklist, type Cue } from "./tracklist-primitive";

type TapeProp = { id: string; title: string; djs: string; released: string; sides: { key: string; title: string; audio: string | null }[] };

// One bridge for the page. Every UI SDK component registers with it, including the timeline.
const agent = typeof window === "undefined" ? null : createAgent();
const pointerKind = createPointerKind();
const toaster = createToaster();

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const stamp = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const DEFAULT_LENGTH = 47 * 60;
const PHONE_PPM = 26; // pixels per minute where the timeline scrolls
const MIN_FIT_PPM = 18; // below this a fitted timeline is too cramped to read

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
  if (e.source === "agent") return added.length ? `Added ${added.length} ${added.length === 1 ? "track" : "tracks"} listeners identified` : "Went back to what listeners identified";
  if (added.length === 1 && !removed.length) return `Marked a new track at ${clock(added[0].start)}, side ${added[0].track}`;
  if (removed.length === 1 && !added.length) return `Removed ${cueLabel(removed[0])}`;
  if (!added.length && !removed.length) {
    const changed = after.find((c) => {
      const b = before.find((x) => x.id === c.id);
      return b && (b.start !== c.start || b.end !== c.end || b.track !== c.track || b.artist !== c.artist || b.title !== c.title);
    });
    const b = changed && before.find((x) => x.id === changed.id);
    if (changed && b) {
      if (b.artist !== changed.artist || b.title !== changed.title) return `Named the track at ${clock(changed.start)}: ${cueLabel(changed)}`;
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
  others: { id: string; label: string; count: number }[];
}) {
  const router = useRouter();
  const sides = useMemo(() => tape.sides.map((s) => s.key), [tape.sides]);
  const storageKey = `simfonik:trainspotter:${tape.id}`;
  // Behaviour forks on the pointer; styling forks on media queries in the stylesheet.
  const touch = usePreference(pointerKind).pointer === "coarse";

  // ── Audio: one element per side, so every side's real length is known up front ──
  const audios = useRef<(HTMLAudioElement | null)[]>([]);
  const [lengths, setLengths] = useState<number[]>(() => tape.sides.map(() => DEFAULT_LENGTH));
  const [measured, setMeasured] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const length = Math.max(...lengths);
  const activeRef = useRef(0);
  activeRef.current = active;

  useEffect(() => {
    let seen = 0;
    const offs = audios.current.map((a, i) => {
      if (!a) return () => {};
      const meta = () => {
        setLengths((l) => l.map((v, j) => (j === i && Number.isFinite(a.duration) ? Math.round(a.duration) : v)));
        if (++seen >= audios.current.filter(Boolean).length) setMeasured(true);
      };
      const play = () => i === activeRef.current && setPlaying(true);
      const pause = () => i === activeRef.current && setPlaying(false);
      if (a.readyState >= 1) meta();
      a.addEventListener("loadedmetadata", meta);
      a.addEventListener("play", play);
      a.addEventListener("pause", pause);
      return () => {
        a.removeEventListener("loadedmetadata", meta);
        a.removeEventListener("play", play);
        a.removeEventListener("pause", pause);
      };
    });
    // If a side's length never arrives, carry on with the estimate.
    const giveUp = setTimeout(() => setMeasured(true), 4000);
    return () => {
      offs.forEach((off) => off());
      clearTimeout(giveUp);
    };
  }, []);

  const playheads = useRef<(HTMLDivElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lengthRef = useRef(length);
  lengthRef.current = length;
  useEffect(() => {
    // The playhead moves every frame; write it straight to the element and tell React only once a second.
    let raf = 0;
    let last = -1;
    const tick = () => {
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
      // Where the tape is wider than the screen, follow the playhead while it plays.
      const sc = scrollerRef.current;
      if (sc && a && !a.paused && sc.scrollWidth > sc.clientWidth + 4) {
        const left = x + 56 - sc.scrollLeft;
        if (left > sc.clientWidth - 48 || left < 56) sc.scrollLeft = Math.max(0, x - 24);
      }
      if (Math.floor(t) !== last) {
        last = Math.floor(t);
        setNow(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = useCallback((side: number, t: number, play?: boolean) => {
    audios.current.forEach((a, i) => i !== side && a?.pause());
    const a = audios.current[side];
    const wasPlaying = audios.current.some((x) => x && !x.paused) || Boolean(a && !a.paused);
    setActive(side);
    activeRef.current = side;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    setNow(a.currentTime);
    if (play ?? wasPlaying) a.play().catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    const a = audios.current[activeRef.current];
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  // ── The tracklist value: controlled here, saved in this browser ──
  const [cues, setCues] = useState<Cue[]>([]);
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const [restored, setRestored] = useState<"pending" | "saved" | "fresh">("pending");
  useEffect(() => {
    let found = false;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved)) {
        setCues(saved);
        found = true;
      }
    } catch {
      /* nothing saved, or storage is unavailable */
    }
    setRestored(found ? "saved" : "fresh");
  }, [storageKey]);
  useEffect(() => {
    if (restored === "pending") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cues));
    } catch {
      /* storage is unavailable; the page still works */
    }
  }, [cues, restored, storageKey]);

  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false); // the naming sheet, on phones
  const quiet = useRef(false); // true while the page itself is writing, so it doesn't select what it adds
  const wantName = useRef(false);
  const focusName = useCallback(() => {
    if (touch) setSheet(true);
    else requestAnimationFrame(() => (document.getElementById("ts-artist") as HTMLInputElement | null)?.focus());
  }, [touch]);

  const handle = usePrimitive(tracklist, {
    value: cues,
    onValueChange: (v: Cue[], details: { source?: string }) => {
      // A track a person has just marked is the one they want to name next.
      const added = v.filter((c) => !cuesRef.current.some((b) => b.id === c.id));
      if (added.length === 1 && details?.source !== "agent" && !quiet.current) setSelected(added[0].id);
      setCues(v);
    },
    sides,
    length,
  });
  const api = handle.api;

  // ── What listeners said in the comments, reconciled into one proposal per moment ──
  const proposals = useMemo(() => reconcile(sightings, lengths), [sightings, lengths]);
  const toCue = useCallback(
    (p: Proposal): Cue => ({ id: `crowd-${p.side}-${p.start}`, track: sides[p.side] ?? sides[0], start: p.start, end: p.end, artist: p.artist, title: p.title, known: p.known, by: p.author }),
    [sides],
  );
  const pending = useMemo(
    () => proposals.filter((p) => !cues.some((c) => c.track === (sides[p.side] ?? sides[0]) && Math.abs(c.start - p.start) <= 20)),
    [proposals, cues, sides],
  );

  // ── History: every change to the timeline, with who made it. It is the undo stack. ──
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState(0);
  const [floor, setFloor] = useState(0); // undo stops at the listeners' tracklist the page opened with
  useEffect(() => {
    if (!agent) return;
    const history = createHistory(agent, { keys: ["value"], within: () => rootRef.current });
    historyRef.current = history;
    const read = () => {
      setEntries([...history.entries()]);
      setPosition(history.position());
    };
    const off = history.subscribe(read);
    // Offer the same tools to an assistant built into the browser, where the browser supports WebMCP.
    const unregister = registerTools(agent, { allow: () => true });
    (window as unknown as { simfonikAgent?: unknown }).simfonikAgent = agent;
    return () => {
      off();
      unregister?.();
      history.destroy();
      toaster.dismiss();
    };
  }, []);

  const target = () => agent?.snapshot().find((c) => c.component === "tracklist")?.ref;
  /** Writes listeners' tracks through the agent bridge, so the history knows they weren't typed here. */
  const loadFromListeners = useCallback(
    async (mode: "open" | "add" | "reset") => {
      const ref = target();
      if (!agent || !ref) return;
      quiet.current = true;
      const all = proposals.map(toCue);
      const add = mode === "add" ? all.filter((c) => !cuesRef.current.some((x) => x.track === c.track && Math.abs(x.start - c.start) <= 20)) : all;
      await agent.act({ steps: [{ ref, action: "setValue", args: [mode === "add" ? [...cuesRef.current, ...add] : all] }] });
      quiet.current = false;
      if (mode === "open") setFloor(historyRef.current?.position() ?? 0);
      if (mode === "add") toaster(`Added ${add.length} more ${add.length === 1 ? "track" : "tracks"} from listeners.`, { action: { label: "Undo", onAction: () => void step(-1) } });
      else if (mode === "reset") toaster("Back to what listeners identified.", { action: { label: "Undo", onAction: () => void step(-1) } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proposals, toCue],
  );

  // First visit to a tape: open with what is already known, instead of an empty timeline.
  const opened = useRef(false);
  useEffect(() => {
    if (restored !== "fresh" || !measured || opened.current) return;
    opened.current = true;
    if (proposals.length) void loadFromListeners("open");
  }, [restored, measured, proposals.length, loadFromListeners]);

  const step = useCallback(async (by: number) => {
    const h = historyRef.current;
    if (h) await h.seek(h.position() + by);
  }, []);
  const canUndo = position > floor;
  const canRedo = position < entries.length;
  useShortcut("mod+z", () => canUndo && void step(-1), { description: "Undo" });
  useShortcut("mod+shift+z", () => canRedo && void step(1), { description: "Redo" });
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

  // "A new track starts here": mark it at the playhead and go straight to naming it.
  const markHere = useCallback(() => {
    const a = audios.current[activeRef.current];
    wantName.current = true;
    api.markAt(sides[activeRef.current], Math.floor(a?.currentTime ?? 0));
  }, [api, sides]);
  useEffect(() => {
    if (selected && wantName.current) {
      wantName.current = false;
      focusName();
    }
  }, [selected, focusName]);
  const nameIt = (id: string) => {
    setSelected(id);
    focusName();
  };

  // M marks and Space plays, unless the key belongs to a field or a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || t.closest("[role=slider],[role=option],[role=dialog],.ts-cue")) return;
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
  }, [markHere, toggle]);

  // ── Names waiting for a time: the site's own tracklist if there is one, else a commenter's running order ──
  const orders = useMemo(() => {
    const fromComments = runningOrders(listed, sides.length);
    return sides.map((_, i) => (official[i]?.length ? official[i] : fromComments[i]));
  }, [listed, official, sides]);
  const waiting = useMemo(
    () => orders.map((order, side) => order.filter((l) => l.known && !cues.some((c) => c.track === sides[side] && c.known && isSameRecord(c, l)))),
    [orders, cues, sides],
  );

  const sel = cues.find((c) => c.id === selected) ?? null;
  // For an unnamed track, the names most likely to belong to it: the ones nearest its place in the order.
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

  const [draftName, setDraftName] = useState({ artist: "", title: "" });
  // An unknown track's "title" is only a listener's hint ("you can't run"), so it never pre-fills the field.
  const shownTitle = sel?.known ? sel.title : "";
  useEffect(() => {
    setDraftName({ artist: sel?.artist ?? "", title: shownTitle });
  }, [sel?.id, sel?.artist, shownTitle]);
  const saveName = (artist = draftName.artist, title = draftName.title) => {
    const a = artist.trim();
    const t = title.trim();
    if (!sel || (!a && !t) || (a === sel.artist && t === shownTitle)) return false;
    api.renameCue(sel.id, a, t);
    toaster(`Named: ${[a, t].filter(Boolean).join(" — ")}`, { description: "Saved on this device.", action: { label: "Undo", onAction: () => void step(-1) } });
    return true;
  };
  const remove = () => {
    if (!sel) return;
    const label = cueLabel(sel);
    api.removeCue(sel.id);
    setSelected(null);
    setSheet(false);
    toaster(`Removed ${label}.`, { action: { label: "Undo", onAction: () => void step(-1) } });
  };

  // ── Timeline geometry: fill the width on a wide screen, scroll on a narrow one ──
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // Fit the whole side when there is room for it to stay readable; otherwise keep a fixed scale and scroll.
  const fit = avail - 56 - 2;
  const width = fit >= (length / 60) * MIN_FIT_PPM ? fit : Math.round((length / 60) * PHONE_PPM);
  const minutes = Math.ceil(length / 60);

  // Scrubbing: the ruler's slider sets the position. On a phone it works within the stretch of tape on
  // screen; swiping the sides brings more into view. (Scrolling mid-drag would pull the marker out from
  // under the finger, because the slider measures its track when the drag starts.)
  const scrub = (v: number | number[]) => seek(activeRef.current, Math.min(v as number, lengths[activeRef.current]));

  // A press that didn't travel is a click: it moves the playhead. A drag is the SDK's to handle.
  const down = useRef<{ x: number; y: number } | null>(null);
  const wasClick = (e: React.MouseEvent) => {
    const d = down.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5;
  };

  const [copied, setCopied] = useState(false);
  const asComment = () =>
    tape.sides
      .map((side) => {
        const rows = cues.filter((c) => c.track === side.key).sort((a, b) => a.start - b.start);
        return rows.length ? [`Side ${side.key}`, ...rows.map((c) => `[${stamp(c.start)}] ${c.known ? [c.artist, c.title].filter(Boolean).join(" - ") : `?${c.title ? ` ${c.title}` : ""}`}`)].join("\n") : "";
      })
      .filter(Boolean)
      .join("\n\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asComment());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const knownCount = cues.filter((c) => c.known).length;
  const unknownCount = cues.length - knownCount;

  // The naming form: inline under the timeline with a mouse, in a sheet above the keyboard on a phone.
  const nameForm = sel && (
    <form
      className="ts-nameform"
      onSubmit={(e) => {
        e.preventDefault();
        saveName();
        setSheet(false);
      }}
      // With a mouse, leaving the form saves. Moving between its two fields does not.
      onBlur={(e) => {
        if (!touch && !e.currentTarget.contains(e.relatedTarget as Node | null)) saveName();
      }}
    >
      <Field className="min-w-0 flex-1 basis-40">
        <FieldLabel className="ts-label">Artist</FieldLabel>
        <Input id={touch ? "ts-artist-sheet" : "ts-artist"} value={draftName.artist} onValueChange={(v: string) => setDraftName((d) => ({ ...d, artist: v }))} autoComplete="off" autoCapitalize="words" enterKeyHint="next" className="ts-input" />
      </Field>
      <Field className="min-w-0 flex-[1.4] basis-48">
        <FieldLabel className="ts-label">Title</FieldLabel>
        <Input value={draftName.title} onValueChange={(v: string) => setDraftName((d) => ({ ...d, title: v }))} autoComplete="off" autoCapitalize="words" enterKeyHint="done" className="ts-input" />
      </Field>
      <div className="flex flex-none flex-wrap items-end gap-2">
        <button type="submit" className="poster-btn min-h-11 !bg-[var(--text)] !text-[var(--bg)]">
          Save
        </button>
        <button type="button" onClick={() => seek(sides.indexOf(sel.track), sel.start, true)} className="poster-btn min-h-11">
          Hear it
        </button>
        <button type="button" onClick={remove} className="poster-btn min-h-11" data-agent-confirm="Remove this track from the tracklist?">
          Remove
        </button>
      </div>
      {nextNames.length > 0 && (
        <div className="w-full">
          <p className="ts-label">{nextNames[0].author === "simfonik" ? "Is it one of these, from the tape’s tracklist?" : `Is it one of these, from ${nextNames[0].author}’s list?`}</p>
          <div className="flex flex-wrap gap-2">
            {nextNames.map((l) => (
              <button
                key={`${l.side}-${l.n}`}
                type="button"
                onClick={() => {
                  saveName(l.artist, l.title);
                  setSheet(false);
                }}
                className="ts-chip"
              >
                <span className="font-mono text-[10px] tabular-nums opacity-70">{l.n}</span> {l.artist} — {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {(sel.by || opinions.length > 0) && (
        <p className="w-full text-sm text-[var(--muted)]">
          {sel.by ? `Named by ${sel.by}.` : ""}
          {opinions.map((o, i) => (
            <span key={i}>
              {" "}
              {o.known ? (
                <>
                  {o.author} thought it was{" "}
                  <button type="button" onClick={() => saveName(o.artist, o.title)} className="cursor-pointer text-[var(--text)] underline underline-offset-4">
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
            {tape.sides.map((side, i) => (
              <div key={side.key} className="ts-row" data-active={i === active ? "" : undefined}>
                <button type="button" className="ts-side" onClick={() => seek(i, i === active ? now : 0)} aria-pressed={i === active} aria-label={`Listen to side ${side.key}`}>
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
                    // Click anywhere on the tape to go there.
                    if (wasClick(e)) seek(i, api.spans.valueAt(side.key, e.clientX, e.clientY));
                  }}
                >
                  <div className="ts-beyond" style={{ left: `${(lengths[i] / length) * 100}%` }} aria-hidden />
                  {live
                    .filter((c) => c.track === side.key)
                    .map((c) => (
                      <CuePart
                        key={c.id}
                        value={c.id}
                        className="ts-cue"
                        data-selected={c.id === selected ? "" : undefined}
                        onClick={(e: React.MouseEvent) => {
                          if (wasClick(e)) setSelected(c.id);
                        }}
                        onFocus={() => setSelected(c.id)}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            nameIt(c.id);
                          }
                        }}
                      >
                        <span className="ts-edge" data-span-edge="start" aria-hidden />
                        <span className="ts-cue-text">
                          <b>{c.known ? c.artist || c.title : "Unknown"}</b>
                          <i>{c.known ? (c.artist ? c.title : "") : c.title || "Know it?"}</i>
                        </span>
                        <span className="ts-edge" data-span-edge="end" aria-hidden />
                      </CuePart>
                    ))}
                  <div
                    ref={(el) => {
                      playheads.current[i] = el;
                    }}
                    className="ts-playhead"
                    hidden
                    aria-hidden
                  />
                </Track>
              </div>
            ))}
        </>
      ),
    },
    "div",
  );

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-label="Help name the tracks on this tape">
      {tape.sides.map((s, i) => (
        <audio
          key={s.key}
          ref={(el) => {
            audios.current[i] = el;
          }}
          src={s.audio ?? undefined}
          preload="metadata"
          playsInline
        />
      ))}

      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Name that tune · {tape.released}</p>
      <h1 className="mt-2 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-6xl">
        {tape.djs} <span className="text-[var(--muted)]">{tape.title}</span>
      </h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-[var(--text)]">
        {cues.length
          ? unknownCount
            ? `${knownCount} of the ${cues.length} tracks marked on this tape have a name. ${unknownCount} are still unknown. Press play, and if you recognise one, tell us what it is.`
            : `All ${cues.length} tracks marked on this tape have a name. Press play, and if one is wrong or missing, fix it.`
          : waiting.some((w) => w.length)
            ? "We know what’s on this tape, but not when each track comes in. Press play, and press the button each time a new one starts."
            : "Nobody has named a track on this tape yet. Press play, and when you hear one you know, be the first."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t-[1.5px] border-[var(--text)] pt-4">
        <button type="button" onClick={toggle} className="poster-btn min-h-11 min-w-[6rem] !bg-[var(--text)] !text-[var(--bg)]" aria-keyshortcuts="Space">
          {playing ? "Pause" : "Play"}
        </button>
        <p className="font-mono text-sm tabular-nums text-[var(--text)]">
          Side {sides[active]} · {clock(now)} <span className="text-[var(--muted)]">/ {clock(lengths[active])}</span>
        </p>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => void step(-1)} disabled={!canUndo} className="poster-btn min-h-11" aria-keyshortcuts={undoHint.ariaKeyshortcuts} title={`Undo (${undoHint.text})`}>
            Undo
          </button>
          <button type="button" onClick={() => void step(1)} disabled={!canRedo} className="poster-btn min-h-11" aria-keyshortcuts={redoHint.ariaKeyshortcuts} title={`Redo (${redoHint.text})`}>
            Redo
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{playing ? "Now playing" : `Paused at ${clock(now)}`}</p>
          <p className="mt-1 truncate font-display text-3xl leading-tight text-[var(--text)] sm:text-4xl">{playingCue ? (playingCue.known ? cueLabel(playingCue) : "Unknown track") : "Nothing named here yet"}</p>
          <p className="mt-1 min-h-[1.25rem] truncate text-sm text-[var(--muted)]">
            {playingCue
              ? playingCue.known
                ? playingCue.by
                  ? `Named by ${playingCue.by}`
                  : "Named by you"
                : playingCue.title
                  ? `Nobody has named it. Someone heard: “${playingCue.title}”`
                  : "Nobody has named this one. Do you know it?"
              : "If a track is playing here, press the button and name it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {playingCue && (
            <button type="button" onClick={() => nameIt(playingCue.id)} className={`poster-btn min-h-11 ${playingCue.known ? "" : "!bg-[var(--text)] !text-[var(--bg)]"}`}>
              {playingCue.known ? "Fix this name" : "I know this one"}
            </button>
          )}
          <button type="button" onClick={markHere} className={`poster-btn min-h-11 ${playingCue ? "" : "!bg-[var(--text)] !text-[var(--bg)]"}`} aria-keyshortcuts="M">
            A new track starts here
          </button>
        </div>
      </div>

      <div className="ts-root mt-4">
        <div className="ts-scroller" ref={scrollerRef} data-proto-keys>
          <div className="ts-canvas" style={{ width: width + 56 }}>
            {/* The ruler is the scrubber: a slider the width of the tape. It sits outside the tracklist
                so that moving through the audio is never recorded as a change to the tracklist. */}
            <div className="ts-ruler" style={{ marginLeft: 56, width }}>
              <Slider value={Math.min(now, length)} onValueChange={scrub} min={0} max={length} step={1} largeStep={15} format={(v: number) => clock(v)}>
                <SliderControl className="ts-scrub">
                  <SliderTrack className="ts-scrub-track">
                    {Array.from({ length: Math.floor(minutes / 5) + 1 }, (_, i) => (
                      <span key={i} className="ts-tick" style={{ left: `${((i * 300) / length) * 100}%` }} aria-hidden>
                        {i * 5}:00
                      </span>
                    ))}
                    <SliderThumb className="ts-scrub-thumb" aria-label={`Position in side ${sides[active]}`} />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </div>
            {root}
          </div>
        </div>
      </div>

      {/* With a mouse the name fields sit under the timeline. On a phone they open in a sheet that stays above the keyboard. */}
      <div className="ts-namebar">
        {sel ? (
          <>
            <p className="w-full font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] tabular-nums">
              Side {sel.track} · {clock(sel.start)} to {clock(sel.end)} · {sel.known ? "what should this be called?" : "what is this track?"}
            </p>
            {touch ? (
              <div className="flex w-full items-center gap-3">
                <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">{cueLabel(sel)}</p>
                <button type="button" onClick={() => setSheet(true)} className="poster-btn min-h-11 flex-none !bg-[var(--text)] !text-[var(--bg)]">
                  {sel.known ? "Fix name" : "Name it"}
                </button>
              </div>
            ) : (
              nameForm
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            <span className="ts-fine">
              Drag the marker along the top to scrub, or click anywhere on the tape to go there. Click a track to name it. Drag a track to move it, or an end to trim it. Keys: Space plays, M marks a new track, {undoHint.text} undoes.
            </span>
            <span className="ts-coarse">Slide the marker along the top to scrub, or tap anywhere on the tape to go there. Tap a track to name it.</span>
          </p>
        )}
      </div>

      <Drawer open={sheet && Boolean(sel) && touch} onOpenChange={(open: boolean) => setSheet(open)}>
        <DrawerBackdrop className="ts-backdrop" />
        <DrawerContent className="ts-sheet">
          {sel && (
            <>
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="font-display text-2xl leading-tight text-[var(--text)]">{sel.known ? "Fix this name" : "What is this track?"}</DrawerTitle>
                <DrawerClose className="poster-btn min-h-11 flex-none">Close</DrawerClose>
              </div>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] tabular-nums">
                Side {sel.track} · {clock(sel.start)} to {clock(sel.end)}
              </p>
              <div className="mt-3">{nameForm}</div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {restored === "saved" && pending.length > 0 && (
        <p className="mt-4 text-[15px] text-[var(--text)]">
          Listeners have marked {pending.length} more {pending.length === 1 ? "track" : "tracks"} on this tape.{" "}
          <button type="button" onClick={() => void loadFromListeners("add")} className="cursor-pointer underline underline-offset-4">
            Add {pending.length === 1 ? "it" : "them"}
          </button>
        </p>
      )}

      <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none text-[var(--text)]">Send it in</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] text-[var(--muted)]">
            What you name here is saved on this device. To add it to the archive, copy your tracklist and post it as a comment on the tape’s page. That is where every name on this timeline came from.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copy} disabled={!cues.length} className="poster-btn min-h-11 min-w-[12.5rem]">
              {copied ? "Copied ✓" : "Copy my tracklist"}
            </button>
            <Link href={`/tapes/${tape.id}`} className="inline-flex min-h-11 cursor-pointer items-center text-[15px] text-[var(--text)] underline underline-offset-4">
              Go to the tape’s page
            </Link>
          </div>
          {proposals.length > 0 && (
            <button type="button" onClick={() => void loadFromListeners("reset")} className="mt-4 inline-flex min-h-11 cursor-pointer items-center text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--text)]">
              Start over from what listeners identified
            </button>
          )}
        </div>

        <div className="min-w-0">
          <Collapsible className="ts-fold">
            <CollapsibleTrigger className="ts-fold-trigger">
              <span>Where these names came from</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">{proposals.length}</span>
            </CollapsibleTrigger>
            <CollapsiblePanel className="ts-fold-panel">
              {proposals.length ? (
                <ul className="ts-list">
                  {proposals.map((p) => (
                    <li key={`${p.side}-${p.start}`}>
                      <button type="button" onClick={() => seek(p.side, p.start, true)} className="ts-list-row" aria-label={`Hear side ${sides[p.side]} at ${clock(p.start)}: ${cueLabel(toCue(p))}`}>
                        <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                          {sides[p.side]} {clock(p.start)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{cueLabel(toCue(p))}</span>
                        <span className="flex-none text-[12px] text-[var(--muted)]">
                          {p.author}, {p.date.slice(0, 4)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-[var(--muted)]">Nobody has posted a timed track name in this tape’s comments yet.</p>
              )}
            </CollapsiblePanel>
          </Collapsible>
          <Collapsible className="ts-fold">
            <CollapsibleTrigger className="ts-fold-trigger">
              <span>What’s changed since you opened this</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">{entries.length}</span>
            </CollapsibleTrigger>
            <CollapsiblePanel className="ts-fold-panel">
              {entries.length ? (
                <ol className="ts-list">
                  {[...entries].reverse().map((e, i) => (
                    <li key={e.id} className="ts-history-row" data-undone={entries.length - i > position || e.reverted ? "" : undefined}>
                      <span className="ts-source">{e.source === "agent" ? "Listeners" : "You"}</span>
                      <span className="min-w-0 flex-1">{describe(e)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-3 text-sm text-[var(--muted)]">Nothing yet.</p>
              )}
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-6">
        <Combobox
          value={null}
          onValueChange={(v: unknown) => {
            if (typeof v === "string") router.push(`/proto/trainspotter/${v}`);
          }}
        >
          <div className="w-full sm:w-96">
            <ComboboxLabel className="ts-label">Try another tape</ComboboxLabel>
            <ComboboxInput placeholder="Search by DJ or tape" autoComplete="off" spellCheck={false} className="ts-input" />
          </div>
          <ComboboxContent className="z-50 max-h-80 w-[var(--anchor-width,20rem)] min-w-72 overflow-y-auto border-[1.5px] border-[var(--text)] bg-[var(--bg)] shadow-[4px_4px_0_var(--text)]">
            <ComboboxList>
              {others.map((t) => (
                <ComboboxItem key={t.id} value={t.id} className="ts-option flex min-h-11 cursor-pointer items-center px-3 text-sm text-[var(--text)]">
                  <span className="truncate">{t.label}</span>
                </ComboboxItem>
              ))}
            </ComboboxList>
            <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">No tape by that name has track names to work with yet.</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </div>

      <ToastRegion toaster={toaster} className="ts-toasts">
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
