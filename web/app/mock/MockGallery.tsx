"use client";

import { useState } from "react";

interface GalleryImage {
  src: string;
  thumb: string;
  label: string;
}

interface MockGalleryProps {
  images: GalleryImage[];
}

export function MockGallery({ images }: MockGalleryProps) {
  const [selected, setSelected] = useState(images[0]?.src ?? "");
  if (images.length === 0) return null;

  return (
    <div className="flex gap-4">
      {images.length > 1 && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          {images.map((img) => {
            const isActive = selected === img.src;
            return (
              <button
                key={img.src}
                type="button"
                onClick={() => setSelected(img.src)}
                aria-label={img.label}
                className={`block w-20 h-20 transition-colors cursor-pointer ${
                  isActive
                    ? "border-[1.5px] border-[var(--mock-text)]"
                    : "border-[1.5px] border-[var(--mock-border)] hover:border-[var(--mock-text)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumb}
                  alt={img.label}
                  className="block w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
      <div className="flex-1 min-w-0 border-[1.5px] border-[var(--mock-text)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={selected}
          src={selected}
          alt="Tape image"
          className="block w-full h-auto max-h-[650px] object-contain"
        />
      </div>
    </div>
  );
}
