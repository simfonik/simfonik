"use client";

// PROTOTYPE (SIM-43): "Contents", the direction chosen in round 2. The tape's words and its list of sides are
// on the left, the cover is on the right, and the bar runs the full width beneath with the track line under it.
//
// Round 3 is about a tape with one recording (15 of the 227). It has no list, so beside a cover 320px tall
// its left column holds 130px of words. `single` is how that column is filled; it changes nothing on a tape
// with sides.
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { sideCredit } from "../../../../components/PlaylistPlayer";
import { TrackIds } from "../../../../components/TrackIds";
import { Cover, Words, failed, useTapePlayer, type TapeView } from "./shared";

/**
 * top:    the words keep the top of the column and the rest is left empty (round 2, the baseline).
 * foot:   the words sit at the foot of the cover, on the bar they name.
 * middle: the words are centred against the cover.
 * beside: the bar moves up into the column, at the foot of the cover, and the block ends where the cover does.
 */
export type Single = "top" | "foot" | "middle" | "beside";

const COLUMN: Record<Single, string> = {
  top: "",
  foot: "lg:flex lg:flex-col lg:justify-end",
  middle: "lg:flex lg:flex-col lg:justify-center",
  beside: "lg:flex lg:flex-col lg:justify-between",
};

export function Contents({ tape, single }: { tape: TapeView; single: Single }) {
  const player = useTapePlayer(tape);
  const { current, track, state, controls, goTo } = player;
  if (state.error) return failed(state.error);
  const ids = player.ids[track.index] ?? [];
  const started = state.isPlaying || state.isLoading || state.currentTime > 0;
  const listed = tape.tracks.length > 1;
  const beside = !listed && single === "beside";
  const twoUp = tape.tracks.length > 4;
  const half = Math.ceil(tape.tracks.length / 2);

  const line = <TrackIds key={track.position} tapeId={tape.id} position={tape.sideCount > 1 ? track.position : null} ids={ids} time={state.currentTime} onPosted={player.refresh} />;
  const bar = (
    <div className="proto-wide">
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
        {!beside && line}
      </PlayerControls>
    </div>
  );

  return (
    <>
      <div className={`lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-10 ${beside ? "" : "mb-8 lg:mb-10"} ${listed || single === "top" ? "lg:items-start" : ""}`}>
        <div className={listed ? "" : COLUMN[single]}>
          <Words tape={tape} />
          {beside && <div className="mt-8">{bar}</div>}
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
        </div>
        <div className="hidden lg:block">
          <Cover tape={tape} />
        </div>
      </div>

      {/* Beside the cover the bar is half the page wide. The track line stays under the whole block, so the
          fields it opens into are as wide as they are everywhere else. */}
      {beside ? <div className="mb-12 pl-14">{line}</div> : <div className="mb-12">{bar}</div>}

      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}
