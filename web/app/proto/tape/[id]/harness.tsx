"use client";

// PROTOTYPE (SIM-43): the picker and the stage. Throwaway. The picker's look and keys are the prototype
// skill's spec, unchanged: 1–4 and ←/→ switch, the choice is kept in the address as ?v=.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./proto.css";
import { Band, Bars } from "./band";
import { Contents } from "./contents";
import type { TapeView } from "./shared";
import { Spare } from "./spare";

// Round 2: riffs on "Band", the direction chosen from round 1 (Column, Sides and Sheet are out).
const VARIANTS = [
  { name: "Band", Component: Band },
  { name: "Bars", Component: Bars },
  { name: "Contents", Component: Contents },
  { name: "Spare", Component: Spare },
];

export function Harness({ tape }: { tape: TapeView }) {
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const highlight = useRef<HTMLSpanElement>(null);

  const choose = useCallback((i: number) => {
    if (i < 0 || i >= VARIANTS.length) return;
    setCurrent(i);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(i + 1));
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // The choice in the address is taken up after the page has been attached, so the two agree while it is.
  useEffect(() => {
    const asked = (parseInt(new URLSearchParams(window.location.search).get("v") ?? "", 10) || 1) - 1;
    if (asked > 0 && asked < VARIANTS.length) setCurrent(asked);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    const place = () => {
      const el = items.current[current];
      if (!el || !highlight.current) return;
      highlight.current.style.width = `${el.offsetWidth}px`;
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) choose(num - 1);
      else if (e.key === "ArrowRight") choose((current + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") choose((current - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [choose, current]);

  const { Component } = VARIANTS[current];
  return (
    <>
      <Component key={current} tape={tape} />
      <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
        <span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            ref={(el) => {
              items.current[i] = el;
            }}
            type="button"
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => choose(i)}
          >
            {v.name}
          </button>
        ))}
      </nav>
    </>
  );
}
