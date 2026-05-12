import { notFound } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { getTapeById, getAllTapes, getCommentsForTape, getAllSeries } from "../../../lib/data";
import { hasOptimizedImages, isOptimizableImagePath } from "../../../lib/image-utils";
import { ASSET_CACHE_VERSION } from "../../../lib/imageLoader";
import { TapeGallery } from "../../../components/TapeGallery";
import { PlaceholderCassetteLive } from "../../../components/PlaceholderCassetteLive";
import { AudioCoordinator } from "../../../components/AudioCoordinator";
import { AudioPlayer } from "../../../components/AudioPlayer";
import { PlaylistPlayer } from "../../../components/PlaylistPlayer";
import { CommentForm } from "../../../components/CommentForm";
import { LiveComments } from "../../../components/LiveComments";
import { RotatingWord } from "../../../components/RotatingWord";
import { JsonLd } from "../../../components/JsonLd";
import { generateTapeSchema } from "../../../lib/structured-data";

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

// Process comment content to linkify Discogs URLs
function processCommentForDisplay(content: string) {
  const discogsPattern = /(https?:\/\/(?:www\.)?discogs\.com\/[^\s]+)/gi;
  const parts: Array<{ type: 'text' | 'link'; content: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = discogsPattern.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // Add the link
    parts.push({ type: 'link', content: match[1] });
    lastIndex = match.index + match[1].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const tape = getTapeById(id);

  if (!tape) {
    notFound();
  }

  // Load archived comments from WordPress site
  const archivedComments = getCommentsForTape(id);

  // Resolve series names for this tape
  const allSeries = getAllSeries();
  const tapeSeriesNames = (tape.series ?? []).map(
    (slug) => allSeries.find((s) => s.slug === slug)?.name ?? slug
  );

  // Collect all images: cover + side images
  const allImages: Array<{
    src: string;
    label: string;
    isCover: boolean;
    tapeId?: string;
    sidePosition?: string;
  }> = [];
  if (tape.images?.cover) {
    const djList = tape.djs.map(dj => dj.name).join(', ');
    allImages.push({ 
      src: tape.images.cover, 
      label: `${tape.title} mixtape by ${djList}`,
      isCover: true,
      tapeId: hasOptimizedImages(tape) ? tape.id : undefined
    });
  }
  tape.sides.forEach((side) => {
    if (side.image) {
      const isSideOptimizable = isOptimizableImagePath(side.image);
      allImages.push({
        src: side.image,
        label: `${tape.title} – ${side.title ?? `Side ${side.position}`} image`,
        isCover: false,
        tapeId: isSideOptimizable ? tape.id : undefined,
        sidePosition: isSideOptimizable ? side.position.toLowerCase() : undefined
      });
    }
  });

  // If no images found, add the placeholder
  if (allImages.length === 0) {
    allImages.push({ 
      src: "/media/site/blank-tape.svg", 
      label: "Blank cassette tape placeholder",
      isCover: true
    });
  }

  return (
    <main className="min-h-screen">
      <JsonLd data={generateTapeSchema(tape)} />
      
      <AudioCoordinator />
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
                  className="dj-pill"
                >
                  {dj.name}
                </Link>
              );
            }
            return (
              <span
                key={dj.slug}
                className="dj-pill cursor-default"
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
        <div className="grid lg:grid-cols-[1fr_500px] gap-8 items-start">
          {/* Desktop Gallery - Hidden on mobile. For tapes that have no
              real cover, render a live SVG cassette whose reels rotate
              while audio is playing instead of the static AVIF. */}
          <div className="hidden lg:block">
            {allImages.length === 1 && allImages[0].src.includes('/generated/placeholders/') ? (
              <PlaceholderCassetteLive tapeId={tape.id} />
            ) : (
              <TapeGallery allImages={allImages} />
            )}
          </div>

          {/* Right Column: Header + Audio Players */}
          <div>
            {/* Desktop-only Header */}
            <header className="mb-8 hidden lg:block">
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
                        className="dj-pill"
                      >
                        {dj.name}
                      </Link>
                    );
                  }
                  return (
                    <span
                      key={dj.slug}
                      className="dj-pill cursor-default"
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
                .filter(side => side.audio_links[0] && isStreamable(side.audio_links[0].url))
                .map(side => ({
                  title: side.title ?? `Side ${side.position}`,
                  url: side.audio_links[0].url,
                  position: side.position,
                  djs: side.djs
                }));

              // Use playlist player for 2+ tracks, individual player for single side
              if (playlist.length >= 2) {
                return <PlaylistPlayer tracks={playlist} tapeId={tape.id} />;
              }

              // Individual players for 1-2 sides
              return (
                <div className="space-y-3">
                  {playlist.map((track) => (
                    <div key={track.position}>
                      <h2 className="font-display text-xl leading-tight text-[var(--text)] mb-2">
                        {track.title}
                      </h2>
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
                        title={track.title}
                        tapeId={tape.id}
                        sidePosition={track.position}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Mobile Images - Stacked. Same placeholder swap as desktop:
          live cassette with spinning reels when this tape is a
          placeholder-only one. */}
      <div className="mb-12 space-y-6 lg:hidden">
        {allImages.length === 1 && allImages[0].src.includes('/generated/placeholders/') ? (
          <PlaceholderCassetteLive tapeId={tape.id} />
        ) : allImages.map((img, idx) => {
          const isOptimized = img.tapeId && img.src.startsWith("/");
          let mobileSrc = img.src;
          let mobileSrcSet = undefined;
          
          if (isOptimized) {
            const v = `?v=${ASSET_CACHE_VERSION}`;
            if (img.sidePosition) {
              const base = `/optimized/${img.tapeId}/sides/${img.sidePosition}`;
              mobileSrc = `${base}/800.avif${v}`;
              mobileSrcSet = `${base}/400.avif${v} 400w, ${base}/800.avif${v} 800w, ${base}/1200.avif${v} 1200w`;
            } else {
              const base = `/optimized/${img.tapeId}`;
              mobileSrc = `${base}/800.avif${v}`;
              mobileSrcSet = `${base}/400.avif${v} 400w, ${base}/800.avif${v} 800w, ${base}/1200.avif${v} 1200w`;
            }
          }
          
          return (
            <div key={idx}>
              {isOptimized ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mobileSrc}
                  srcSet={mobileSrcSet}
                  sizes="100vw"
                  alt={img.label}
                  className="block w-full h-auto max-h-[650px] object-contain"
                  loading="lazy"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt={img.label}
                  className={`block w-full h-auto max-h-[650px] object-contain ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Tracklist */}
      {tape.sides.some(side => side.tracks && side.tracks.length > 0) && (
        <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16">
          <div className="max-w-3xl">
            <h2 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-8">
              Tracklist
            </h2>
          <div className="space-y-10">
            {tape.sides.map((side, idx) => {
              if (!side.tracks || side.tracks.length === 0) return null;

              return (
                <div key={idx}>
                  <h3 className="font-display text-xl leading-tight text-[var(--text)] mb-4">
                    {side.title ?? `Side ${side.position}`}
                  </h3>
                  <div className="space-y-0 leading-snug text-sm">
                    {side.tracks.map((track, trackIdx) => (
                      <div key={trackIdx} className="flex gap-3 text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors py-2 px-2 group">
                        <span className="font-mono text-[var(--muted)] tabular-nums flex-shrink-0">
                          {String(trackIdx + 1).padStart(2, '0')}
                        </span>
                        {track.discogs_url ? (
                          <a
                            href={track.discogs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer flex-1 flex items-center gap-2 group-hover:text-[var(--accent-text)] transition-colors"
                          >
                            <span className="flex-1">
                              <span className="font-medium">{track.artist}</span>
                              <span className="text-[var(--muted)]"> — </span>
                              <span>{track.title}</span>
                              {track.duration && (
                                <span className="ml-2 font-mono text-[var(--muted)] text-xs">
                                  ({track.duration})
                                </span>
                              )}
                            </span>
                            <svg
                              className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="flex-1">
                            <span className="font-medium">{track.artist}</span>
                            <span className="text-[var(--muted)]"> — </span>
                            <span>{track.title}</span>
                            {track.duration && (
                              <span className="ml-2 font-mono text-[var(--muted)] text-xs">
                                ({track.duration})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </section>
      )}

      {/* Comments */}
      <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-8">
            Comments
          </h2>
          <LiveComments tapeId={id} />

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
                        <div className="text-[var(--text)] whitespace-pre-wrap leading-relaxed">
                          {processCommentForDisplay(comment.content).map((part, partIdx) => {
                            if (part.type === 'link') {
                              return (
                                <a
                                  key={partIdx}
                                  href={part.content}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[var(--accent-text)] hover:underline break-all"
                                >
                                  {part.content}
                                </a>
                              );
                            }
                            return <span key={partIdx}>{part.content}</span>;
                          })}
                        </div>
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
                            <div className="text-[var(--text)] whitespace-pre-wrap leading-relaxed">
                              {processCommentForDisplay(comment.content).map((part, partIdx) => {
                                if (part.type === 'link') {
                                  return (
                                    <a
                                      key={partIdx}
                                      href={part.content}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[var(--accent-text)] hover:underline break-all"
                                    >
                                      {part.content}
                                    </a>
                                  );
                                }
                                return <span key={partIdx}>{part.content}</span>;
                              })}
                            </div>
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
    </main>
  );
}
