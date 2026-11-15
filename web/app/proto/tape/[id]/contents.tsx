"use client";

// PROTOTYPE (SIM-43), round 3. One page, four ways to arrange it. All of them have the tape's words, its list
// of sides, a cover held in a box 320px tall, the bar and the track line; they differ in where the bar is.
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { sideCredit } from "../../../../components/PlaylistPlayer";
import { TrackIds } from "../../../../components/TrackIds";
import { Cover, Words, failed, useTapePlayer, type TapeView } from "./shared";

/**
 * contents:       the words and the sides on the left, the cover on the right, and the bar across the whole
 *                 page beneath them. Chosen from round 2. A tape with one recording has no list, so its left
 *                 column is mostly empty.
 * beside:         contents, except that on a tape with one recording the bar moves up into the empty column.
 *                 Its track line stays under the block, at full width.
 * column:         today's page with the image given less of the width (30rem, not the 700px it has now): the
 *                 cover on the left, and everything else in one column beside it, the bar and track line too.
 * column-flipped: column with the cover on the right.
 */
export type Variant = "contents" | "beside" | "column" | "column-flipped";

export function Contents({ tape, variant }: { tape: TapeView; variant: Variant }) {
  const player = useTapePlayer(tape);
  const { current, track, state, controls, goTo } = player;
  if (state.error) return failed(state.error);
  const ids = player.ids[track.index] ?? [];
  const started = state.isPlaying || state.isLoading || state.currentTime > 0;
  const listed = tape.tracks.length > 1;
  const twoUp = tape.tracks.length > 4;
  const half = Math.ceil(tape.tracks.length / 2);

  const column = variant === "column" || variant === "column-flipped";
  const besideCover = variant === "beside" && !listed;
  const coverLeft = variant === "column";

  const line = <TrackIds key={track.position} tapeId={tape.id} position={tape.sideCount > 1 ? track.position : null} ids={ids} time={state.currentTime} onPosted={player.refresh} />;
  // Across the page the bar is taller than the real page's; in a column it is the real page's height.
  const bar = (
    <div className={column ? undefined : "proto-wide"}>
      {player.audio}
      <PlayerControls
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        isLoading={state.isLoading}
        title={track.title}
        wave={track.wave}
        length={track.length}
        showTimes={!listed}
        ids={ids}
        onPlay={controls.play}
        onPause={controls.pause}
        onSeek={controls.seek}
      >
        {!besideCover && line}
      </PlayerControls>
    </div>
  );
  const cover = (
    <div className="hidden lg:block">
      <Cover tape={tape} side={coverLeft ? "left" : "right"} />
    </div>
  );
  const columns = variant === "column" ? "lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]" : variant === "column-flipped" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]";

  return (
    <>
      <div className={`lg:grid lg:gap-10 ${columns} ${column ? "mb-12" : besideCover ? "" : "mb-8 lg:mb-10"} ${besideCover ? "" : "lg:items-start"}`}>
        {coverLeft && cover}
        <div className={besideCover ? "lg:flex lg:flex-col lg:justify-between" : undefined}>
          <Words tape={tape} />
          {listed && (
            // Past four sides the list runs in two columns, so a set of eight is four rows tall and not eight.
            // It is a grid filled a column at a time: the first half on the left, and a row in one column is
            // as tall as the row beside it, so the rules line up across the two.
            <div className={`mt-8 ${twoUp ? "lg:grid lg:grid-flow-col lg:grid-cols-2 lg:gap-x-10" : ""}`} style={twoUp ? { gridTemplateRows: `repeat(${half}, auto)` } : undefined}>
              {tape.tracks.map((t, i) => {
                const on = i === current;
                const length = on && state.duration > 0 ? state.duration : t.length;
                return (
                  <button
                    key={t.position}
                    type="button"
                    onClick={() => (on ? (state.isPlaying ? controls.pause() : controls.play()) : goTo(i, 0))}
                    aria-current={on ? "true" : undefined}
                    className={`player-side grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 border-b border-[var(--border)] py-2.5 text-left cursor-pointer ${i === 0 ? "border-t" : twoUp && i === half ? "lg:border-t" : ""} ${on ? "text-[var(--text)]" : "text-[var(--muted)]"}`}
                  >
                    <svg className="h-3.5 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
                      {on && state.isPlaying ? <path d="M0 0h4v14H0zM8 0h4v14H8z" /> : <path d="M0 0v14l11-7z" />}
                    </svg>
                    <span className="min-w-0 text-balance">
                      <span className="font-display text-base leading-tight">{t.title}</span>
                      {sideCredit(t) && <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{sideCredit(t)}</span>}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">
                      {on && started && (
                        <span aria-hidden>
                          <span className="text-[var(--text)]">{formatTime(state.currentTime)}</span> /{" "}
                        </span>
                      )}
                      {length ? formatTime(length) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {(column || besideCover) && <div className="mt-8">{bar}</div>}
        </div>
        {!coverLeft && cover}
      </div>

      {/* Beside the cover the bar is half the page wide. Its track line stays under the whole block, so the
          fields it opens into are as wide as they are under a bar that runs across the page. */}
      {besideCover ? <div className="mb-12 pl-14">{line}</div> : !column && <div className="mb-12">{bar}</div>}

      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}
