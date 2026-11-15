"use client";

// PROTOTYPE (SIM-43), round 3: "Today". The live page as it is, with the live player. What the panel in
// harness.tsx can change, all of it in proto.css through variables and attributes on the page:
//   - the split between the two columns (`--image-column`; the live page gives the words 500px and the image
//     the rest, about 700px), and which side the image is on (a real flip would reorder the markup);
//   - how the images are shown: one picture that opens them all at full size (frame.tsx), or the live
//     gallery with its thumbnails, at the side as they are live or under the picture, at `--thumb` wide;
//   - how tall a picture may be (`--image-max`; 650px on the live page).
// Both ways of showing the images are in the page, and the one not chosen is hidden.
import { AudioPlayer } from "../../../../components/AudioPlayer";
import { PlaceholderCassetteLive } from "../../../../components/PlaceholderCassetteLive";
import { PlaylistPlayer } from "../../../../components/PlaylistPlayer";
import { TapeGallery } from "../../../../components/TapeGallery";
import { Frame } from "./frame";
import { Words, type TapeView } from "./shared";

function Player({ tape }: { tape: TapeView }) {
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

export function Today({ tape }: { tape: TapeView }) {
  const images = tape.placeholderLabel ? (
    <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={tape.placeholderLabel} />
  ) : (
    <>
      <div className="proto-one">
        <Frame images={tape.images} />
      </div>
      <div className="proto-many">
        <TapeGallery allImages={tape.images} />
      </div>
    </>
  );
  return (
    <>
      <div className="proto-today mb-12 lg:grid lg:grid-cols-[var(--image-column)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="hidden lg:block">{images}</div>
        <div data-proto-words>
          <Words tape={tape} />
          <div className="mt-8">
            <Player tape={tape} />
          </div>
        </div>
      </div>
      <div className="mb-12 lg:hidden">{images}</div>
    </>
  );
}
