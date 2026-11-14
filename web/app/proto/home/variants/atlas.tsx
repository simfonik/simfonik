"use client";

// Atlas — the Wall, riffed: a pinned-up collage you navigate by flying. Search or pick a year and the
// camera travels there; captions appear only once you're close enough to read them.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import { cover, djLine, pick, type ProtoTape } from "../shared";
import { CARD_H, CARD_W, IMG_H, layoutWall } from "./wall-layout";
import { wall } from "./wall-primitive";

type Rect = { left: number; top: number; right: number; bottom: number };

function World({ children, ...props }: React.ComponentProps<"div">) {
  return usePart(wall, "world", {}, { ...props, children }, "div");
}

export function Atlas({ tapes }: { tapes: ProtoTape[] }) {
  const router = useRouter();
  const { bands, cards, width, height, shelfH } = useMemo(() => layoutWall(tapes), [tapes]);
  // Each cover hangs a little crooked, the same way every time.
  const pinned = useMemo(
    () =>
      cards.map((c) => ({
        ...c,
        rot: (pick(c.tape.id, 9) - 4) * 0.7,
        dx: pick(c.tape.id + "x", 13) - 6,
        dy: pick(c.tape.id + "y", 13) - 6,
      })),
    [cards],
  );
  const byId = useMemo(() => new Map(pinned.map((c) => [c.tape.id, c])), [pinned]);

  const handle = usePrimitive(wall, {});
  const api = handle.api;
  const frameRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);

  // Captions are world-sized, so below a certain zoom they are noise. Flip one attribute, render nothing.
  const syncZoom = useCallback(() => {
    const el = frameRef.current;
    if (el) el.dataset.zoom = api.viewport.get().zoom < 0.42 ? "far" : "near";
  }, [api]);

  const flight = useRef(0);
  const flyTo = useCallback(
    (rect: Rect, { padding = 48, maxZoom = 1 } = {}) => {
      const el = frameRef.current;
      if (!el) return;
      cancelAnimationFrame(flight.current);
      const W = el.clientWidth;
      const H = el.clientHeight;
      const rw = rect.right - rect.left;
      const rh = rect.bottom - rect.top;
      const zoom = Math.min((W - padding * 2) / rw, (H - padding * 2) / rh, maxZoom);
      const to = { x: (W - rw * zoom) / 2 - rect.left * zoom, y: (H - rh * zoom) / 2 - rect.top * zoom, zoom };
      const from = api.viewport.get();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        api.viewport.setViewport(to);
        syncZoom();
        return;
      }
      // Travel through the world point at the centre of the frame, zooming on a log scale so speed feels even.
      const centre = (v: { x: number; y: number; zoom: number }) => ({ cx: (W / 2 - v.x) / v.zoom, cy: (H / 2 - v.y) / v.zoom });
      const a = centre(from);
      const b = centre(to);
      const start = performance.now();
      const duration = 650;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const e = 1 - Math.pow(1 - t, 4);
        const z = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e);
        const cx = a.cx + (b.cx - a.cx) * e;
        const cy = a.cy + (b.cy - a.cy) * e;
        api.viewport.setViewport({ x: W / 2 - cx * z, y: H / 2 - cy * z, zoom: z });
        syncZoom();
        if (t < 1) flight.current = requestAnimationFrame(tick);
      };
      flight.current = requestAnimationFrame(tick);
    },
    [api, syncZoom],
  );
  useEffect(() => () => cancelAnimationFrame(flight.current), []);

  const fitAll = useCallback(() => {
    setFocused(null);
    flyTo({ left: 0, top: 0, right: width, bottom: height }, { padding: 32 });
  }, [flyTo, width, height]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      api.viewport.fit({ left: 0, top: 0, right: width, bottom: height }, { padding: 32, maxZoom: 1 });
      syncZoom();
    });
    return () => cancelAnimationFrame(id);
  }, [api, width, height, syncZoom]);

  const flyToTape = useCallback(
    (id: string) => {
      const c = byId.get(id);
      if (!c) return;
      setFocused(id);
      flyTo({ left: c.x - 60, top: c.y - 50, right: c.x + CARD_W + 60, bottom: c.y + CARD_H + 70 }, { padding: 40, maxZoom: 1.8 });
    },
    [byId, flyTo],
  );

  const press = useRef<{ x: number; y: number } | null>(null);
  const root = usePart(
    handle,
    "root",
    {},
    {
      ref: frameRef,
      "aria-label": "Atlas of every tape cover. Drag to pan, pinch or hold Control and scroll to zoom. Use the search and year buttons above to fly to a place.",
      role: "group",
      className: "wall-frame atlas-frame h-[calc(100dvh-13rem)] min-h-[520px] w-full select-none border-y-[1.5px] border-[var(--text)] bg-[var(--bg)]",
      ...{ "data-proto-keys": "", "data-zoom": "far" },
      onPointerDownCapture: (e: React.PointerEvent) => {
        press.current = { x: e.clientX, y: e.clientY };
        cancelAnimationFrame(flight.current);
      },
      onPointerMove: syncZoom,
      onWheel: () => {
        cancelAnimationFrame(flight.current);
        requestAnimationFrame(syncZoom);
      },
      onKeyUp: syncZoom,
      onClickCapture: (e: React.MouseEvent) => {
        const start = press.current;
        press.current = null;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // The frame may hold pointer capture, so look up what was actually under the press.
        const target = e.target as HTMLElement;
        const link = (target.closest("a[data-tape]") ?? document.elementFromPoint(e.clientX, e.clientY)?.closest("a[data-tape]")) as HTMLAnchorElement | null;
        if (!link) return;
        e.preventDefault();
        e.stopPropagation();
        const id = link.dataset.tape!;
        // First press travels to the tape; pressing the tape you're already at opens it.
        if (id === focused) router.push(`/tapes/${id}`);
        else flyToTape(id);
      },
      children: (
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
            {pinned.map(({ tape, x, y, rot, dx, dy }) => {
              const isFocused = tape.id === focused;
              return (
                <a
                  key={tape.id}
                  href={`/tapes/${tape.id}`}
                  data-tape={tape.id}
                  data-focused={isFocused ? "" : undefined}
                  draggable={false}
                  aria-label={`${djLine(tape)} — ${tape.title}, ${tape.released}${isFocused ? ". Press again to open." : ""}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isFocused) router.push(`/tapes/${tape.id}`);
                      else flyToTape(tape.id);
                    }
                  }}
                  className="wall-card atlas-card absolute block cursor-pointer"
                  style={{
                    left: x + dx,
                    top: y + dy,
                    width: CARD_W,
                    height: CARD_H,
                    transform: isFocused ? "rotate(0deg) scale(1.06)" : `rotate(${rot}deg)`,
                    zIndex: isFocused ? 2 : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover(tape, 400)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="wall-card-img atlas-card-img block w-full bg-[var(--bg-hover)] object-contain"
                    style={{ height: IMG_H }}
                  />
                  <span className="atlas-caption mt-2 block truncate text-[13px] font-medium leading-tight text-[var(--text)]">{djLine(tape)}</span>
                  <span className="atlas-caption block truncate text-[12px] leading-tight text-[var(--muted)]">{tape.title}</span>
                  {isFocused && (
                    <span className="absolute left-0 top-full mt-2 whitespace-nowrap bg-[var(--text)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]">
                      Press again to open →
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </World>
      ),
    },
    "div",
  );

  return (
    <section className="pt-8 sm:pt-12" aria-label="Atlas of covers">
      {/* Controls sit beside the frame, not inside it, so typing a 0 or a + in the search never zooms the map. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-4 sm:px-6">
        <Combobox
          value={null}
          onValueChange={(v: unknown) => {
            if (typeof v === "string") flyToTape(v);
          }}
        >
          <div className="w-full sm:w-80">
            <ComboboxLabel className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Fly to a DJ or a tape
            </ComboboxLabel>
            <ComboboxInput
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full border-[1.5px] border-[var(--text)] bg-transparent px-3 text-base text-[var(--text)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
            />
          </div>
          <ComboboxContent className="atlas-popup z-50 max-h-80 w-[var(--anchor-width,20rem)] min-w-72 overflow-y-auto border-[1.5px] border-[var(--text)] bg-[var(--bg)] shadow-[4px_4px_0_var(--text)]">
            <ComboboxList>
              {tapes.map((t) => (
                <ComboboxItem key={t.id} value={t.id} className="atlas-option flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-[var(--text)]">
                  <span className="truncate">
                    <span className="font-medium">{djLine(t)}</span>
                    <span className="text-[var(--muted)]"> — {t.title}</span>
                  </span>
                </ComboboxItem>
              ))}
            </ComboboxList>
            <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">Nothing on the wall by that name.</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]" id="atlas-years">
            Jump to a year
          </p>
          <Toolbar aria-labelledby="atlas-years" className="flex gap-0 overflow-x-auto border-[1.5px] border-[var(--text)]" data-proto-keys>
            <ToolbarButton onClick={fitAll} className="atlas-year h-11 flex-none cursor-pointer px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text)]">
              All
            </ToolbarButton>
            {bands.map((b) => (
              <ToolbarButton
                key={b.year}
                onClick={() => {
                  setFocused(null);
                  flyTo({ left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + shelfH }, { padding: 40, maxZoom: 0.9 });
                }}
                className="atlas-year h-11 flex-none cursor-pointer border-l-[1.5px] border-[var(--text)] px-3 font-mono text-[11px] tabular-nums tracking-[0.04em] text-[var(--text)]"
              >
                {b.year}
              </ToolbarButton>
            ))}
          </Toolbar>
        </div>
      </div>
      {root}
      <p className="mx-auto max-w-7xl px-4 pt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] sm:px-6">
        Drag to pan · pinch or Ctrl-scroll to zoom · press a cover to fly to it, press it again to open
      </p>
    </section>
  );
}
