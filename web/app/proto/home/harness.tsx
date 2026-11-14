"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProtoTape } from "./shared";
import { Wall } from "./variants/wall";
import { Atlas } from "./variants/atlas";
import { Crate } from "./variants/crate";
import { Flyer } from "./variants/flyer";

type VariantProps = { tapes: ProtoTape[] };
const VARIANTS: { name: string; Component: React.ComponentType<VariantProps> }[] = [
  { name: "Wall", Component: Wall },
  { name: "Atlas", Component: Atlas },
  { name: "Crate", Component: Crate },
  { name: "Flyer", Component: Flyer },
];

export function Harness({ tapes }: { tapes: ProtoTape[] }) {
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setActive = useCallback((i: number) => {
    if (i < 0 || i >= VARIANTS.length) return;
    setCurrent(i);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(i + 1));
    window.history.replaceState(null, "", url);
  }, []);

  // Initial variant from ?v=, then enable the highlight slide after first paint.
  useEffect(() => {
    const v = (parseInt(new URLSearchParams(window.location.search).get("v") ?? "", 10) || 1) - 1;
    if (v >= 0 && v < VARIANTS.length) setCurrent(v);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[current];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  useLayoutEffect(() => {
    moveHighlight();
    window.addEventListener("resize", moveHighlight);
    return () => window.removeEventListener("resize", moveHighlight);
  }, [moveHighlight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      // Variants own the arrow and number keys while focus is inside their widgets.
      if (target.closest("[data-proto-keys]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setActive(num - 1);
      else if (e.key === "ArrowRight") setActive((current + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setActive((current - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, setActive]);

  const Active = VARIANTS[current].Component;

  return (
    <>
      <div className="pb-24">
        <Active key={current} tapes={tapes} />
      </div>
      <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setActive(i)}
          >
            {v.name}
          </button>
        ))}
      </nav>
    </>
  );
}
