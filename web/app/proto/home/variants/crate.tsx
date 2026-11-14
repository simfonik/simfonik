"use client";

// Crate — dig through the archive the way you dig through a crate: flick, and the tapes riffle past with
// real momentum. The throw, the settle and the resistance at the ends are the UI SDK's gesture maths.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bindDrag, dragThreshold } from "@ui-sdk/core";
import { createVelocityTracker, projectDistance, rubberBand, solveSpring } from "@ui-sdk/core/gesture";
import { chronological, cover, djLine, type ProtoTape } from "../shared";

const PX_PER_TAPE = 80; // how far a drag travels to flip one tape
const BEHIND = 10; // tapes visible standing behind the front one
const AHEAD = 3; // tapes still visible after they've been flipped forward

export function Crate({ tapes }: { tapes: ProtoTape[] }) {
  const router = useRouter();
  const sorted = useMemo(() => chronological(tapes), [tapes]);
  const last = sorted.length - 1;
  const start = Math.floor(sorted.length * 0.4);

  const pos = useRef(start); // fractional index of the tape at the front
  const [current, setCurrent] = useState(start);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shown = useRef<Set<number>>(new Set());
  const anim = useRef(0);

  const paint = useCallback(() => {
    const p = pos.current;
    const next = new Set<number>();
    for (let i = Math.max(0, Math.floor(p) - AHEAD); i <= Math.min(last, Math.ceil(p) + BEHIND); i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      next.add(i);
      const d = i - p;
      let y: number, z: number, rot: number, opacity: number, shade: number;
      if (d < 0) {
        // Flipped toward you: tips forward on its bottom edge and drops out of the way.
        const t = Math.min(1, -d);
        rot = -t * 84;
        y = t * 26 + Math.max(0, -d - 1) * 50;
        z = t * 30;
        opacity = d < -1 ? Math.max(0, 1 - (-d - 1) / (AHEAD - 1)) : 1;
        shade = 0;
      } else {
        // Standing behind: each one a step back and a step up, fading into the paper.
        rot = 0;
        y = -d * 19;
        z = -d * 64;
        opacity = d > BEHIND - 4 ? Math.max(0, (BEHIND - d) / 4) : 1;
        shade = Math.min(0.72, d * 0.085);
      }
      el.style.display = "block";
      el.style.zIndex = String(2000 - i);
      el.style.opacity = String(opacity);
      el.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${rot}deg)`;
      (el.lastElementChild as HTMLElement).style.opacity = String(shade);
      const img = el.querySelector("img");
      if (img && !img.getAttribute("src")) img.setAttribute("src", img.dataset.src!);
    }
    for (const i of shown.current) {
      if (!next.has(i)) {
        const el = cardRefs.current[i];
        if (el) el.style.display = "none";
      }
    }
    shown.current = next;
    const front = Math.min(last, Math.max(0, Math.round(p)));
    setCurrent((c) => (c === front ? c : front));
  }, [last]);

  useEffect(() => {
    paint();
    return () => cancelAnimationFrame(anim.current);
  }, [paint]);

  // Settle onto a whole tape with a spring that carries the release velocity (tapes per ms).
  const settle = useCallback(
    (target: number, velocity = 0) => {
      cancelAnimationFrame(anim.current);
      const to = Math.min(last, Math.max(0, Math.round(target)));
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        pos.current = to;
        paint();
        return;
      }
      const spring = solveSpring(0.42, 0.86, pos.current - to, velocity);
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = now - t0;
        const x = spring.position(t);
        pos.current = to + x;
        if (Math.abs(x) < 0.002 && Math.abs(spring.velocity(t)) < 0.00002) pos.current = to;
        else anim.current = requestAnimationFrame(tick);
        paint();
      };
      anim.current = requestAnimationFrame(tick);
    },
    [last, paint],
  );

  const step = useCallback((n: number) => settle(Math.round(pos.current) + n), [settle]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    const stage = e.currentTarget;
    const pressed = e.target as HTMLElement;
    const tracker = createVelocityTracker();
    tracker.reset();
    const y0 = e.clientY;
    const p0 = pos.current;
    let moved = false;
    bindDrag(stage, e.nativeEvent, {
      threshold: dragThreshold,
      onMove: ({ y, event }) => {
        moved = true;
        tracker.add(event.timeStamp, y);
        let p = p0 + (y - y0) / PX_PER_TAPE;
        // Past either end the crate resists instead of stopping dead.
        if (p < 0) p = -rubberBand(-p * PX_PER_TAPE, 260) / PX_PER_TAPE;
        if (p > last) p = last + rubberBand((p - last) * PX_PER_TAPE, 260) / PX_PER_TAPE;
        pos.current = p;
        paint();
      },
      onEnd: (event, canceled) => {
        if (!moved) {
          // A press that never became a drag: open the front tape if that's what was pressed.
          if (!canceled && pressed.closest("[data-front]")) router.push(`/tapes/${sorted[Math.round(pos.current)].id}`);
          return;
        }
        const v = canceled ? 0 : tracker.velocity(event.timeStamp); // px per ms
        settle(pos.current + projectDistance(v, 0.994) / PX_PER_TAPE, v / PX_PER_TAPE);
      },
    });
  };

  // A sideways trackpad swipe riffles too; vertical scrolling is left alone so the page still scrolls.
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      pos.current = Math.min(last + 0.4, Math.max(-0.4, pos.current + e.deltaX / 160));
      paint();
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
      wheelIdle.current = setTimeout(() => settle(pos.current), 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
    };
  }, [last, paint, settle]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, PageDown: 10, PageUp: -10 };
    if (e.key in map) {
      e.preventDefault();
      step(map[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      settle(0);
    } else if (e.key === "End") {
      e.preventDefault();
      settle(last);
    } else if (e.key === "Enter") {
      router.push(`/tapes/${sorted[current].id}`);
    }
  };

  const tape = sorted[current];

  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12" aria-label="Dig through the crate">
      <div
        ref={stageRef}
        role="group"
        tabIndex={0}
        aria-label="Crate of tapes, oldest first. Drag down or press the down arrow to flip forward, up to go back, Enter to open."
        aria-describedby="crate-now"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        data-proto-keys
        className="crate-stage relative mx-auto mt-6 h-[min(84vw,470px)] w-full max-w-[640px] cursor-grab touch-none select-none outline-none active:cursor-grabbing sm:h-[500px]"
      >
        <div className="absolute inset-x-0 bottom-6 mx-auto aspect-[3/2] w-[min(84vw,520px)] [transform-style:preserve-3d]">
          {sorted.map((t, i) => {
            const newYear = i === 0 || sorted[i - 1].released !== t.released;
            return (
              <div
                key={t.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-front={i === current ? "" : undefined}
                className="crate-card absolute inset-0 hidden origin-bottom will-change-transform"
              >
                {newYear && (
                  <span className="absolute -top-9 left-4 flex h-9 items-center bg-[var(--text)] px-3 font-display text-xl leading-none text-[var(--bg)]" aria-hidden>
                    {t.released}
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img data-src={cover(t, 800)} alt="" draggable={false} className="h-full w-full border-[1.5px] border-[var(--text)] bg-[var(--bg-hover)] object-contain" />
                <span className="pointer-events-none absolute inset-0 bg-[var(--bg)]" style={{ opacity: 0 }} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-2 flex max-w-[640px] items-start gap-3">
        <button type="button" onClick={() => step(-1)} disabled={current === 0} aria-label="Previous tape" className="cursor-pointer grid h-11 w-11 flex-none place-items-center border-[1.5px] border-[var(--text)] text-[var(--text)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--border)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <div id="crate-now" aria-live="polite" className="min-h-[9.5rem] min-w-0 flex-1 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] tabular-nums">
            {String(current + 1).padStart(3, "0")} of {sorted.length} · {tape.released}
          </p>
          <h2 className="mt-2 line-clamp-2 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-5xl">{djLine(tape)}</h2>
          <p className="mt-2 truncate text-base text-[var(--text)]">{tape.title}</p>
        </div>
        <button type="button" onClick={() => step(1)} disabled={current === last} aria-label="Next tape" className="cursor-pointer grid h-11 w-11 flex-none place-items-center border-[1.5px] border-[var(--text)] text-[var(--text)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--border)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className="mt-4 text-center">
        <Link href={`/tapes/${tape.id}`} className="poster-btn min-h-11">
          Open this tape
        </Link>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Flick down to dig · flick harder to dig faster</p>
      </div>
    </section>
  );
}
