"use client";

// The tape's audio: one element per side, which side is playing, how long each runs, and the frame loop that
// keeps the page in step while it plays.
import { useCallback, useEffect, useRef, useState } from "react";

export type TapeAudio = ReturnType<typeof useTapeAudio>;

export function useTapeAudio(sideCount: number) {
  const audios = useRef<(HTMLAudioElement | null)[]>([]);
  // A side's real length, once its audio has reported it. Until then nothing is assumed about where it ends.
  const [durations, setDurations] = useState<(number | null)[]>(() => Array.from({ length: sideCount }, () => null));
  const [failed, setFailed] = useState<boolean[]>(() => Array.from({ length: sideCount }, () => false));
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  // What to draw each frame while playing. The timeline sets it; the loop here only keeps time.
  const painter = useRef<() => void>(() => {});
  // React hears the time once a second, not sixty times: the playhead is moved without it.
  const lastSecond = useRef(-1);
  const hear = useCallback((t: number) => {
    if (Math.floor(t) === lastSecond.current) return;
    lastSecond.current = Math.floor(t);
    setNow(t);
  }, []);
  const loop = useRef(0);
  const run = useCallback(() => {
    cancelAnimationFrame(loop.current);
    const tick = () => {
      painter.current();
      const a = audios.current[activeRef.current];
      if (a && !a.paused) loop.current = requestAnimationFrame(tick);
    };
    loop.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const offs = audios.current.map((a, i) => {
      if (!a) return () => {};
      const meta = () => {
        if (Number.isFinite(a.duration)) setDurations((d) => d.map((v, j) => (j === i ? Math.round(a.duration) : v)));
      };
      // Whichever side's event this is, the button reflects the side that is active now. The side being
      // left pauses a moment after the switch, and must not leave the button stuck on "Pause".
      const sync = () => {
        const current = audios.current[activeRef.current];
        setPlaying(Boolean(current && !current.paused));
        run();
      };
      const error = () => {
        if (a.getAttribute("src")) setFailed((f) => f.map((v, j) => (j === i ? true : v)));
      };
      if (a.readyState >= 1) meta();
      if (a.error) error();
      a.addEventListener("loadedmetadata", meta);
      a.addEventListener("play", sync);
      a.addEventListener("pause", sync);
      a.addEventListener("error", error);
      return () => {
        a.removeEventListener("loadedmetadata", meta);
        a.removeEventListener("play", sync);
        a.removeEventListener("pause", sync);
        a.removeEventListener("error", error);
      };
    });
    return () => {
      offs.forEach((off) => off());
      cancelAnimationFrame(loop.current);
    };
  }, [run]);

  const seek = useCallback(
    (side: number, t: number, play?: boolean) => {
      // Read this before silencing the other side: changing sides mid-play should keep playing.
      const wasPlaying = audios.current.some((x) => x && !x.paused);
      audios.current.forEach((a, i) => i !== side && a?.pause());
      const a = audios.current[side];
      setActive(side);
      activeRef.current = side;
      if (!a) return;
      a.currentTime = Math.max(0, t);
      lastSecond.current = -1;
      if (play ?? wasPlaying) a.play().catch(() => {});
      run();
    },
    [run],
  );
  const toggle = useCallback(() => {
    const a = audios.current[activeRef.current];
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  return { audios, durations, failed, active, activeRef, playing, now, seek, toggle, painter, hear };
}
