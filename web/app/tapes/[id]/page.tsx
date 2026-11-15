import { notFound } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getTapeById, getAllTapes, getCommentsForTape, getAllSeries } from "../../../lib/data";
import { TapeImages } from "../../../components/TapeImages";
import { PlaceholderCassetteLive } from "../../../components/PlaceholderCassetteLive";
import { AudioCoordinator } from "../../../components/AudioCoordinator";
import { AudioPlayer } from "../../../components/AudioPlayer";
import { PlaylistPlayer } from "../../../components/PlaylistPlayer";
import { CommentForm } from "../../../components/CommentForm";
import { LiveComments } from "../../../components/LiveComments";
import { TapeTrackIdsProvider } from "../../../components/TapeTrackIds";
import { CommentBody } from "../../../components/CommentBody";
import { RotatingWord } from "../../../components/RotatingWord";
import { JsonLd } from "../../../components/JsonLd";
import { Tracklist } from "../../../components/Tracklist";
import { generateTapeSchema } from "../../../lib/structured-data";
import { thin } from "../../../lib/waveform";
import sideLengths from "../../../data/side-lengths.json";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  const tapes = getAllTapes();
  return tapes.map((tape) => ({ id: tape.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tape = getTapeById(id);

  if (!tape) {
    return {};
  }

  // Check if dedicated OG image exists (1200×630 for social sharing)
  const ogImageFilePath = path.join(process.cwd(), 'public', 'og', `${tape.id}.jpg`);
  const hasOgImage = fs.existsSync(ogImageFilePath);
  
  // Priority: Dedicated OG image > Cover > Side A > Side B > Default
  const ogImagePath = hasOgImage
    ? `/og/${tape.id}.jpg`
    : (tape.images?.cover ||
       tape.sides[0]?.image ||
       tape.sides[1]?.image ||
       '/media/site/og.jpg');
  
  // Make absolute URL for social sharing
  const ogImageUrl = `https://simfonik.com${ogImagePath}`;

  // Truncate DJ names for titles: show first 2 DJs + "..." if 3+
  const djNames = tape.djs.length > 2 
    ? `${tape.djs[0].name}, ${tape.djs[1].name}, ...`
    : tape.djs.map(dj => dj.name).join(', ');
  
  // Full DJ list for description
  const fullDjNames = tape.djs.map(dj => dj.name).join(', ');
  const description = `${fullDjNames} - ${tape.title} (${tape.released})${tape.source ? ` • Tape Source: ${tape.source}` : ''}`;
  
  const pageTitle = `${djNames} - ${tape.title} (${tape.released})`;

  return {
    title: {
      absolute: pageTitle
    },
    description,
    openGraph: {
      title: pageTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          alt: `${tape.title} mixtape by ${fullDjNames}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImageUrl],
    },
  };
}

function isStreamable(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('raw=1') || 
         /\.(mp3|m4a|ogg|wav)(\?|#|$)/.test(lower);
}

// Format date consistently with live comments
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const tape = getTapeById(id);

  if (!tape) {
    notFound();
  }

  // How loud each side is along its length, where it has been measured (scripts/measure-waveforms.mjs).
  // The player draws its scrub bar in that shape; a tape without the file keeps the plain line.
  const lengths = (sideLengths as Record<string, (number | null)[]>)[tape.id];
  // A tape that is one recording, with no name for it, gets no "Side A" label: there is no other side to
  // tell it from.
  const unlabelled = tape.sides.length === 1 && !tape.sides[0].title;
  const waves = await import(`../../../data/waveforms/${tape.id}.json`).then(
    (file) => file.default as (number[] | null)[],
    () => null,
  );

  // Load archived comments from WordPress site
  const archivedComments = getCommentsForTape(id);

  // Resolve series names for this tape
  const allSeries = getAllSeries();
  const tapeSeriesNames = (tape.series ?? []).map(
    (slug) => allSeries.find((s) => s.slug === slug)?.name ?? slug
  );

  // Collect all images: cover + side images
  const allImages: Array<{ src: string; label: string }> = [];
  if (tape.images?.cover) {
    const djList = tape.djs.map(dj => dj.name).join(', ');
    allImages.push({ src: tape.images.cover, label: `${tape.title} mixtape by ${djList}` });
  }
  tape.sides.forEach((side) => {
    if (side.image) {
      allImages.push({ src: side.image, label: `${tape.title} – ${side.title ?? `Side ${side.position}`} image` });
    }
  });

  // If no images found, add the placeholder
  if (allImages.length === 0) {
    allImages.push({ src: "/media/site/blank-tape.svg", label: "Blank cassette tape placeholder" });
  }

  // For placeholder-only tapes, inline the baked AVIF shader label as a
  // base64 data URI so PlaceholderCassetteLive can render the label
  // atomically with the SVG housing (no second HTTP request, no pop-in).
  const usesPlaceholder =
    allImages.length === 1 && allImages[0].src.includes('/generated/placeholders/');
  const labelDataUri = usesPlaceholder
    ? `data:image/avif;base64,${fs
        .readFileSync(
          path.join(process.cwd(), 'public', 'generated', 'placeholders', `${tape.id}-label.avif`)
        )
        .toString('base64')}`
    : '';

  // The wide screen's picture is sized from its file's own measurements, so its place is settled before it
  // has loaded. A tape with the drawn cassette has no picture to measure.
  const pictures = usesPlaceholder
    ? []
    : await Promise.all(
        allImages.map(async ({ src, label }) => {
          const { width, height } = await sharp(path.join(process.cwd(), 'public', src)).metadata();
          return { src, label, width, height };
        })
      );

  return (
    <main className="min-h-screen">
      <JsonLd data={generateTapeSchema(tape)} />
      
      <AudioCoordinator />
      <TapeTrackIdsProvider tapeId={tape.id}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      
      {/* Mobile-only Header */}
      <header className="mb-8 lg:hidden">
        <h1 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-6">
          {tape.title}
        </h1>
        <div className="flex gap-2 flex-wrap mb-6">
          {tape.djs.map((dj) => {
            const shouldLink = dj.link !== false && dj.slug !== "unknown";
            if (shouldLink) {
              return (
                <Link
                  key={dj.slug}
                  href={`/djs/${dj.slug}`}
                  className="dj-link"
                >
                  {dj.name}
                </Link>
              );
            }
            return (
              <span
                key={dj.slug}
                className="dj-link cursor-default"
              >
                {dj.name}
              </span>
            );
          })}
        </div>
        <div className="space-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          {tape.released && <p>Released · {tape.released}</p>}
          {tapeSeriesNames.length > 0 && (
            <p>
              Series ·{" "}
              {(tape.series ?? []).map((slug, i) => (
                <span key={slug}>
                  {i > 0 && ", "}
                  <Link
                    href={`/series/${slug}`}
                    className="hover:text-[var(--accent-text)] transition-colors"
                  >
                    {tapeSeriesNames[i]}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {tape.source && (
            <p>
              Source ·{" "}
              {tape.source_url ? (
                <a
                  href={tape.source_url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="hover:text-[var(--accent-text)] transition-colors"
                >
                  {tape.source}
                </a>
              ) : (
                tape.source
              )}
            </p>
          )}
        </div>
      </header>

      {/* Hero: Image Gallery with Players */}
      <div className="mb-12">
        {/* Five parts image to seven parts words: 500px and 700px at the page's full width. */}
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 items-start">
          {/* The picture, on a wide screen (a phone has it under the player, further down). For tapes that
              have no real cover, render a live SVG cassette whose reels rotate while audio is playing
              instead of the static AVIF. */}
          <div className="hidden lg:block">
            {usesPlaceholder ? (
              <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={labelDataUri} />
            ) : (
              <TapeImages images={pictures} />
            )}
          </div>

          {/* Right Column: Header + Audio Players */}
          <div>
            {/* Desktop-only Header */}
            <header className="mb-8 hidden lg:block">
              <h1 className="font-display text-6xl leading-[0.95] text-[var(--text)] mb-6 text-balance">
                {tape.title}
              </h1>
              <div className="flex gap-2 flex-wrap mb-6">
                {tape.djs.map((dj) => {
                  const shouldLink = dj.link !== false && dj.slug !== "unknown";
                  if (shouldLink) {
                    return (
                      <Link
                        key={dj.slug}
                        href={`/djs/${dj.slug}`}
                        className="dj-link"
                      >
                        {dj.name}
                      </Link>
                    );
                  }
                  return (
                    <span
                      key={dj.slug}
                      className="dj-link cursor-default"
                    >
                      {dj.name}
                    </span>
                  );
                })}
              </div>
              <div className="space-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                {tape.released && <p>Released · {tape.released}</p>}
                {tapeSeriesNames.length > 0 && (
                  <p>
                    Series ·{" "}
                    {(tape.series ?? []).map((slug, i) => (
                      <span key={slug}>
                        {i > 0 && ", "}
                        <Link
                          href={`/series/${slug}`}
                          className="hover:text-[var(--accent-text)] transition-colors"
                        >
                          {tapeSeriesNames[i]}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                {tape.source && (
                  <p>
                    Source ·{" "}
                    {tape.source_url ? (
                      <a
                        href={tape.source_url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="hover:text-[var(--accent-text)] transition-colors"
                      >
                        {tape.source}
                      </a>
                    ) : (
                      tape.source
                    )}
                  </p>
                )}
              </div>
            </header>

            {/* Audio Players */}
            {(() => {
              // Build playlist from sides with audio
              const playlist = tape.sides
                .map((side, index) => ({ side, index, wave: waves?.[index] ?? null, length: lengths?.[index] ?? null }))
                .filter(({ side }) => side.audio_links[0] && isStreamable(side.audio_links[0].url))
                .map(({ side, index, wave, length }) => ({
                  title: side.title ?? `Side ${side.position}`,
                  url: side.audio_links[0].url,
                  position: side.position,
                  // Its place among all the tape's sides, which is how the track IDs are kept.
                  index,
                  djs: side.djs,
                  // Half the measured detail: the bar is a few hundred pixels wide.
                  wave: wave ? thin(wave, 300) : null,
                  // In seconds, read ahead of time, so the page can say it before the audio is fetched.
                  length
                }));

              // Use playlist player for 2+ tracks, individual player for single side
              if (playlist.length >= 2) {
                return <PlaylistPlayer tracks={playlist} tapeId={tape.id} sideCount={tape.sides.length} />;
              }

              // One playable side: a player of its own.
              return (
                <div className="space-y-3">
                  {playlist.map((track) => (
                    <div key={track.position}>
                      {!unlabelled && (
                        <h2 className="font-display text-xl leading-tight text-[var(--text)] mb-2">
                          {track.title}
                        </h2>
                      )}
                      {track.djs && track.djs.length > 0 && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">
                          By{" "}
                          {track.djs.map((dj, djIdx) => {
                            const shouldLink = dj.link !== false && dj.slug !== "unknown";
                            return (
                              <Fragment key={dj.slug}>
                                {shouldLink ? (
                                  <Link
                                    href={`/djs/${dj.slug}`}
                                    className="hover:text-[var(--accent-text)] transition-colors"
                                  >
                                    {dj.name}
                                  </Link>
                                ) : (
                                  <span className="cursor-default">{dj.name}</span>
                                )}
                                {djIdx < track.djs!.length - 1 && ", "}
                              </Fragment>
                            );
                          })}
                        </p>
                      )}
                      <AudioPlayer
                        src={track.url}
                        title={unlabelled ? undefined : track.title}
                        tapeId={tape.id}
                        sidePosition={track.position}
                        sideIndex={track.index}
                        sideCount={tape.sides.length}
                        wave={track.wave}
                        length={track.length}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* The picture on a phone: the same one, under the player, where a wide screen has it beside the words. */}
      <div className="mb-12 lg:hidden">
        {usesPlaceholder ? (
          <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={labelDataUri} />
        ) : (
          <TapeImages images={pictures} />
        )}
      </div>

      {/* The tracklist: the tape's own, a list kept in the comments, and the IDs, as one list. */}
      <Tracklist tapeId={tape.id} sides={tape.sides.map(({ position, title, tracks }) => ({ position, title, tracks }))} />

      {/* Comments */}
      <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-8">
            Comments
          </h2>
          <LiveComments />

          <h2 className="font-display text-3xl sm:text-4xl leading-[0.95] text-[var(--text)] mb-6 mt-14">
            <RotatingWord />
          </h2>
          <CommentForm tapeId={id} />
        </div>
      </section>

      {/* Archived Comments */}
      {archivedComments.length > 0 && (
        <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16">
          <div className="max-w-3xl">
            <h2 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-3">
              Archived Comments
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-8">
              {archivedComments.length} entr{archivedComments.length !== 1 ? 'ies' : 'y'} from the original simfonik.com
            </p>

            {(() => {
              const isCircaTape = id === 'circa-92' || id === 'circa-94';

              if (!isCircaTape) {
                return (
                  <div className="space-y-6">
                    {archivedComments.map((comment, idx) => (
                      <div key={idx} className="border-l-4 border-[var(--accent)] pl-4 py-1">
                        <div className="mb-2">
                          <div className="font-display text-xl leading-tight text-[var(--text)]">
                            {comment.author}
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
                            {formatDate(comment.date)}
                          </div>
                        </div>
                        <CommentBody content={comment.content} />
                      </div>
                    ))}
                  </div>
                );
              }
              
              // Circa tape: group by source_title
              const grouped = new Map<string, typeof archivedComments>();
              archivedComments.forEach(comment => {
                const key = comment.source_title || 'Unknown';
                if (!grouped.has(key)) {
                  grouped.set(key, []);
                }
                grouped.get(key)!.push(comment);
              });
              
              return (
                <div className="space-y-10">
                  {Array.from(grouped.entries()).map(([sourceTitle, comments]) => (
                    <div key={sourceTitle}>
                      <h3 className="font-display text-xl leading-tight text-[var(--text)] border-b-[1.5px] border-[var(--border)] pb-3 mb-4">
                        {sourceTitle}
                      </h3>
                      <div className="space-y-6">
                        {comments.map((comment, idx) => (
                          <div key={idx} className="border-l-4 border-[var(--accent)] pl-4 py-1">
                            <div className="mb-2">
                              <div className="font-display text-xl leading-tight text-[var(--text)]">
                                {comment.author}
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
                                {formatDate(comment.date)}
                              </div>
                            </div>
                            <CommentBody content={comment.content} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}
      </div>
      </TapeTrackIdsProvider>
    </main>
  );
}
