"use client";

// Play, what is playing, where in the side, and the one thing to do about it. Two layouts of the same
// controls: a row above the timeline with a mouse, and a bar pinned under the thumb on a phone. Both are in the
// page and the stylesheet shows the one that fits the pointer, so a phone never paints the mouse layout first.
import { clock, cueLabel, type Cue } from "./tracklist-primitive";

/**
 * Play, or pause while playing, as the sign everyone knows. It marks the one button here that is not an edit,
 * and it reads at a glance where a word that changes has to be read. The triangle's box sits a pixel right
 * of centre, because its weight is on its left.
 */
const PlayGlyph = ({ playing }: { playing: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
    {playing ? <path d="M2 1h3.5v12H2zM8.5 1H12v12H8.5z" /> : <path d="M3 1l10 6-10 6z" />}
  </svg>
);

type Controls = {
  audioFailed: boolean;
  playing: boolean;
  /** The side that is playing, and the second it has reached. */
  side: string;
  now: number;
  onToggle: () => void;
  onId: (id: string) => void;
  onMark: () => void;
};

/**
 * With a mouse, on one line: the button, the clock and the action all sit on the track's name, and who ID'd it
 * hangs below the name alone. The button says whether it is playing and the clock says where, so neither is
 * said twice.
 */
export function Player({
  audioFailed,
  playing,
  cue,
  side,
  now,
  duration,
  onToggle,
  onId,
  onMark,
}: Controls & {
  /** The track under the playhead. */
  cue: Cue | null;
  /** The side's length once its audio has said, else null. */
  duration: number | null;
}) {
  return (
    <div className="ts-fine-only ts-player mt-6 border-t-[1.5px] border-[var(--text)] pt-5">
      <button type="button" onClick={onToggle} disabled={audioFailed} className="ts-btn ts-btn-solid ts-play" aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space">
        <PlayGlyph playing={playing} />
      </button>
      <p className="ts-player-title truncate font-display text-3xl leading-tight text-[var(--text)] sm:text-4xl" title={cue?.known ? cueLabel(cue) : undefined}>{cue ? (cue.known ? cueLabel(cue) : "Unknown track") : "Nothing ID’d here yet"}</p>
      <p className="flex-none font-mono text-sm tabular-nums text-[var(--text)]">
        <span className="sr-only">Side </span>
        {side} {clock(now)} <span className="text-[var(--muted)]">/ {duration === null ? "–:––:––" : clock(duration)}</span>
      </p>
      <div className="flex flex-none flex-wrap items-center gap-2">
        {/* Both actions keep their place and their size whatever is playing. Only the fill changes, to show
            which one matters now: ID an unknown, or mark a track where nothing is marked. Neither the clock
            nor the buttons shift when the tape moves on to the next track. */}
        <button type="button" onClick={() => cue && onId(cue.id)} disabled={!cue} className={`ts-btn min-w-[7.5rem] ${cue && !cue.known ? "ts-btn-solid" : ""}`}>
          {cue?.known ? "Fix ID" : "ID track"}
        </button>
        <button type="button" onClick={onMark} className={`ts-btn ${cue ? "" : "ts-btn-solid"}`} aria-keyshortcuts="M" title="Mark where a new track starts, at the current time (M)">
          Mark new track
        </button>
      </div>
      <p className="ts-player-sub min-h-[1.25rem] truncate text-sm text-[var(--muted)]">
          {audioFailed
            ? `Side ${side}’s audio didn’t load. Check your connection and reload the page.`
            : cue
              ? cue.known
                ? cue.by
                  ? `ID’d by ${cue.by}`
                  : "ID’d by you"
                : cue.title
                  ? `Nobody has ID’d it. Clue: “${cue.title}”`
                  : "Nobody has ID’d this one. Do you know it?"
              : "Know what’s playing? Mark it."}
        </p>
    </div>
  );
}

/** On a phone: play, the clock and the two ID actions stay under the thumb wherever the page is scrolled. */
export function PhoneBar({
  audioFailed,
  playing,
  subject,
  empty,
  side,
  now,
  onToggle,
  onId,
  onMark,
}: Controls & {
  /** The track the ID button acts on. */
  subject: Cue | null;
  /** Nothing is marked on the part of the tape being shown. */
  empty: boolean;
}) {
  return (
    <div className="ts-bar" role="group" aria-label="Player">
      {/* Two lines, always: artist over title, as on a record's label. On one line a name was cut off after a
          few words, and this is the only place a phone shows it. They are about the track the button acts
          on (the one tapped, else the one playing, the same rule as the fields on a desktop). When there is
          no such track, the second line says what to do. */}
      <div className="ts-bar-now">
        <p className="ts-bar-line">
          <span className="min-w-0 flex-1 truncate">
            {audioFailed ? "This side’s audio didn’t load" : subject ? (subject.known ? subject.artist || subject.title : "Unknown track") : empty ? "Nothing marked yet" : "Nothing ID’d here yet"}
          </span>
          <span className="flex-none font-mono text-xs font-normal tabular-nums text-[var(--muted)]">
            {side} {clock(now)}
          </span>
        </p>
        <p className="ts-bar-line ts-bar-sub">
          <span className="min-w-0 flex-1 truncate">
            {audioFailed
              ? ""
              : subject
                ? subject.known
                  ? subject.artist
                    ? subject.title
                    : ""
                  : subject.title
                    ? `Clue: “${subject.title}”`
                    : "Nobody has ID’d it yet"
                : empty
                  ? "Play, then tap “New track”."
                  : "Tap a track to play it, then “ID track”."}
          </span>
        </p>
      </div>
      <div className="ts-bar-row">
        <button type="button" onClick={onToggle} disabled={audioFailed} className="ts-bar-btn ts-bar-primary" aria-label={playing ? "Pause" : "Play"}>
          <PlayGlyph playing={playing} />
        </button>
        {/* Always here, so the button beside it never moves under the thumb. */}
        <button type="button" onClick={() => subject && onId(subject.id)} disabled={!subject} className="ts-bar-btn">
          {subject?.known ? "Fix ID" : "ID track"}
        </button>
        <button type="button" onClick={onMark} className="ts-bar-btn">
          New track
        </button>
      </div>
    </div>
  );
}
