'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef, useState } from 'react';
import imageLoader from '../lib/imageLoader';

export type TapeImage = {
  src: string;
  label: string;
  /** The scan's own size in pixels, read from its file when the page is built. */
  width: number;
  height: number;
};

/** The tallest the picture on the page may be, in pixels. A cover taller than that for its width is narrower. */
const TALLEST = 460;
/** The widest file the site makes of an image. One that was scanned smaller is kept at its own size. */
const WIDEST = 1200;
/**
 * How large the viewer shows an image, against the size it was scanned at. Half: on a screen with two pixels
 * to the point, which is what the scans are mostly looked at on, that is one pixel of scan to one of screen.
 * At its full size each pixel of a scan is spread over four of the screen's, and the picture looks soft.
 */
const SHOWN = 0.5;

/** How wide the picture on the page may be, in pixels, before its column holds it narrower. */
export const widthOnPage = ({ width, height }: TapeImage) => TALLEST * (width / height);
/** How wide the viewer shows an image, in pixels, where the window has room for it. */
export const widthInViewer = ({ width }: TapeImage) => Math.min(width, WIDEST) * SHOWN;

/**
 * A tape's images on a wide screen: the first of them, as wide as its column and as tall as its own shape
 * makes it, up to TALLEST. One held to that height is narrower than the column and sits in the middle of it;
 * its top is always the top of the column, level with the tape's name. The size comes from the image's own
 * measurements, so the picture's place is settled before it has loaded. A count in its corner says there are
 * more, and pressing the picture opens them all.
 */
export function TapeImages({ images }: { images: TapeImage[] }) {
  const [viewing, setViewing] = useState(false);
  const [first] = images;
  const more = images.length > 1;
  return (
    <>
      <button
        type="button"
        className="tape-picture"
        style={{ width: `min(100%, ${widthOnPage(first)}px)`, aspectRatio: `${first.width} / ${first.height}` }}
        aria-label={`${first.label}. View ${more ? `all ${images.length} images` : 'it'} larger`}
        onClick={() => setViewing(true)}
      >
        <Image loader={imageLoader} src={first.src} alt="" fill priority sizes="(max-width: 1024px) 100vw, 500px" />
        {more && <span className="tape-picture-count">{images.length} images</span>}
      </button>
      {viewing && <ImageViewer images={images} onClose={() => setViewing(false)} />}
    </>
  );
}

/**
 * Every image of the tape, one to a screen, at the size it is sharp at (see SHOWN) and never stretched to
 * fill the window. Stepped through with the arrows on screen or on the keyboard, or swiped. The browser's own
 * modal dialog, so Escape shuts it and the keyboard goes back to the picture.
 */
function ImageViewer({ images, onClose }: { images: TapeImage[]; onClose: () => void }) {
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
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: Math.max(0, Math.min(images.length - 1, to)) * el.clientWidth, behavior: glide && !still ? 'smooth' : 'auto' });
  };
  return (
    <dialog
      ref={dialog}
      className="image-viewer"
      aria-label="Images of the tape"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        // The row of images would also scroll itself at an arrow key, and the two together skip an image.
        e.preventDefault();
        go(at + (e.key === 'ArrowRight' ? 1 : -1), false);
      }}
    >
      <div ref={track} className="image-viewer-track" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {images.map((img, i) => (
          // A press beside the picture, on what is left of the page, shuts the viewer.
          <figure key={img.src} className="image-viewer-slide" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
            <div className="image-viewer-picture" style={{ width: `min(100%, ${widthInViewer(img)}px)`, aspectRatio: `${img.width} / ${img.height}` }}>
              <Image loader={imageLoader} src={img.src} alt={img.label} fill sizes="100vw" priority={i === 0} className="object-contain" />
            </div>
          </figure>
        ))}
      </div>
      <button ref={shut} type="button" className="image-viewer-button" data-place="close" aria-label="Close" onClick={() => dialog.current?.close()}>
        <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="image-viewer-button" data-place="before" aria-label="Previous image" aria-disabled={at === 0} onClick={() => go(at - 1, true)}>
            <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M9 1L3 7l6 6" />
            </svg>
          </button>
          <button type="button" className="image-viewer-button" data-place="after" aria-label="Next image" aria-disabled={at === images.length - 1} onClick={() => go(at + 1, true)}>
            <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M5 1l6 6-6 6" />
            </svg>
          </button>
          <p className="image-viewer-count" aria-live="polite">
            {at + 1} / {images.length}
          </p>
        </>
      )}
    </dialog>
  );
}
