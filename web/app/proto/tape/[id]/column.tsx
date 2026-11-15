"use client";

// PROTOTYPE (SIM-43): the real page's own player, as "Band" uses it. (Round 1's "Column", today's layout,
// was the baseline and is out.)
import { AudioPlayer } from "../../../../components/AudioPlayer";
import { PlaylistPlayer } from "../../../../components/PlaylistPlayer";
import type { TapeView } from "./shared";

export function Player({ tape }: { tape: TapeView }) {
  if (tape.tracks.length >= 2) return <PlaylistPlayer tracks={tape.tracks} tapeId={tape.id} sideCount={tape.sideCount} />;
  const track = tape.tracks[0];
  if (!track) return null;
  return (
    <div>
      {!tape.unlabelled && <h2 className="font-display text-xl leading-tight text-[var(--text)] mb-2">{track.title}</h2>}
      <AudioPlayer src={track.url} title={tape.unlabelled ? undefined : track.title} tapeId={tape.id} sidePosition={track.position} sideIndex={track.index} sideCount={tape.sideCount} wave={track.wave} length={track.length} />
    </div>
  );
}
