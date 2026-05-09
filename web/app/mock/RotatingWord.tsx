"use client";

import { useEffect, useRef, useState } from "react";

const WORDS = ["Leave a Comment", "Give Some Love", "Share a Memory", "ID a Track"];
const INTERVAL_MS = 2800;
const SCRAMBLE_MS = 700;
const TICK_MS = 50;
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

export function RotatingWord() {
  const [text, setText] = useState(WORDS[0]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    let scrambleTimer: ReturnType<typeof setInterval> | null = null;

    const cycle = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % WORDS.length;
      const fromText = WORDS[indexRef.current];
      const toText = WORDS[nextIndex];
      indexRef.current = nextIndex;

      const start = performance.now();
      const len = Math.max(fromText.length, toText.length);

      if (scrambleTimer) clearInterval(scrambleTimer);
      scrambleTimer = setInterval(() => {
        const elapsed = performance.now() - start;
        const progress = Math.min(elapsed / SCRAMBLE_MS, 1);
        const settled = Math.floor(progress * len);

        let frame = "";
        for (let i = 0; i < len; i++) {
          const targetChar = toText[i];
          if (targetChar === " " || targetChar === undefined) {
            frame += targetChar ?? "";
            continue;
          }
          frame += i < settled ? targetChar : randomChar();
        }
        setText(frame);

        if (progress >= 1) {
          setText(toText);
          if (scrambleTimer) clearInterval(scrambleTimer);
          scrambleTimer = null;
        }
      }, TICK_MS);
    }, INTERVAL_MS);

    return () => {
      clearInterval(cycle);
      if (scrambleTimer) clearInterval(scrambleTimer);
    };
  }, [reduceMotion]);

  return <span className="mock-rotating-word">{text}</span>;
}
