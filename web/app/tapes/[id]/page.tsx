import { notFound } from "next/navigation";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { getTapeById, getAllTapes } from "../../../lib/data";
import { TapeGallery } from "../../../components/TapeGallery";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  const tapes = getAllTapes();
  return tapes.map((tape) => ({ id: tape.id }));
}

function isStreamable(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('raw=1') || 
         /\.(mp3|m4a|ogg|wav)(\?|#|$)/.test(lower);
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const tape = getTapeById(id);

  if (!tape) {
    notFound();
  }

  // Collect all images: cover + side images
  const allImages = [];
  if (tape.images?.cover) {
    allImages.push({ src: tape.images.cover, label: "Cover" });
  }
  tape.sides.forEach((side) => {
    if (side.image) {
      allImages.push({ 
        src: side.image, 
        label: side.title ?? `Side ${side.position}` 
      });
    }
  });

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
      
      {/* Mobile-only Header */}
      <header className="mb-6 lg:hidden">
        <h1 className="text-3xl font-bold mb-2 text-[var(--text)]">{tape.title}</h1>
        <p className="mb-4 text-[var(--muted)]">Released: {tape.released}</p>
        <div className="flex gap-2 flex-wrap">
          {tape.djs.map((dj) => (
            <Link
              key={dj.slug}
              href={`/djs/${dj.slug}`}
              className="px-2.5 py-1 bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 rounded-md text-[#5e6ad2] dark:bg-[#5e6ad2]/25 dark:hover:bg-[#5e6ad2]/40 dark:text-[#a8aef5] transition-colors font-medium text-sm"
            >
              {dj.name}
            </Link>
          ))}
        </div>
      </header>

      {/* Hero: Image Gallery with Players */}
      <div className="mb-12">
        <div className="grid lg:grid-cols-[1fr_500px] gap-8 items-start">
          {/* Desktop Gallery - Hidden on mobile */}
          <div className="hidden lg:block">
            <TapeGallery allImages={allImages} />
          </div>

          {/* Right Column: Header + Audio Players */}
          <div>
            {/* Desktop-only Header */}
            <header className="mb-6 hidden lg:block">
              <h1 className="text-3xl font-bold mb-2 text-[var(--text)]">{tape.title}</h1>
              <p className="mb-4 text-[var(--muted)]">Released: {tape.released}</p>
              <div className="flex gap-2 flex-wrap">
                {tape.djs.map((dj) => (
                  <Link
                    key={dj.slug}
                    href={`/djs/${dj.slug}`}
                    className="px-2.5 py-1 bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 rounded-md text-[#5e6ad2] dark:bg-[#5e6ad2]/25 dark:hover:bg-[#5e6ad2]/40 dark:text-[#a8aef5] transition-colors font-medium text-sm"
                  >
                    {dj.name}
                  </Link>
                ))}
              </div>
            </header>

            {/* Audio Players */}
            <div className="space-y-4">
            {tape.sides.map((side, idx) => {
              const hasAudio = side.audio_links[0] && isStreamable(side.audio_links[0].url);
              if (!hasAudio) return null;
              
              return (
                <div key={idx}>
                  <div className="mb-2">
                    <h2 className="text-xl font-semibold text-[var(--text)]">
                      {side.title ?? `Side ${side.position}`}
                    </h2>
                    {side.djs && side.djs.length > 0 && (
                      <p className="text-sm text-[var(--muted)] mt-1">
                        By{" "}
                        {side.djs.map((dj, djIdx) => (
                          <Fragment key={dj.slug}>
                            <Link href={`/djs/${dj.slug}`} className="hover:underline hover:text-[var(--accent)] transition-colors">{dj.name}</Link>
                            {djIdx < side.djs!.length - 1 && ", "}
                          </Fragment>
                        ))}
                      </p>
                    )}
                  </div>
                  <audio
                    controls
                    preload="metadata"
                    className="w-full"
                  >
                    <source src={side.audio_links[0].url} />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Images - Stacked */}
      <div className="mb-12 space-y-6 lg:hidden">
        {allImages.map((img, idx) => (
          <div key={idx}>
            {img.src.startsWith("/") ? (
              <Image
                src={img.src}
                alt={img.label}
                width={600}
                height={600}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                alt={img.label}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            )}
          </div>
        ))}
      </div>

      {/* Tracklists */}
      {tape.sides.some(side => side.tracks && side.tracks.length > 0) && (
        <div className="space-y-10">
          {tape.sides.map((side, idx) => {
            if (!side.tracks || side.tracks.length === 0) return null;
            
            return (
              <section key={idx} className="border-t border-[var(--border)] pt-8">
                <h3 className="text-2xl font-semibold mb-4 text-[var(--text)]">
                  {side.title ?? `Side ${side.position}`} – Tracklist
                </h3>
                <ol className="list-decimal list-inside space-y-1">
                  {side.tracks.map((track, trackIdx) => (
                    <li key={trackIdx} className="text-[var(--text)]">
                      {track.artist} – {track.title}
                      {track.duration && (
                        <span className="ml-2 text-[var(--muted)]">
                          ({track.duration})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
