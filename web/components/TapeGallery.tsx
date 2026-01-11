"use client";

import { useState } from "react";
import Image from "next/image";

type TapeGalleryProps = {
  allImages: Array<{ src: string; label: string }>;
};

export function TapeGallery({ allImages }: TapeGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(allImages[0]?.src || "");

  if (allImages.length === 0) return null;

  return (
    <div className="flex gap-4">
      {/* Thumbnails - Vertical on left */}
      {allImages.length > 1 && (
        <div className="flex flex-col gap-2">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedImage(img.src)}
              className={`flex-shrink-0 rounded border-2 transition-all ${
                selectedImage === img.src
                  ? "border-[var(--accent)] shadow-md"
                  : "border-[var(--border)] hover:border-[var(--muted)] opacity-70 hover:opacity-100"
              }`}
              title={img.label}
            >
              {img.src.startsWith("/") ? (
                <Image
                  src={img.src}
                  alt={img.label}
                  width={80}
                  height={80}
                  className="rounded"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt={img.label}
                  className="w-20 h-20 object-cover rounded"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Image */}
      <div className="flex-1">
        {selectedImage.startsWith("/") ? (
          <Image
            key={selectedImage}
            src={selectedImage}
            alt="Tape image"
            width={600}
            height={600}
            className="w-full h-auto rounded-lg shadow-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={selectedImage}
            src={selectedImage}
            alt="Tape image"
            className="w-full h-auto rounded-lg shadow-lg"
          />
        )}
      </div>
    </div>
  );
}
