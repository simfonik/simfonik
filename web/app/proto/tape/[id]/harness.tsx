"use client";

// PROTOTYPE (SIM-43): the picker, the stage, and one control. Throwaway. The picker's look and keys are the
// prototype skill's spec, unchanged: the number keys and ←/→ switch, the choice is kept in the address as ?v=.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./proto.css";
import { Contents, type Variant } from "./contents";
import type { TapeView } from "./shared";
import { Today } from "./today";

// Round 3. "Contents" was chosen from round 2; "Foot" and "Middle" (the words moved down the empty column of a
// tape with one recording) were tried and dropped as tricks. What each of these is, is said where it is made.
const variant = (name: Variant) =>
  function Shown({ tape }: { tape: TapeView }) {
    return <Contents tape={tape} variant={name} />;
  };
const VARIANTS = [
  { name: "Contents", Component: variant("contents") },
  { name: "Beside", Component: variant("beside") },
  { name: "Column", Component: variant("column") },
  { name: "Column, flipped", Component: variant("column-flipped") },
  { name: "Today", Component: Today, split: true },
];

/** The live page's image column at a 1280px window, the top of the slider. */
const LIVE = 708;
const START = 480;

/**
 * "Today" has one number nobody has chosen yet: how wide the image column is. It is on a slider, which writes
 * the width to a CSS variable on the page (the page is not rendered again as it moves) and shows the two
 * columns' widths, so the one that looks right can be read off and kept.
 */
function Split() {
  const [image, setImage] = useState(START);
  const [words, setWords] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--image-column", `${image}px`);
    const measure = () => setWords(Math.round(document.querySelector("[data-proto-words]")?.getBoundingClientRect().width ?? 0) || null);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [image]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const summary = `image column ${image}px · words column ${words ?? "?"}px`;
  return (
    <div className="proto-panel">
      <label htmlFor="proto-split">Image column</label>
      <input id="proto-split" type="range" min={280} max={LIVE} step={4} value={image} onChange={(e) => setImage(Number(e.target.value))} />
      <output htmlFor="proto-split">
        {image}px{image === LIVE ? " (live)" : ""} · words {words ?? "…"}px
      </output>
      <button type="button" onClick={() => navigator.clipboard.writeText(summary).then(() => setCopied(true))}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

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

  const { Component, split } = VARIANTS[current];
  return (
    <>
      <Component key={current} tape={tape} />
      {split && <Split />}
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
