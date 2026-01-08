import { notFound } from "next/navigation";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { getTapeById, getAllTapes } from "../../../lib/data";

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{tape.title}</h1>
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">Released: {tape.released}</p>
        <div className="flex gap-2 flex-wrap">
          {tape.djs.map((dj) => (
            <Link
              key={dj.slug}
              href={`/djs/${dj.slug}`}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-900 transition"
            >
              {dj.name}
            </Link>
          ))}
        </div>
      </header>

      {/* Cover Image */}
      {tape.images?.cover && (
        <div className="mb-8">
          {tape.images.cover.startsWith("/") ? (
            <Image
              src={tape.images.cover}
              alt={`${tape.title} cover`}
              width={600}
              height={600}
              className="rounded-lg shadow-lg"
            />
          ) : (
            <img
              src={tape.images.cover}
              alt={`${tape.title} cover`}
              className="rounded-lg shadow-lg max-w-full"
            />
          )}
        </div>
      )}

      {/* Sides */}
      <div className="space-y-12">
        {tape.sides.map((side, idx) => (
          <section key={idx} className="border-t pt-8">
            <h2 className="text-2xl font-semibold mb-4">
              {side.title ?? `Side ${side.position}`}
            </h2>

            {/* Side DJs */}
            {side.djs && side.djs.length > 0 && (
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                By{" "}
                {side.djs.map((dj, djIdx) => (
                  <Fragment key={dj.slug}>
                    <Link href={`/djs/${dj.slug}`} className="hover:underline">{dj.name}</Link>
                    {djIdx < side.djs!.length - 1 && ", "}
                  </Fragment>
                ))}
              </p>
            )}

            {/* Side Image */}
            {side.image && (
              <div className="mb-4">
                {side.image.startsWith("/") ? (
                  <Image
                    src={side.image}
                    alt={`Side ${side.position}`}
                    width={400}
                    height={400}
                    className="rounded shadow"
                  />
                ) : (
                  <img
                    src={side.image}
                    alt={`Side ${side.position}`}
                    className="rounded shadow max-w-md"
                  />
                )}
              </div>
            )}

            {/* Audio Links */}
            {side.audio_links[0] && isStreamable(side.audio_links[0].url) && (
              <div className="mb-6">
                <audio
                  controls
                  preload="none"
                  className="w-full max-w-xl"
                >
                  <source src={side.audio_links[0].url} />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {/* Tracklist */}
            {side.tracks && side.tracks.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Tracklist:</h3>
                <ol className="list-decimal list-inside space-y-1">
                  {side.tracks.map((track, trackIdx) => (
                    <li key={trackIdx} className="text-zinc-900 dark:text-zinc-100">
                      {track.artist} – {track.title}
                      {track.duration && (
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                          ({track.duration})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
