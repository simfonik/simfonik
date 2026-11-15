"use client";

// PROTOTYPE (SIM-43), round 2, the reference: "Band", the direction chosen from round 1. The player leads. The words sit on the left, on the page's left
// edge with everything under them, the images on the right and smaller; the waveform then runs the full
// width of the page, with the track line and the sides beneath it.
import { Player } from "./column";
import { Cover, Words, type TapeView } from "./shared";

export function Band({ tape }: { tape: TapeView }) {
  return (
    <>
      <div className="mb-8 lg:mb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:items-start lg:gap-10">
        <Words tape={tape} big />
        <div className="hidden lg:block">
          <Cover tape={tape} />
        </div>
      </div>
      <div className="proto-wide mb-12">
        <Player tape={tape} />
      </div>
      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}

/** Round 2, "Bars": Band as it is, with the waveform drawn as fine bars and not one solid shape. */
export function Bars({ tape }: { tape: TapeView }) {
  return (
    <div className="proto-bars">
      <Band tape={tape} />
    </div>
  );
}
