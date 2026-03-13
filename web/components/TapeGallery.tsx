"use client";

import { useState } from "react";
import Image from "next/image";

type TapeGalleryProps = {
  allImages: Array<{ 
    src: string; 
    label: string; 
    tapeId?: string;
    sidePosition?: string; // 'a' or 'b' for side images
  }>;
};

export function TapeGallery({ allImages }: TapeGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(allImages[0]?.src || "");

  if (allImages.length === 0) return null;

  return (
    <div className="flex gap-4">
      {/* Thumbnails - Vertical on left */}
      {allImages.length > 1 && (
        <div className="flex flex-col gap-2">
          {allImages.map((img, idx) => {
            return (
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
                <div className="relative w-20 h-20">
                  <Image
                    src={img.src}
                    alt={img.label}
                    fill
                    sizes="80px"
                    className={`object-contain rounded ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Image */}
      <div className="flex-1">
        <Image
          key={selectedImage}
          src={selectedImage}
          alt="Tape image"
          width={800}
          height={600}
          priority
          sizes="(max-width: 768px) 100vw, 800px"
          className={`w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg ${selectedImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
        />
      </div>
    </div>
  );
}
