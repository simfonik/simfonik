"use client";

// PROTOTYPE (SIM-43): the parts of the page that every variant uses. Throwaway.
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import imageLoader from "../../../../lib/imageLoader";
import { PlaceholderCassetteLive } from "../../../../components/PlaceholderCassetteLive";
import { useTapeTrackIds } from "../../../../components/TapeTrackIds";
import { useAudioPlayer } from "../../../../hooks/useAudioPlayer";

export type Track = { title: string; url: string; position: string; index: number; djs?: { name: string; slug: string }[]; wave: number[] | null; length: number | null };
export type TapeView = {
  id: string;
  title: string;
  djs: { name: string; slug: string; link: boolean }[];
  released: string | null;
  series: { slug: string; name: string }[];
  source: { name: string; url: string | null } | null;
  /** `width` and `height` are the scan's own, in pixels, read from the file when the page is built. */
  images: { src: string; label: string; tapeId?: string; sidePosition?: string; width: number; height: number }[];
  placeholderLabel: string | null;
  sideCount: number;
  unlabelled: boolean;
  tracks: Track[];
};

/** The tape's name, who made it, and the small print. */
export function Words({ tape }: { tape: TapeView }) {
  return (
    <header>
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-6 text-balance">{tape.title}</h1>
      <div className="flex gap-2 flex-wrap mb-6">
        {tape.djs.map((dj) =>
          dj.link ? (
            <Link key={dj.slug} href={`/djs/${dj.slug}`} className="dj-link">
              {dj.name}
            </Link>
          ) : (
            <span key={dj.slug} className="dj-link cursor-default">
              {dj.name}
            </span>
          ),
        )}
      </div>
      <div className="space-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {tape.released && <p>Released · {tape.released}</p>}
        {tape.series.length > 0 && (
          <p>
            Series ·{" "}
            {tape.series.map((s, i) => (
              <span key={s.slug}>
                {i > 0 && ", "}
                <Link href={`/series/${s.slug}`} className="hover:text-[var(--accent-text)] transition-colors">
                  {s.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        {tape.source && (
          <p>
            Source ·{" "}
            {tape.source.url ? (
              <a href={tape.source.url} target="_blank" rel="nofollow noopener noreferrer" className="hover:text-[var(--accent-text)] transition-colors">
                {tape.source.name}
              </a>
            ) : (
              tape.source.name
            )}
          </p>
        )}
      </div>
    </header>
  );
}

/**
 * The images where the words lead the page: one at a time, in a box of a fixed height, so the picture never
 * sets the height of the row and nothing moves when another is chosen. The others are a row of small
 * thumbnails under it, and pressing one puts it in the box. (The real gallery runs its thumbnails down the
 * side, and on a set with nine images that strip is taller than the picture. A full-screen viewer was tried
 * and dropped: it blew small scans up far past their size.)
 */
export function Cover({ tape, side = "right" }: { tape: TapeView; side?: "left" | "right" }) {
  const [chosen, setChosen] = useState(tape.images[0]?.src ?? "");
  if (tape.placeholderLabel) return <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={tape.placeholderLabel} />;
  const shown = tape.images.find((img) => img.src === chosen) ?? tape.images[0];
  // The picture is held to the edge of the page it is nearest, so that edge is straight whatever its shape.
  const right = side === "right";
  return (
    <div>
      <div className="relative h-56 sm:h-80">
        <Image loader={imageLoader} key={shown.src} src={shown.src} alt={shown.label} fill priority sizes="(max-width: 1024px) 100vw, 576px" className={`object-contain object-top ${right ? "lg:object-right-top" : "lg:object-left-top"}`} />
      </div>
      {tape.images.length > 1 && (
        // Nine thumbnails, the most a tape has (a cover and eight sides), fill the narrowest column exactly.
        <div className={`mt-3 flex flex-wrap gap-1.5 ${right ? "lg:justify-end" : ""}`}>
          {tape.images.map((img) => (
            <button key={img.src} type="button" onClick={() => setChosen(img.src)} aria-label={img.label} aria-pressed={img.src === shown.src} title={img.label} className="proto-thumb">
              <Image loader={imageLoader} src={img.src} alt="" fill sizes="48px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const failed = (message: string) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-500 border-[1.5px] border-red-500 px-3 py-2">{message}</p>
);

/**
 * One audio element for the whole tape, as the real playlist player has: which side is loaded, a way to go
 * to a moment on any side, and the tape's IDs. For the directions that lay the sides out their own way.
 */
export function useTapePlayer(tape: TapeView) {
  const { tracks } = tape;
  const [current, setCurrent] = useState(0);
  const track = tracks[current];
  const next = useCallback(() => setCurrent((i) => Math.min(i + 1, tracks.length - 1)), [tracks.length]);
  const { ref, state, controls } = useAudioPlayer({ src: track.url, tapeId: tape.id, sidePosition: track.position, onEnded: current < tracks.length - 1 ? next : undefined });
  const shared = useTapeTrackIds();
  const { play, seek } = controls;
  const { isPlaying } = state;

  // Loading a side starts it from zero, so a place asked for on another side is gone to once that side is in.
  const wanted = useRef<number | null>(null);
  useEffect(() => {
    if (wanted.current === null) return;
    seek(wanted.current);
    wanted.current = null;
  }, [current, seek]);
  const goTo = useCallback(
    (index: number, time: number) => {
      if (index === current) seek(time);
      else {
        wanted.current = time;
        setCurrent(index);
      }
      if (!isPlaying) play();
    },
    [current, isPlaying, play, seek],
  );

  // A time pressed in a comment.
  const { setPlayer } = shared;
  useEffect(() => {
    setPlayer((position, time) => {
      const index = position === null ? current : tracks.findIndex((t) => t.position === position);
      if (index >= 0) goTo(index, time);
    });
    return () => setPlayer(null);
  }, [setPlayer, tracks, current, goTo]);

  return { audio: <audio ref={ref} src={track.url} preload="none" playsInline />, current, track, state, controls, goTo, ids: shared.sides, refresh: shared.refresh };
}
