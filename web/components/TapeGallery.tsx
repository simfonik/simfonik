"use client";

import { useState } from "react";
import Image from "next/image";

type TapeGalleryProps = {
  allImages: Array<{ src: string; label: string; tapeId?: string }>;
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
            const isOptimized = img.tapeId && img.src.startsWith("/");
            
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
                {isOptimized ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/optimized/${img.tapeId}/400.webp`}
                    srcSet={`/optimized/${img.tapeId}/400.webp 400w, /optimized/${img.tapeId}/800.webp 800w`}
                    alt={img.label}
                    className="w-20 h-auto max-h-20 object-contain rounded"
                    loading="lazy"
                  />
                ) : img.src.startsWith("/") ? (
                  <Image
                    src={img.src}
                    alt={img.label}
                    width={80}
                    height={50}
                    className={`w-20 h-auto max-h-20 object-contain rounded ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.src}
                    alt={img.label}
                    className={`w-20 h-auto max-h-20 object-contain rounded ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Image */}
      <div className="flex-1">
        {(() => {
          const selectedImg = allImages.find(img => img.src === selectedImage);
          const isOptimized = selectedImg?.tapeId && selectedImage.startsWith("/");
          
          if (isOptimized) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={selectedImage}
                src={`/optimized/${selectedImg.tapeId}/800.webp`}
                srcSet={`/optimized/${selectedImg.tapeId}/400.webp 400w, /optimized/${selectedImg.tapeId}/800.webp 800w, /optimized/${selectedImg.tapeId}/1200.webp 1200w`}
                sizes="(max-width: 768px) 100vw, 600px"
                alt="Tape image"
                className="w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg"
                loading="eager"
              />
            );
          } else if (selectedImage.startsWith("/")) {
            return (
              <Image
                key={selectedImage}
                src={selectedImage}
                alt="Tape image"
                width={600}
                height={600}
                className={`w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg ${selectedImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
              />
            );
          } else {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={selectedImage}
                src={selectedImage}
                alt="Tape image"
                className={`w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg ${selectedImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
              />
            );
          }
        })()}
      </div>
    </div>
  );
}
