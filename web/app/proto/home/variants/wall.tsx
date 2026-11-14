"use client";

// Wall — axis: spatial. Every cover pinned to one big wall, a row of years; pan and zoom to explore.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { chronological, cover, djLine, type ProtoTape } from "../shared";
import { wall } from "./wall-primitive";

const ROWS = 4;
const CARD_W = 240;
const IMG_H = 160;
const CARD_H = 212;
const GAP = 20;
const LABEL_H = 230;
const BLOCK_MIN_W = 440;
const BLOCK_GAP = 110;
const SHELF_GAP = 130;
const MAX_W = 8000;

function World({ children, ...props }: React.ComponentProps<"div">) {
  return usePart(wall, "world", {}, { ...props, children }, "div");
}

export function Wall({ tapes }: { tapes: ProtoTape[] }) {
  const router = useRouter();

  // Each year is a block four covers tall; blocks flow left to right and wrap like words in a paragraph.
  const { bands, cards, width, height } = useMemo(() => {
    const sorted = chronological(tapes);
    const years = [...new Set(sorted.map((t) => t.released ?? ""))];
    const bands: { year: string; count: number; x: number; y: number }[] = [];
    const cards: { tape: ProtoTape; x: number; y: number }[] = [];
    const shelfH = LABEL_H + ROWS * CARD_H + (ROWS - 1) * GAP;
    let x = 0;
    let y = 0;
    let width = 0;
    for (const year of years) {
      const group = sorted.filter((t) => (t.released ?? "") === year);
      const cols = Math.ceil(group.length / ROWS);
      const w = Math.max(cols * (CARD_W + GAP) - GAP, BLOCK_MIN_W);
      if (x > 0 && x + w > MAX_W) {
        x = 0;
        y += shelfH + SHELF_GAP;
      }
      bands.push({ year, count: group.length, x, y });
      group.forEach((tape, i) => {
        cards.push({
          tape,
          x: x + Math.floor(i / ROWS) * (CARD_W + GAP),
          y: y + LABEL_H + (i % ROWS) * (CARD_H + GAP),
        });
      });
      width = Math.max(width, x + w);
      x += w + BLOCK_GAP;
    }
    return { bands, cards, width, height: y + shelfH };
  }, [tapes]);

  const handle = usePrimitive(wall, {});
  const api = handle.api;

  const fit = useCallback(
    () => api.viewport.fit({ left: 0, top: 0, right: width, bottom: height }, { padding: 32, maxZoom: 1 }),
    [api, width, height],
  );
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit]);

  // A drag pans; only a press that didn't travel opens the tape under it.
  const press = useRef<{ x: number; y: number } | null>(null);
  const root = usePart(
    handle,
    "root",
    {},
    {
      "aria-label": "Wall of every tape cover. Drag to pan, pinch or hold Control and scroll to zoom, plus and minus to zoom, zero to reset.",
      role: "group",
      className: "wall-frame h-[calc(100dvh-13rem)] min-h-[520px] w-full select-none border-y-[1.5px] border-[var(--text)] bg-[var(--bg)]",
      ...{ "data-proto-keys": "" },
      // Capture phase, so every press is recorded even when a child stops the event.
      onPointerDownCapture: (e: React.PointerEvent) => {
        press.current = { x: e.clientX, y: e.clientY };
      },
      onClickCapture: (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-wall-hud]")) return;
        const start = press.current;
        press.current = null;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!target.closest("a[data-tape]")) {
          // The frame may hold pointer capture, so look up what was actually under the press.
          const under = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("a[data-tape]");
          if (under) router.push(under.getAttribute("href")!);
        }
      },
      children: (
        <>
          <World>
            <div style={{ width, height, position: "relative" }}>
              {bands.map((b) => (
                <div key={b.year} className="absolute flex items-baseline gap-5 whitespace-nowrap" style={{ left: b.x, top: b.y }} aria-hidden>
                  <span className="font-display leading-[0.85] text-[var(--text)]" style={{ fontSize: 170 }}>
                    {b.year}
                  </span>
                  <span className="font-mono uppercase tracking-[0.18em] text-[var(--muted)]" style={{ fontSize: 20 }}>
                    {b.count} {b.count === 1 ? "tape" : "tapes"}
                  </span>
                </div>
              ))}
              {cards.map(({ tape, x, y }) => (
                <a
                  key={tape.id}
                  href={`/tapes/${tape.id}`}
                  data-tape
                  draggable={false}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    router.push(`/tapes/${tape.id}`);
                  }}
                  onFocus={(e) => api.viewport.reveal(api.viewport.rectOf(e.currentTarget), { padding: 48 })}
                  className="wall-card absolute block cursor-pointer"
                  style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover(tape, 400)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="wall-card-img block w-full bg-[var(--bg-hover)] object-contain"
                    style={{ height: IMG_H }}
                  />
                  <span className="mt-2 block truncate text-[13px] font-medium leading-tight text-[var(--text)]">{djLine(tape)}</span>
                  <span className="block truncate text-[12px] leading-tight text-[var(--muted)]">{tape.title}</span>
                </a>
              ))}
            </div>
          </World>
          <p className="pointer-events-none absolute bottom-3 left-3 bg-[var(--bg)] px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Drag to pan · pinch or Ctrl-scroll to zoom
          </p>
          <div className="pointer-events-none absolute right-0 top-0 p-3">
            <div data-wall-hud className="pointer-events-auto flex flex-none border-[1.5px] border-[var(--text)] bg-[var(--bg)]">
              <button type="button" aria-label="Zoom out" onClick={() => api.viewport.zoomBy(1 / 1.4)} className="cursor-pointer grid h-11 w-11 place-items-center font-mono text-lg text-[var(--text)] hover:bg-[var(--bg-hover)]">
                −
              </button>
              <button type="button" aria-label="Zoom in" onClick={() => api.viewport.zoomBy(1.4)} className="cursor-pointer grid h-11 w-11 place-items-center border-x-[1.5px] border-[var(--text)] font-mono text-lg text-[var(--text)] hover:bg-[var(--bg-hover)]">
                +
              </button>
              <button type="button" onClick={fit} className="cursor-pointer h-11 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text)] hover:bg-[var(--bg-hover)]">
                Fit all
              </button>
            </div>
          </div>
        </>
      ),
    },
    "div",
  );

  return (
    <section className="pt-8 sm:pt-12" aria-label="Wall of covers">
      {root}
    </section>
  );
}
