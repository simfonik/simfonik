"use client";

// Trainspotter — a timed tracklist editor whose first draft is written by an agent reading the comments.
// The timeline is one UI SDK primitive (ranges on tracks). People edit it with pointer and keyboard; an
// agent edits it through the SDK's agent bridge. The history records who changed what, so the agent's
// work can be undone on its own without losing a person's edits.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { createAgent, registerTools } from "@ui-sdk/react/agent";
import { createHistory, stageChanges, type HistoryEntry } from "@ui-sdk/react/history";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { isSameRecord, reconcile, runningOrders, type Listed, type Proposal, type Sighting } from "./parse";
import { cueLabel, tracklist, type Cue } from "./tracklist-primitive";

type TapeProp = { id: string; title: string; djs: string; released: string; sides: { key: string; title: string; audio: string | null }[] };

// One bridge for the page. Every UI SDK component registers with it, including the timeline.
const agent = typeof window === "undefined" ? null : createAgent();

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_LENGTH = 47 * 60;

function Track({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "track", { value }, props, "div");
}
function CuePart({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "cue", { value }, props, "div");
}

/** A plain-language line for one history entry, worked out from what changed in the list. */
function describe(e: HistoryEntry): string {
  const who = e.source === "agent" ? "Fill-in" : "You";
  const before = (Array.isArray(e.previous) ? e.previous : []) as Cue[];
  const after = (Array.isArray(e.value) ? e.value : []) as Cue[];
  const added = after.filter((c) => !before.some((b) => b.id === c.id));
  const removed = before.filter((b) => !after.some((c) => c.id === b.id));
  if (added.length === 1 && !removed.length) return `${who} marked ${cueLabel(added[0])} at ${clock(added[0].start)}, side ${added[0].track}`;
  if (removed.length === 1 && !added.length) return `${who} removed ${cueLabel(removed[0])}`;
  if (!added.length && !removed.length) {
    const changed = after.find((c) => {
      const b = before.find((x) => x.id === c.id);
      return b && (b.start !== c.start || b.end !== c.end || b.track !== c.track || b.artist !== c.artist || b.title !== c.title);
    });
    const b = changed && before.find((x) => x.id === changed.id);
    if (changed && b) {
      if (b.artist !== changed.artist || b.title !== changed.title) return `${who} named it ${cueLabel(changed)}`;
      if (b.end - b.start !== changed.end - changed.start) return `${who} trimmed ${cueLabel(changed)} to ${clock(changed.start)}–${clock(changed.end)}`;
      return `${who} moved ${cueLabel(changed)} to ${clock(changed.start)}`;
    }
  }
  return `${who} changed the tracklist: ${after.length} ${after.length === 1 ? "track" : "tracks"}`;
}

export function Trainspotter({
  tape,
  sightings,
  listed,
  sources,
  others,
}: {
  tape: TapeProp;
  sightings: Sighting[];
  listed: Listed[];
  sources: { archived: number; live: number };
  others: { id: string; label: string; count: number }[];
}) {
  const router = useRouter();
  const sides = useMemo(() => tape.sides.map((s) => s.key), [tape.sides]);
  const storageKey = `simfonik:trainspotter:${tape.id}`;

  // ── Audio: one element per side, so every side's real length is known up front ──
  const audios = useRef<(HTMLAudioElement | null)[]>([]);
  const [lengths, setLengths] = useState<number[]>(() => tape.sides.map(() => DEFAULT_LENGTH));
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const length = Math.max(...lengths);

  useEffect(() => {
    const offs = audios.current.map((a, i) => {
      if (!a) return () => {};
      const meta = () => setLengths((l) => l.map((v, j) => (j === i && Number.isFinite(a.duration) ? Math.round(a.duration) : v)));
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
    return () => offs.forEach((off) => off());
  }, []);
  const activeRef = useRef(0);
  activeRef.current = active;

  const playheads = useRef<(HTMLDivElement | null)[]>([]);
  const lengthRef = useRef(length);
  lengthRef.current = length;
  useEffect(() => {
    // The playhead moves every frame; write it straight to the element and tell React only once a second.
    let raf = 0;
    let last = -1;
    const tick = () => {
      const a = audios.current[activeRef.current];
      const t = a?.currentTime ?? 0;
      playheads.current.forEach((el, i) => {
        if (el) {
          el.style.transform = `translateX(${(t / lengthRef.current) * (el.parentElement?.clientWidth ?? 0)}px)`;
          el.hidden = i !== activeRef.current;
        }
      });
      if (Math.floor(t) !== last) {
        last = Math.floor(t);
        setNow(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = useCallback((side: number, t: number, play = false) => {
    audios.current.forEach((a, i) => i !== side && a?.pause());
    setActive(side);
    activeRef.current = side;
    const a = audios.current[side];
    if (!a) return;
    a.currentTime = Math.max(0, t);
    setNow(a.currentTime);
    if (play) a.play().catch(() => {});
  }, []);
  const toggle = () => {
    const a = audios.current[active];
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  // ── The tracklist value: controlled here, saved in this browser ──
  const [cues, setCues] = useState<Cue[]>([]);
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved)) setCues(saved);
    } catch {
      /* nothing saved, or storage is unavailable */
    }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cues));
    } catch {
      /* storage is unavailable; the page still works */
    }
  }, [cues, restored, storageKey]);

  const [selected, setSelected] = useState<string | null>(null);
  const [stagedIds, setStagedIds] = useState<Set<string>>(new Set());
  const busyRef = useRef(false); // true while the agent or a preview is writing
  const handle = usePrimitive(tracklist, {
    value: cues,
    onValueChange: (v: Cue[], details: { source?: string }) => {
      // A range a person has just drawn is the one they want to name next.
      const added = v.filter((c) => !cuesRef.current.some((b) => b.id === c.id));
      if (added.length === 1 && details?.source !== "agent" && !busyRef.current) setSelected(added[0].id);
      setCues(v);
    },
    sides,
    length,
  });
  const api = handle.api;

  // ── What the crowd said, reconciled into one proposal per moment ──
  const proposals = useMemo(() => reconcile(sightings, lengths), [sightings, lengths]);
  const toCue = useCallback(
    (p: Proposal): Cue => ({ id: `crowd-${p.side}-${p.start}`, track: sides[p.side] ?? sides[0], start: p.start, end: p.end, artist: p.artist, title: p.title, known: p.known, by: p.author }),
    [sides],
  );
  const pending = useMemo(
    () => proposals.filter((p) => !cues.some((c) => c.track === (sides[p.side] ?? sides[0]) && Math.abs(c.start - p.start) <= 20)),
    [proposals, cues, sides],
  );

  // ── History: every change to the timeline, with its source ──
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState(0);
  const [webmcp, setWebmcp] = useState<boolean | null>(null);
  useEffect(() => {
    if (!agent) return;
    const history = createHistory(agent, { keys: ["value"], within: () => rootRef.current });
    historyRef.current = history;
    const read = () => {
      setEntries([...history.entries()]);
      setPosition(history.position());
    };
    const off = history.subscribe(read);
    // Offer the same tools to an agent built into the browser, where the browser supports WebMCP.
    const unregister = registerTools(agent, { allow: () => true });
    setWebmcp("modelContext" in document);
    (window as unknown as { simfonikAgent?: unknown }).simfonikAgent = agent;
    return () => {
      off();
      unregister?.();
      history.destroy();
    };
  }, []);

  // ── The agent: reads the proposals and marks them through the bridge, the way a model would ──
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const stop = useRef(false);
  const target = () => agent?.snapshot().find((c) => c.component === "tracklist")?.ref;

  const runAgent = async () => {
    const ref = target();
    if (!agent || !ref) return;
    setRunning(true);
    busyRef.current = true;
    stop.current = false;
    let done = 0;
    for (const p of pending) {
      if (stop.current) break;
      const cue = toCue(p);
      setNote(`Reading ${p.author}, ${p.date.slice(0, 4)}: ${cueLabel(cue)} at ${clock(p.start)}`);
      const result = await agent.act({ steps: [{ ref, action: "addCue", args: [cue] }] });
      if (result.ok) done++;
      await sleep(60);
    }
    setNote(`Filled in ${done} ${done === 1 ? "track" : "tracks"} from ${new Set(pending.map((p) => p.author)).size} commenters.`);
    setRunning(false);
    busyRef.current = false;
  };

  const [staged, setStaged] = useState<Awaited<ReturnType<typeof stageChanges>> | null>(null);
  const previewAll = async () => {
    const ref = target();
    if (!agent || !ref || !pending.length) return;
    const add = pending.map(toCue);
    setStagedIds(new Set(add.map((c) => c.id)));
    busyRef.current = true;
    setStaged(await stageChanges(agent, [{ ref, value: [...cuesRef.current, ...add] }]));
    busyRef.current = false;
    setNote(`Previewing ${add.length} tracks on the timeline. Nothing is kept until you say so.`);
  };
  const keepStaged = () => {
    setStaged(null);
    setStagedIds(new Set());
    setNote("Kept the crowd's version.");
  };
  const discardStaged = async () => {
    await staged?.revert();
    setStaged(null);
    setStagedIds(new Set());
    setNote("Discarded the preview. The timeline is as it was.");
  };

  const agentEntries = entries.filter((e) => e.source === "agent" && !e.reverted).length;
  const undoAgent = async () => {
    await historyRef.current?.undoSource("agent");
    setNote("Took the fill-in back out. Your own marks are untouched.");
  };

  // ── Timeline geometry ──
  const [ppm, setPpm] = useState(26); // pixels per minute
  const width = Math.round((length / 60) * ppm);
  const minutes = Math.ceil(length / 60);

  const [copied, setCopied] = useState(false);
  const copyJson = async () => {
    const out = Object.fromEntries(
      sides.map((s) => [
        s,
        cues
          .filter((c) => c.track === s)
          .sort((a, b) => a.start - b.start)
          .map((c) => ({ artist: c.known ? c.artist : "ID", title: c.known ? c.title : c.title || "ID", start: clock(c.start) })),
      ]),
    );
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // The track under the playhead on the side that's playing.
  const playingCue = useMemo(
    () =>
      cues
        .filter((c) => c.track === sides[active] && c.start <= now && now < c.end)
        .sort((a, b) => b.start - a.start)[0] ?? null,
    [cues, sides, active, now],
  );

  // "A new track starts here": mark it at the playhead and put the cursor in the name field.
  const wantName = useRef(false);
  const focusName = () => requestAnimationFrame(() => (document.getElementById("ts-artist") as HTMLInputElement | null)?.focus());
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
  }, [selected]);

  // M marks, Space plays and pauses, unless the keys belong to a field or a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || t.closest("[role=slider],[role=option],.ts-cue")) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        markHere();
      } else if (e.key === " ") {
        e.preventDefault();
        const a = audios.current[activeRef.current];
        if (a?.paused) a.play().catch(() => {});
        else a?.pause();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [markHere]);

  // Running orders: names people posted in order, without times. Marking by ear supplies the times.
  const orders = useMemo(() => runningOrders(listed, sides.length), [listed, sides.length]);
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
    const place = cues.filter((c) => c.track === sel.track && c.start < sel.start).length; // 0-based position on this side
    return (waiting[side] ?? [])
      .map((l) => ({ l, d: Math.abs(order.indexOf(l) - place) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.l)
      .sort((a, b) => a.n - b.n);
  }, [sel, sides, orders, waiting, cues]);
  // What else commenters said about the selected track's moment.
  const opinions = useMemo(() => {
    if (!sel) return [];
    const side = sides.indexOf(sel.track);
    return proposals.find((p) => p.side === side && Math.abs(p.start - sel.start) <= 20)?.also ?? [];
  }, [sel, sides, proposals]);
  const [draftName, setDraftName] = useState({ artist: "", title: "" });
  useEffect(() => {
    setDraftName({ artist: sel?.artist ?? "", title: sel?.title ?? "" });
  }, [sel?.id, sel?.artist, sel?.title]);
  const commitName = () => {
    if (sel && (draftName.artist !== sel.artist || draftName.title !== sel.title)) api.renameCue(sel.id, draftName.artist, draftName.title);
  };

  const root = usePart(
    handle,
    "root",
    {},
    {
      ref: rootRef,
      "aria-label": "Timed tracklist",
      className: "ts-root",
      children: ({ cues: live }: { cues: Cue[] }) => (
        <div className="ts-scroller" data-proto-keys>
          <div className="ts-canvas" style={{ width: width + 56 }}>
            <div className="ts-ruler" style={{ marginLeft: 56, width }} aria-hidden>
              {Array.from({ length: Math.floor(minutes / 5) + 1 }, (_, i) => (
                <span key={i} style={{ left: `${((i * 300) / length) * 100}%` }}>
                  {i * 5}:00
                </span>
              ))}
            </div>
            {tape.sides.map((side, i) => (
              <div key={side.key} className="ts-row" data-active={i === active ? "" : undefined}>
                <button
                  type="button"
                  className="ts-side"
                  onClick={() => seek(i, i === active ? now : 0)}
                  aria-pressed={i === active}
                  aria-label={`Side ${side.key}: ${side.title}. Listen to this side.`}
                >
                  {side.key}
                </button>
                <Track
                  value={side.key}
                  className="ts-track"
                  style={{ width, backgroundSize: `${(60 / length) * 100}% 100%` }}
                  onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (e.target !== e.currentTarget) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    seek(i, ((e.clientX - r.left) / r.width) * length, true);
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
                        data-staged={stagedIds.has(c.id) ? "" : undefined}
                        onPointerDown={() => setSelected(c.id)}
                        onFocus={() => setSelected(c.id)}
                        onDoubleClick={() => seek(i, c.start, true)}
                      >
                        <span className="ts-edge" data-span-edge="start" aria-hidden />
                        <span className="ts-cue-text">
                          <b>{c.known ? c.artist || c.title : "ID wanted"}</b>
                          <i>{c.known ? (c.artist ? c.title : "") : c.title}</i>
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
          </div>
        </div>
      ),
    },
    "div",
  );

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-label="Trainspotter">
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

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Trainspotter · {tape.released}</p>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-6xl">
            {tape.djs} <span className="text-[var(--muted)]">{tape.title}</span>
          </h1>
        </div>
        <Combobox
          value={null}
          onValueChange={(v: unknown) => {
            if (typeof v === "string") router.push(`/proto/trainspotter/${v}`);
          }}
        >
          <div className="w-full sm:w-80">
            <ComboboxLabel className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Open another tape ({others.length} have timed IDs)</ComboboxLabel>
            <ComboboxInput autoComplete="off" spellCheck={false} className="ts-input" />
          </div>
          <ComboboxContent className="z-50 max-h-80 w-[var(--anchor-width,20rem)] min-w-72 overflow-y-auto border-[1.5px] border-[var(--text)] bg-[var(--bg)] shadow-[4px_4px_0_var(--text)]">
            <ComboboxList>
              {others.map((t) => (
                <ComboboxItem key={t.id} value={t.id} className="ts-option flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm text-[var(--text)]">
                  <span className="truncate">{t.label}</span>
                  <span className="flex-none font-mono text-[11px] tabular-nums opacity-70">{t.count}</span>
                </ComboboxItem>
              ))}
            </ComboboxList>
            <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">No annotated tape by that name.</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t-[1.5px] border-[var(--text)] pt-4">
        <button type="button" onClick={toggle} className="poster-btn min-h-11 min-w-[6rem] !bg-[var(--text)] !text-[var(--bg)]">
          {playing ? "Pause" : "Play"}
        </button>
        <p className="font-mono text-sm tabular-nums text-[var(--text)]" aria-live="off">
          Side {sides[active]} · {clock(now)} <span className="text-[var(--muted)]">/ {clock(lengths[active])}</span>
        </p>
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto" data-proto-keys>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]" id="ts-zoom">
            Zoom
          </span>
          <div className="w-40">
            <Slider value={ppm} onValueChange={(v) => setPpm(v as number)} min={10} max={90} step={1} largeStep={10}>
              <SliderControl className="block h-11 cursor-pointer touch-none select-none">
                <SliderTrack className="top-[21px] mx-[22px] h-[2px] bg-[var(--border)]">
                  <SliderIndicator className="h-full bg-[var(--text)]" />
                  <SliderThumb className="ts-thumb" aria-labelledby="ts-zoom" />
                </SliderTrack>
              </SliderControl>
            </Slider>
          </div>
          <button type="button" onClick={copyJson} disabled={!cues.length} className="poster-btn min-h-11 min-w-[11.5rem]">
            {copied ? "Copied ✓" : "Copy tracklist JSON"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-80" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{playing ? "Now playing" : "At the playhead"}</p>
          <p className="mt-1 truncate font-display text-3xl leading-tight text-[var(--text)] sm:text-4xl">
            {playingCue ? (playingCue.known ? cueLabel(playingCue) : "ID wanted") : "Unmarked tape"}
          </p>
          <p className="mt-1 min-h-[1.25rem] truncate text-sm text-[var(--muted)]">
            {playingCue
              ? playingCue.known
                ? playingCue.by
                  ? `Identified by ${playingCue.by}`
                  : "Marked by you"
                : playingCue.title
                  ? `Nobody has named it yet. Someone heard: “${playingCue.title}”`
                  : "Nobody has named this one yet."
              : "Nothing is marked here. Press the button when a track comes in."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {playingCue && !playingCue.known && (
            <button
              type="button"
              onClick={() => {
                setSelected(playingCue.id);
                focusName();
              }}
              className="poster-btn min-h-11"
            >
              I know this one
            </button>
          )}
          <button type="button" onClick={markHere} className="poster-btn min-h-11 !bg-[var(--text)] !text-[var(--bg)]" aria-keyshortcuts="M">
            A new track starts here
          </button>
        </div>
      </div>

      <div className="mt-4">{root}</div>

      {/* Naming sits directly under the timeline, where the hands already are. */}
      <div className="ts-namebar">
        {sel ? (
          <>
            <p className="flex-none font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] tabular-nums">
              Side {sel.track} · {clock(sel.start)}–{clock(sel.end)}
            </p>
            <Field className="min-w-0 flex-1 basis-40">
              <FieldLabel className="sr-only">Artist</FieldLabel>
              <Input id="ts-artist" placeholder="Artist" value={draftName.artist} onValueChange={(v: string) => setDraftName((d) => ({ ...d, artist: v }))} onBlur={commitName} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && commitName()} autoComplete="off" className="ts-input" />
            </Field>
            <Field className="min-w-0 flex-[1.4] basis-48">
              <FieldLabel className="sr-only">Title</FieldLabel>
              <Input placeholder="Title" value={draftName.title} onValueChange={(v: string) => setDraftName((d) => ({ ...d, title: v }))} onBlur={commitName} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && commitName()} autoComplete="off" className="ts-input" />
            </Field>
            <button type="button" onClick={() => seek(sides.indexOf(sel.track), sel.start, true)} className="poster-btn min-h-11 flex-none">
              Hear it
            </button>
            <button
              type="button"
              onClick={() => {
                api.removeCue(sel.id);
                setSelected(null);
              }}
              className="poster-btn min-h-11 flex-none"
            >
              Remove
            </button>
            {nextNames.length > 0 && (
              <p className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 text-sm text-[var(--muted)]">
                <span>From {nextNames[0].author}’s running order:</span>
                {nextNames.map((l) => (
                  <button
                    key={`${l.side}-${l.n}`}
                    type="button"
                    onClick={() => api.renameCue(sel.id, l.artist, l.title)}
                    className="ts-chip"
                    aria-label={`Name it ${l.artist} — ${l.title}, number ${l.n} in the running order`}
                  >
                    <span className="font-mono text-[10px] tabular-nums opacity-70">{l.n}</span> {l.artist} — {l.title}
                  </button>
                ))}
              </p>
            )}
            {(sel.by || opinions.length > 0) && (
              <p className="w-full text-sm text-[var(--muted)]">
                {sel.by ? `Identified by ${sel.by}.` : ""}
                {opinions.map((o, i) => (
                  <span key={i}>
                    {" "}
                    {o.known ? (
                      <>
                        {o.author} said{" "}
                        <button type="button" onClick={() => api.renameCue(sel.id, o.artist, o.title)} className="cursor-pointer text-[var(--text)] underline underline-offset-4">
                          {[o.artist, o.title].filter(Boolean).join(" — ")}
                        </button>{" "}
                        ({o.date.slice(0, 4)}).
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
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            <span className="ts-fine">Drag on a side to mark a track, drag a range to move it or an end to trim it, double-click to hear it. With the keyboard: M marks at the playhead, Space plays, arrows move a range, Shift-arrows trim it, Delete removes it.</span>
            <span className="ts-coarse">Play the tape and press “A new track starts here” when one comes in. Tap a range to name it.</span>
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* The crowd and the agent */}
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none text-[var(--text)]">What the crowd said</h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
            {sightings.length
              ? `${sightings.length} timed IDs across ${sources.archived + sources.live} comments (${sources.live} posted since 2023), from ${new Set(sightings.map((s) => s.author)).size === 1 ? "one person" : `${new Set(sightings.map((s) => s.author)).size} people`}. Reconciled to ${proposals.length} moments; ${pending.length} not on the timeline yet.`
              : "Nobody has left a timed ID on this tape yet."}
          </p>
          {orders.some((o) => o.length > 0) && (
            <p className="mt-2 text-[15px] text-[var(--muted)]">
              {orders
                .map((o, i) => (o.length ? `${o[0].author} posted a running order for side ${sides[i]} without times: ${o.filter((l) => l.known).length} names, ${waiting[i].length} still waiting for one.` : ""))
                .filter(Boolean)
                .join(" ")}{" "}
              Play the tape and mark each track as it comes in; the names are offered in order.
            </p>
          )}
          {staged ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={keepStaged} className="poster-btn min-h-11 !bg-[var(--text)] !text-[var(--bg)]">
                Keep these
              </button>
              <button type="button" onClick={discardStaged} className="poster-btn min-h-11">
                Discard the preview
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={running ? () => (stop.current = true) : runAgent} disabled={!running && !pending.length} className="poster-btn min-h-11 min-w-[15.5rem] !bg-[var(--text)] !text-[var(--bg)]">
                {running ? "Stop" : "Fill in from the comments"}
              </button>
              <button type="button" onClick={previewAll} disabled={running || !pending.length} className="poster-btn min-h-11">
                Preview first
              </button>
            </div>
          )}
          <p className="mt-3 min-h-[2.5rem] text-sm text-[var(--text)]" aria-live="polite">
            {note}
          </p>
          <ul className="ts-list mt-1">
            {proposals.map((p) => {
              const on = !pending.includes(p);
              return (
                <li key={`${p.side}-${p.start}`}>
                  <button type="button" onClick={() => seek(p.side, p.start, true)} className="ts-list-row" aria-label={`Hear side ${sides[p.side]} at ${clock(p.start)}: ${cueLabel(toCue(p))}`}>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                      {sides[p.side]} {clock(p.start)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{cueLabel(toCue(p))}</span>
                    <span className="flex-none font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                      {on ? "on timeline" : `${p.author.split(" ")[0]} ’${p.date.slice(2, 4)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* History by source */}
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none text-[var(--text)]">Who changed what</h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
            {entries.length ? `${entries.length} changes recorded. Step back through them, or take back only what was filled in for you.` : "Every change to the timeline is recorded here, yours and the fill-in's, so either can be undone on its own."}
          </p>
          <div className="mt-2" data-proto-keys>
            <Slider value={position} onValueChange={(v) => historyRef.current?.seek(v as number)} min={0} max={Math.max(1, entries.length)} step={1} disabled={!entries.length}>
              <SliderControl className="block h-11 cursor-pointer touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
                <SliderTrack className="top-[21px] mx-[22px] h-[2px] bg-[var(--border)]">
                  <SliderIndicator className="h-full bg-[var(--text)]" />
                  <SliderThumb className="ts-thumb" aria-label="Step through the history" />
                </SliderTrack>
              </SliderControl>
            </Slider>
          </div>
          <button type="button" onClick={undoAgent} disabled={!agentEntries} className="poster-btn min-h-11">
            Undo the fill-in{agentEntries ? ` (${agentEntries})` : ""}
          </button>
          <ol className="ts-list mt-4">
            {[...entries].reverse().map((e, i) => {
              const index = entries.length - i;
              return (
                <li key={e.id} className="ts-history-row" data-undone={index > position || e.reverted ? "" : undefined}>
                  <span className="ts-source" data-source={e.source === "agent" ? "agent" : "you"}>
                    {e.source === "agent" ? "Fill-in" : "You"}
                  </span>
                  <span className="min-w-0 flex-1">{describe(e).replace(/^(Fill-in|You) /, "")}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <p className="mt-10 border-t border-[var(--border)] pt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-[var(--muted)]">
            Built on the UI SDK. The timeline is one primitive, and the fill-in works through its agent bridge.{" "}
            {webmcp === null ? "" : webmcp ? "This browser's own agent can use it too (WebMCP)." : "This browser has no WebMCP, so its built-in agent can't see the page yet."}
      </p>
    </section>
  );
}
