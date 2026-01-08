import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getTapeById, getAllTapes } from "../../../lib/data";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  const tapes = getAllTapes();
  return tapes.map((tape) => ({ id: tape.id }));
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
        <p className="text-gray-600 mb-4">Released: {tape.released}</p>
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
              Side {side.position}
              {side.title && `: ${side.title}`}
            </h2>

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
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Listen:</h3>
              <div className="flex gap-3 flex-wrap">
                {side.audio_links.map((link, linkIdx) => (
                  <a
                    key={linkIdx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Tracklist */}
            {side.tracks && side.tracks.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Tracklist:</h3>
                <ol className="list-decimal list-inside space-y-1">
                  {side.tracks.map((track, trackIdx) => (
                    <li key={trackIdx} className="text-gray-800">
                      {track.artist} – {track.title}
                      {track.duration && (
                        <span className="text-gray-500 ml-2">
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
