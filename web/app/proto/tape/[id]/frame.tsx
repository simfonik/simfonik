"use client";

// PROTOTYPE (SIM-43): one picture for the tape, with every image at full size behind it. The other way to
// show a tape's images, beside the live gallery's thumbnails (today.tsx has both; the panel chooses).
import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import imageLoader from "../../../../lib/imageLoader";
import type { TapeView } from "./shared";

type Picture = TapeView["images"][number];

/** The widest file the site makes of an image. One that was scanned smaller is kept at its own size. */
const WIDEST = 1200;

/**
 * The tape's first image, as wide as the column and as tall as its own shape makes it, up to `--image-max`.
 * One held to that height is narrower than the column and sits in the middle of it. Its top is always the
 * top of the column, level with the tape's name. The size comes from the image's own measurements, known
 * when the page is built, so the picture's place is settled before it has loaded. A count in its corner says
 * there are more, and pressing it opens them all.
 */
export function Frame({ images }: { images: Picture[] }) {
  const [viewing, setViewing] = useState(false);
  const [first] = images;
  const more = images.length > 1;
  return (
    <>
      <button
        type="button"
        className="proto-frame"
        style={{ width: `min(100%, calc(var(--image-max) * ${first.width / first.height}))`, aspectRatio: `${first.width} / ${first.height}` }}
        aria-label={`${first.label}. View ${more ? `all ${images.length} images` : "it"} at full size`}
        onClick={() => setViewing(true)}
      >
        <Image loader={imageLoader} src={first.src} alt="" fill priority sizes="(max-width: 1024px) 100vw, 720px" />
        {more && <span className="proto-frame-count">{images.length} images</span>}
      </button>
      {viewing && <Viewer images={images} onClose={() => setViewing(false)} />}
    </>
  );
}

/**
 * Every image of the tape, one to a screen and never larger than it was scanned: a scan stretched to fill
 * a wide window is a blur. Swiped through on a phone, stepped through with the arrows on screen or on the
 * keyboard. The browser's own modal dialog, so Escape shuts it and the keyboard goes back to the picture.
 */
function Viewer({ images, onClose }: { images: Picture[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(0);
  useLayoutEffect(() => {
    dialog.current?.showModal();
    // Left to itself the dialog gives the keyboard to the row of images, which can be scrolled but not pressed.
    shut.current?.focus();
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
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        // The row of images would also scroll itself at an arrow key, and the two together skip an image.
        e.preventDefault();
        go(at + (e.key === "ArrowRight" ? 1 : -1), false);
      }}
    >
      <div ref={track} className="proto-viewer-track" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {images.map((img, i) => (
          // A press beside the picture, on what is left of the page, shuts the viewer.
          <figure key={img.src} className="proto-viewer-slide" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
            <div className="proto-viewer-picture" style={{ width: `min(100%, ${Math.min(img.width, WIDEST)}px)`, aspectRatio: `${img.width} / ${img.height}` }}>
              <Image loader={imageLoader} src={img.src} alt={img.label} fill sizes="100vw" priority={i === 0} className="object-contain" />
            </div>
          </figure>
        ))}
      </div>
      <button type="button" className="proto-viewer-button" data-place="close" aria-label="Close" ref={shut} onClick={() => dialog.current?.close()}>
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
