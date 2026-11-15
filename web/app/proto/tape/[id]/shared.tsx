"use client";

// PROTOTYPE (SIM-43): what the four directions share. Throwaway.
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  images: { src: string; label: string; tapeId?: string; sidePosition?: string }[];
  placeholderLabel: string | null;
  sideCount: number;
  unlabelled: boolean;
  tracks: Track[];
};

/** The tape's name, who made it, and the small print. `big` is for where the words lead the page. */
export function Words({ tape, big = false }: { tape: TapeView; big?: boolean }) {
  return (
    <header>
      <h1 className={`font-display text-4xl sm:text-5xl ${big ? "lg:text-6xl" : ""} leading-[0.95] text-[var(--text)] mb-6 text-balance`}>{tape.title}</h1>
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
 * The images where the words lead the page: one of them, the cover, held to a height so it never sets the
 * height of the row. Pressing it opens all of them, large, one at a time. (The real gallery runs a strip of
 * thumbnails down the side, and on a set with nine images the strip is taller than the image.)
 */
export function Cover({ tape }: { tape: TapeView }) {
  const [viewing, setViewing] = useState(false);
  if (tape.placeholderLabel) return <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={tape.placeholderLabel} />;
  const count = tape.images.length;
  return (
    <>
      <button type="button" onClick={() => setViewing(true)} className="proto-cover" aria-label={count > 1 ? `View all ${count} images` : "View the image larger"}>
        <Image
          loader={imageLoader}
          src={tape.images[0].src}
          alt={tape.images[0].label}
          width={800}
          height={600}
          priority
          sizes="(max-width: 1024px) 100vw, 576px"
          className="block h-auto max-h-[20rem] w-full object-contain object-right-top"
        />
        {count > 1 && <span className="proto-cover-count">{count} images</span>}
      </button>
      {viewing && <Viewer images={tape.images} onClose={() => setViewing(false)} />}
    </>
  );
}

/**
 * Every image of the tape, one to a screen: swiped through on a phone, stepped through with the arrows on
 * screen or on the keyboard. The browser's own modal dialog, so Escape shuts it and the keyboard goes back
 * to the cover.
 */
function Viewer({ images, onClose }: { images: TapeView["images"]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  useLayoutEffect(() => {
    dialog.current?.showModal();
  }, []);
  // A press on an arrow glides to the next image; the keyboard steps there at once.
  const go = (to: number, glide: boolean) => {
    const el = track.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, Math.min(images.length - 1, to)) * el.clientWidth, behavior: glide && !still ? "smooth" : "auto" });
  };
  return (
    <dialog
      ref={dialog}
      className="proto-viewer"
      aria-label="Images of the tape"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(at + 1, false);
        else if (e.key === "ArrowLeft") go(at - 1, false);
      }}
    >
      <div ref={track} className="proto-viewer-track" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {images.map((img, i) => (
          <figure key={img.src} className="proto-viewer-slide">
            <div className="relative h-full w-full">
              <Image loader={imageLoader} src={img.src} alt={img.label} fill sizes="100vw" priority={i === 0} className="object-contain" />
            </div>
          </figure>
        ))}
      </div>
      <button type="button" className="proto-viewer-button" data-place="close" aria-label="Close" onClick={() => dialog.current?.close()}>
        <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="proto-viewer-button" data-place="before" aria-label="Previous image" aria-disabled={at === 0} onClick={() => go(at - 1, true)}>
            <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M9 1L3 7l6 6" />
            </svg>
          </button>
          <button type="button" className="proto-viewer-button" data-place="after" aria-label="Next image" aria-disabled={at === images.length - 1} onClick={() => go(at + 1, true)}>
            <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M5 1l6 6-6 6" />
            </svg>
          </button>
          <p className="proto-viewer-count" aria-live="polite">
            {at + 1} / {images.length}
          </p>
        </>
      )}
    </dialog>
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
