"use client";

// Dial — axis: interaction model. One tape at a time, found by scrubbing a tuner band.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { chronological, cover, djLine, type ProtoTape } from "../shared";

export function Dial({ tapes }: { tapes: ProtoTape[] }) {
  const sorted = useMemo(() => chronological(tapes), [tapes]);
  const last = sorted.length - 1;
  const [index, setIndex] = useState(() => Math.floor(sorted.length * 0.4));
  // The cover waits for the needle to settle so a fast scrub doesn't request every image it passes.
  const [settled, setSettled] = useState(index);
  useEffect(() => {
    const id = setTimeout(() => setSettled(index), 140);
    return () => clearTimeout(id);
  }, [index]);

  const tape = sorted[index];
  const shown = sorted[settled];

  // Year marks sit where each year starts on the band. Where two would collide, the year with more tapes wins.
  const marks = useMemo(() => {
    const starts: { year: string; pct: number; count: number }[] = [];
    sorted.forEach((t, i) => {
      if (i > 0 && sorted[i - 1].released === t.released) starts[starts.length - 1].count++;
      else starts.push({ year: t.released ?? "", pct: (i / last) * 100, count: 1 });
    });
    const out: typeof starts = [];
    for (const m of starts) {
      const prev = out[out.length - 1];
      if (prev && m.pct - prev.pct < 7) {
        if (m.count > prev.count) out[out.length - 1] = m;
      } else out.push(m);
    }
    return out;
  }, [sorted, last]);

  const step = (d: number) => setIndex((i) => Math.min(last, Math.max(0, i + d)));

  return (
    <section className="mx-auto flex max-w-7xl flex-col px-4 pt-8 sm:px-6 sm:pt-12" aria-label="Tune through the archive">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <Link
          href={`/tapes/${shown.id}`}
          className="dial-cover cursor-pointer block aspect-[3/2] w-full bg-[var(--bg-hover)]"
          data-tuning={settled !== index ? "" : undefined}
          aria-label={`Open ${djLine(shown)} — ${shown.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={shown.id} src={cover(shown, 800)} alt="" className="h-full w-full object-contain" draggable={false} />
        </Link>

        <div className="flex min-h-[15rem] flex-col lg:min-h-[24rem]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] tabular-nums">
            Tape {String(index + 1).padStart(3, "0")} of {sorted.length} · {tape.released}
          </p>
          <h2 className="mt-3 line-clamp-3 font-display text-5xl leading-[0.95] text-[var(--text)] [font-kerning:normal] [text-wrap:balance] sm:text-6xl lg:text-7xl">
            {djLine(tape)}
          </h2>
          <p className="mt-4 line-clamp-2 max-w-[40ch] text-lg text-[var(--text)]">{tape.title}</p>
          <div className="mt-auto pt-6">
            <Link href={`/tapes/${tape.id}`} className="poster-btn min-h-11">
              Open this tape
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-stretch gap-2 sm:mt-14" data-proto-keys>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index === 0}
          aria-label="Previous tape"
          className="cursor-pointer grid h-24 w-11 flex-none place-items-center text-[var(--text)] disabled:cursor-not-allowed disabled:text-[var(--border)]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <Slider value={index} onValueChange={(v) => setIndex(v as number)} min={0} max={last} step={1} largeStep={10}>
            <SliderControl className="relative block h-24 cursor-pointer touch-none select-none">
              <SliderTrack className="mx-[22px] h-full border-y-[1.5px] border-[var(--text)]">
                <div
                  className="dial-ticks absolute inset-x-0 bottom-0 h-1/2"
                  style={{ "--dial-steps": last } as React.CSSProperties}
                  aria-hidden
                />
                <SliderThumb className="dial-thumb" aria-label="Tape" />
              </SliderTrack>
            </SliderControl>
          </Slider>
          <div className="relative mx-[22px] mt-2 h-5" aria-hidden>
            {marks.map((m, i) => (
              <span
                key={m.year}
                className={`absolute font-mono text-[11px] tracking-[0.1em] text-[var(--muted)] tabular-nums ${i % 2 ? "hidden sm:block" : ""}`}
                style={{ left: `${m.pct}%` }}
              >
                {m.year}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={index === last}
          aria-label="Next tape"
          className="cursor-pointer grid h-24 w-11 flex-none place-items-center text-[var(--text)] disabled:cursor-not-allowed disabled:text-[var(--border)]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
        Drag the needle, or use the arrow keys
      </p>
    </section>
  );
}
