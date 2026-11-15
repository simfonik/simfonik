"use client";

// The moving parts of the timeline: its scale, the playhead, the tape following the playhead, scrubbing, and
// the overview strip. Everything here that runs per frame writes straight to the elements and reads no layout
// but scrollLeft, so the timeline never re-renders or measures the page while it moves.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { solveSpring } from "@ui-sdk/core/gesture";
import { clock } from "./tracklist-primitive";
import type { TapeAudio } from "./use-tape-audio";

/** The side label and its gap, to the left of every track, in px. The stylesheet has the same number (--ts-gutter). */
export const GUTTER = 56;

export function useTimeline({
  audio,
  length,
  many,
  rows,
  sheet,
}: {
  audio: TapeAudio;
  /** How many seconds the timeline shows. */
  length: number;
  /** One part of the tape shows at a time (a set of more than two sides). */
  many: boolean;
  /** How many sides the tape has. */
  rows: number;
  /** The ID sheet is open: the tape stays where the sheet put it. */
  sheet: boolean;
}) {
  const { audios, activeRef, active, durations, seek, hear } = audio;
  const lengthRef = useRef(length);
  lengthRef.current = length;
  const sideLength = (i: number) => durations[i] ?? length;

  // The playhead is written straight to its element each frame while playing; React hears once a second.
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
  const sheetOpen = useRef(sheet);
  sheetOpen.current = sheet;
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
    //    playhead never reaches the faded edge.
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
    hear(t);
  }, [audios, activeRef, hear]);
  audio.painter.current = paint;

  // The stylesheet sets the scale: so many pixels a minute, or the whole width where the side fits in it. So
  // the tracks are the right size in the HTML the server sends, before any of this runs. What is measured
  // here is the result, for the things that are placed in pixels: the playhead, scrubbing, the overview.
  const [avail, setAvail] = useState(0);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    const ruler = el?.querySelector<HTMLElement>(".ts-ruler");
    if (!el || !ruler) return;
    const measure = () => {
      availRef.current = el.clientWidth;
      widthRef.current = ruler.getBoundingClientRect().width;
      setAvail(availRef.current);
      setWidth(widthRef.current);
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(ruler);
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
  }, [active, many, rows, avail]);
  // More tape than fits (the stylesheet shows the overview strip then; see .ts-map-fold).
  const scrolls = avail > 0 && width + GUTTER > avail + 1;
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
  const mapCancel = () => {
    mapTouch.current = null;
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
  type Held = NonNullable<typeof held.current>;
  const timeUnder = (h: Held) => {
    const along = (h.x - h.origin + (scrollerRef.current?.scrollLeft ?? 0)) / Math.max(1, widthRef.current);
    return Math.max(0, Math.min(sideLength(activeRef.current), Math.max(0, Math.min(1, along)) * lengthRef.current + h.grab));
  };
  const scrub = (v: number | number[]) => scrubTo(held.current ? timeUnder(held.current) : Math.min(v as number, sideLength(activeRef.current)));
  const scrubEnd = (v: number | number[]) => {
    const t = held.current ? timeUnder(held.current) : Math.min(v as number, sideLength(activeRef.current));
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
    if ((e.target as HTMLElement).closest(".ts-scrub-thumb")) h.grab = (scrubT.current ?? audios.current[activeRef.current]?.currentTime ?? 0) - timeUnder(h);
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
        if (sc.scrollLeft !== before) scrubToRef.current(timeUnder(h));
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

  return { scrollerRef, headRef, ghostRef, mapRef, mapWindowRef, mapHeadRef, minutes, snapUntil, scrubAt, scrub, scrubEnd, rulerDown, mapDown, mapMove, mapUp, mapCancel };
}
