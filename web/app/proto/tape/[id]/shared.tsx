"use client";

// PROTOTYPE (SIM-43): what the four directions share. Throwaway.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlaceholderCassetteLive } from "../../../../components/PlaceholderCassetteLive";
import { TapeGallery } from "../../../../components/TapeGallery";
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
    // Where the words lead, they take the full height of the images beside them: the name at the top, level
    // with the top of the images, and the rest at the foot, directly over the player.
    <header className={big ? "lg:flex lg:h-full lg:flex-col lg:justify-between" : undefined}>
      <h1 className={`font-display text-4xl sm:text-5xl ${big ? "lg:text-6xl" : ""} leading-[0.95] text-[var(--text)] mb-6 text-balance`}>{tape.title}</h1>
      <div>
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
      </div>
    </header>
  );
}

/** The tape's images: the real gallery, or the live cassette for a tape with no cover. */
export function Pictures({ tape }: { tape: TapeView }) {
  return tape.placeholderLabel ? <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={tape.placeholderLabel} /> : <TapeGallery allImages={tape.images} />;
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
