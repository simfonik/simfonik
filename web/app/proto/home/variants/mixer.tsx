"use client";

// Mixer — the homepage as an instrument. Load two tapes, ride the pitch, and blend them with the crossfader.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bindDrag, dragThreshold } from "@ui-sdk/core";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { chronological, cover, djLine, type ProtoTape } from "../shared";

type Side = "A" | "B";

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(sec).padStart(2, "0")}`;
};
const normalize = (s: string) => s.toLowerCase().replace(/[.\-\s]/g, "");

function useChannel() {
  const ref = useRef<HTMLAudioElement>(null);
  const [tape, setTape] = useState<ProtoTape | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitchState] = useState(0); // percent, like a turntable's pitch fader
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const on = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setTime(a.currentTime),
      loadedmetadata: () => setDuration(a.duration),
      error: () => {
        if (a.getAttribute("src")) setFailed(true);
      },
    };
    Object.entries(on).forEach(([k, fn]) => a.addEventListener(k, fn));
    return () => Object.entries(on).forEach(([k, fn]) => a.removeEventListener(k, fn));
  }, []);

  const applyPitch = (a: HTMLAudioElement, pct: number) => {
    // Tape speed, not time-stretch: faster is higher, the way a real deck behaves.
    a.preservesPitch = false;
    a.playbackRate = 1 + pct / 100;
  };

  const load = useCallback(
    (t: ProtoTape) => {
      const a = ref.current;
      if (!a || !t.audio) return;
      setTape(t);
      setFailed(false);
      setTime(0);
      setDuration(0);
      a.src = t.audio;
      applyPitch(a, pitch);
      a.play().catch(() => {});
    },
    [pitch],
  );
  const toggle = () => {
    const a = ref.current;
    if (!a || !tape) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (s: number) => {
    const a = ref.current;
    if (a) {
      a.currentTime = s;
      setTime(s);
    }
  };
  const setPitch = (pct: number) => {
    setPitchState(pct);
    if (ref.current) applyPitch(ref.current, pct);
  };
  const setVolume = useCallback((v: number) => {
    if (ref.current) ref.current.volume = v;
  }, []);

  return { ref, tape, playing, time, duration, pitch, failed, load, toggle, seek, setPitch, setVolume };
}

function Channel({
  side,
  ch,
  armed,
  onArm,
  wellRef,
}: {
  side: Side;
  ch: ReturnType<typeof useChannel>;
  armed: boolean;
  onArm: () => void;
  wellRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { tape } = ch;
  return (
    <div className="flex min-w-0 flex-col p-4 sm:p-5" data-proto-keys>
      <audio ref={ch.ref} preload="none" playsInline />
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-4xl leading-none text-[var(--text)]" aria-hidden>
          {side}
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]" aria-live="polite">
          Channel {side} · {tape ? (ch.failed ? "Would not load" : ch.playing ? "Playing" : "Paused") : "Empty"}
        </p>
        <button
          type="button"
          onClick={onArm}
          aria-pressed={armed}
          className="mixer-arm min-h-11 cursor-pointer border-[1.5px] border-[var(--text)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text)]"
        >
          {armed ? "Loads here next" : "Load here next"}
        </button>
      </div>

      <div ref={wellRef} className="mixer-well mt-3 grid aspect-[5/2] w-full place-items-center bg-[var(--bg-hover)]">
        {tape ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={tape.id} src={cover(tape, 800)} alt="" draggable={false} className="h-full w-full object-contain" />
        ) : (
          <p className="max-w-[22ch] px-4 text-center text-[15px] text-[var(--muted)]">Channel {side} is empty. Press a tape in the rack, or drag one here.</p>
        )}
      </div>

      <div className="mt-3 min-h-[3.75rem]">
        {tape && (
          <>
            <h2 className="truncate font-display text-2xl leading-tight text-[var(--text)]">{djLine(tape)}</h2>
            <p className="truncate text-sm text-[var(--text)]">
              {tape.title} · {tape.released} ·{" "}
              <Link href={`/tapes/${tape.id}`} className="cursor-pointer underline underline-offset-4">
                open tape
              </Link>
            </p>
          </>
        )}
      </div>

      <Slider value={Math.min(ch.time, ch.duration || 0)} onValueChange={(v) => ch.seek(v as number)} min={0} max={Math.max(1, Math.floor(ch.duration))} step={1} largeStep={60} disabled={!ch.duration} format={(v: number) => clock(v)}>
        <SliderControl className="block h-11 cursor-pointer touch-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
          <SliderTrack className="top-[21px] mx-[22px] h-[2px] bg-[var(--border)]">
            <SliderIndicator className="h-full bg-[var(--text)]" />
            <SliderThumb className="mixer-thumb" aria-label={`Position in channel ${side}`} />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <div className="flex justify-between px-[22px] font-mono text-[11px] tabular-nums text-[var(--muted)]">
        <span>{clock(ch.time)}</span>
        <span>{ch.duration ? clock(ch.duration) : "–:––"}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!tape} onClick={ch.toggle} className="poster-btn min-h-11 min-w-[5.5rem] flex-none">
          {ch.playing ? "Pause" : "Play"}
        </button>
        <div className="min-w-0 flex-1">
          <Slider value={ch.pitch} onValueChange={(v) => ch.setPitch(v as number)} min={-8} max={8} step={0.1} largeStep={1}>
            <SliderControl className="block h-11 cursor-pointer touch-none select-none">
              <SliderTrack className="mixer-pitch-track top-[21px] mx-[22px] h-[2px] bg-[var(--text)]">
                <SliderThumb className="mixer-thumb mixer-thumb-tall" aria-label={`Pitch, channel ${side}`} />
              </SliderTrack>
            </SliderControl>
          </Slider>
        </div>
        <button
          type="button"
          onClick={() => ch.setPitch(0)}
          aria-label={`Reset pitch on channel ${side}, currently ${ch.pitch.toFixed(1)} percent`}
          className="min-h-11 w-[4.75rem] flex-none cursor-pointer text-right font-mono text-[12px] tabular-nums text-[var(--text)] underline-offset-4 hover:underline"
        >
          {ch.pitch > 0 ? "+" : ch.pitch < 0 ? "−" : "±"}
          {Math.abs(ch.pitch).toFixed(1)}%
        </button>
      </div>
    </div>
  );
}

export function Mixer({ tapes }: { tapes: ProtoTape[] }) {
  const rack = useMemo(() => chronological(tapes).filter((t) => t.audio), [tapes]);
  const a = useChannel();
  const b = useChannel();
  const [fade, setFade] = useState(0); // -100 is all A, 100 is all B
  const [armed, setArmed] = useState<Side>("A");
  const [query, setQuery] = useState("");
  const wellA = useRef<HTMLDivElement>(null);
  const wellB = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLImageElement>(null);
  const suppressClick = useRef(false);

  // Equal-power curve, so the blend doesn't dip in the middle.
  const setVolA = a.setVolume;
  const setVolB = b.setVolume;
  useEffect(() => {
    const x = (fade + 100) / 200;
    setVolA(Math.cos((x * Math.PI) / 2));
    setVolB(Math.sin((x * Math.PI) / 2));
  }, [fade, setVolA, setVolB]);

  const loadInto = (side: Side, tape: ProtoTape) => {
    (side === "A" ? a : b).load(tape);
    setArmed(side === "A" ? "B" : "A"); // load one side, then the other, the way you'd set up a mix
  };

  const shown = useMemo(() => {
    const q = normalize(query);
    return q ? rack.filter((t) => normalize(`${djLine(t)} ${t.title} ${t.released}`).includes(q)) : rack;
  }, [rack, query]);

  // Mouse and pen can carry a tape to either channel. A touch tap loads it, so swiping the rack still scrolls.
  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, tape: ProtoTape) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const ghost = ghostRef.current;
    const wells: [Side, HTMLDivElement | null][] = [
      ["A", wellA.current],
      ["B", wellB.current],
    ];
    if (!ghost) return;
    const hit = (x: number, y: number): Side | null => {
      for (const [side, el] of wells) {
        const r = el?.getBoundingClientRect();
        if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return side;
      }
      return null;
    };
    let dragged = false;
    bindDrag(e.currentTarget, e.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onMove: ({ x, y }) => {
        if (!dragged) {
          dragged = true;
          ghost.src = cover(tape, 400);
          ghost.hidden = false;
          suppressClick.current = true;
        }
        ghost.style.transform = `translate3d(${x - 84}px, ${y - 56}px, 0) rotate(-4deg)`;
        const over = hit(x, y);
        wells.forEach(([side, el]) => el?.toggleAttribute("data-over", side === over));
      },
      onEnd: (event, canceled) => {
        ghost.hidden = true;
        wells.forEach(([, el]) => el?.removeAttribute("data-over"));
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        const side = dragged && !canceled ? hit((event as PointerEvent).clientX, (event as PointerEvent).clientY) : null;
        if (side) loadInto(side, tape);
      },
    });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12" aria-label="Two-channel mixer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ghostRef} alt="" hidden className="mixer-ghost" />

      <div className="border-[1.5px] border-[var(--text)]">
        <div className="grid md:grid-cols-2 md:divide-x-[1.5px] md:divide-[var(--text)]">
          <Channel side="A" ch={a} armed={armed === "A"} onArm={() => setArmed("A")} wellRef={wellA} />
          <div className="border-t-[1.5px] border-[var(--text)] md:border-t-0">
            <Channel side="B" ch={b} armed={armed === "B"} onArm={() => setArmed("B")} wellRef={wellB} />
          </div>
        </div>
        <div className="border-t-[1.5px] border-[var(--text)] px-4 py-4 sm:px-5" data-proto-keys>
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <span className="font-display text-2xl leading-none text-[var(--text)]" aria-hidden>
              A
            </span>
            <div className="min-w-0 flex-1">
              <Slider value={fade} onValueChange={(v) => setFade(v as number)} min={-100} max={100} step={1} largeStep={25}>
                <SliderControl className="block h-14 cursor-pointer touch-none select-none">
                  <SliderTrack className="mixer-fader-track top-[26px] mx-[30px] h-[4px] bg-[var(--text)]">
                    <SliderThumb className="mixer-fader-thumb" aria-label="Crossfader, from channel A to channel B" />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </div>
            <span className="font-display text-2xl leading-none text-[var(--text)]" aria-hidden>
              B
            </span>
          </div>
          <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Crossfader</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl leading-none text-[var(--text)]">The rack</h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Press a tape to load channel {armed} · or drag it to either side
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="mixer-filter" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Filter the rack
          </label>
          <input id="mixer-filter" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} className="h-11 w-full border-[1.5px] border-[var(--text)] bg-transparent px-3 text-base text-[var(--text)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]" />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-[15px] text-[var(--text)]">
          No tape matches “{query}”.{" "}
          <button type="button" onClick={() => setQuery("")} className="cursor-pointer underline underline-offset-4">
            Clear the filter
          </button>
        </p>
      ) : (
        <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {shown.map((t) => {
            const on = a.tape?.id === t.id ? "A" : b.tape?.id === t.id ? "B" : null;
            return (
              <button
                key={t.id}
                type="button"
                onPointerDown={(e) => startDrag(e, t)}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  loadInto(armed, t);
                }}
                aria-label={`Load ${djLine(t)} — ${t.title}, ${t.released}, into channel ${armed}`}
                className="mixer-rack-item relative w-36 flex-none cursor-pointer select-none text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover(t, 400)} alt="" loading="lazy" decoding="async" draggable={false} className="aspect-[3/2] w-full bg-[var(--bg-hover)] object-contain" />
                {on && <span className="absolute left-0 top-0 bg-[var(--text)] px-2 py-1 font-display text-base leading-none text-[var(--bg)]">{on}</span>}
                <span className="mt-2 block truncate text-[13px] font-medium leading-tight text-[var(--text)]">{djLine(t)}</span>
                <span className="block truncate text-[12px] leading-tight text-[var(--muted)]">
                  {t.released} · {t.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
