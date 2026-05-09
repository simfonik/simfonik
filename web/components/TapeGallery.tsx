"use client";

import { useState } from "react";
import Image from "next/image";
import imageLoader from "../lib/imageLoader";

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
    <div className="flex gap-4 items-start">
      {allImages.length > 1 && (
        <div className="flex flex-col gap-2 flex-shrink-0 max-h-[500px] overflow-y-auto pr-1">
          {allImages.map((img, idx) => {
            const isActive = selectedImage === img.src;
            return (
              <button
                key={idx}
                onClick={() => setSelectedImage(img.src)}
                aria-label={img.label}
                title={img.label}
                className={`block w-20 h-20 transition-opacity cursor-pointer ${
                  isActive ? 'opacity-100' : 'opacity-50 hover:opacity-100'
                }`}
              >
                <div className="relative w-full h-full">
                  <Image
                    loader={imageLoader}
                    src={img.src}
                    alt={img.label}
                    fill
                    sizes="80px"
                    className={`object-contain ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <Image
          loader={imageLoader}
          key={selectedImage}
          src={selectedImage}
          alt="Tape image"
          width={800}
          height={600}
          priority
          sizes="(max-width: 768px) 100vw, 800px"
          className={`block w-full h-auto max-h-[650px] object-contain ${selectedImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
        />
      </div>
    </div>
  );
}
