import { notFound } from "next/navigation";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { getTapeById, getAllTapes, getCommentsForTape } from "../../../lib/data";
import { hasOptimizedImages } from "../../../lib/image-utils";
import { TapeGallery } from "../../../components/TapeGallery";
import { AudioCoordinator } from "../../../components/AudioCoordinator";
import { AudioPlayer } from "../../../components/AudioPlayer";
import { PlaylistPlayer } from "../../../components/PlaylistPlayer";
import { CommentForm } from "../../../components/CommentForm";
import { LiveComments } from "../../../components/LiveComments";
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
      const isSideJpg = side.image.includes('/media/') && side.image.endsWith('.jpg');
      allImages.push({ 
        src: side.image, 
        label: `${tape.title} – ${side.title ?? `Side ${side.position}`} image`,
        isCover: false,
        tapeId: isSideJpg ? tape.id : undefined,
        sidePosition: isSideJpg ? side.position.toLowerCase() : undefined
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
    <div className="min-h-screen bg-[var(--bg)]">
      <JsonLd data={generateTapeSchema(tape)} />
      
      <AudioCoordinator />
      <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Mobile-only Header */}
      <header className="mb-6 lg:hidden">
        <h1 className="text-3xl font-bold mb-4 text-[var(--text)]">{tape.title}</h1>
        <div className="flex gap-2 flex-wrap mb-4">
          {tape.djs.map((dj) => {
            const shouldLink = dj.link !== false && dj.slug !== "unknown";
            
            if (shouldLink) {
              return (
                <Link
                  key={dj.slug}
                  href={`/djs/${dj.slug}`}
                  className="px-2.5 py-1 bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 rounded-md text-[#5e6ad2] dark:bg-[#5e6ad2]/25 dark:hover:bg-[#5e6ad2]/40 dark:text-[#a8aef5] transition-colors font-medium text-sm"
                >
                  {dj.name}
                </Link>
              );
            }
            
            return (
              <span
                key={dj.slug}
                className="px-2.5 py-1 bg-[var(--muted)]/20 border border-[var(--border)] rounded-md text-[var(--muted)] font-medium text-sm cursor-default"
              >
                {dj.name}
              </span>
            );
          })}
        </div>
        <p className="mb-1 text-[var(--muted)]">Released: {tape.released}</p>
        {tape.source && (
          <p className="text-[var(--muted)]">Source: {tape.source_url ? (
            <a href={tape.source_url} target="_blank" rel="nofollow noopener noreferrer" className="text-[var(--accent)] hover:underline">{tape.source}</a>
          ) : tape.source}</p>
        )}
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
              <h1 className="text-3xl font-bold mb-4 text-[var(--text)]">{tape.title}</h1>
              <div className="flex gap-2 flex-wrap mb-4">
                {tape.djs.map((dj) => {
                  const shouldLink = dj.link !== false && dj.slug !== "unknown";
                  
                  if (shouldLink) {
                    return (
                      <Link
                        key={dj.slug}
                        href={`/djs/${dj.slug}`}
                        className="px-2.5 py-1 bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 rounded-md text-[#5e6ad2] dark:bg-[#5e6ad2]/25 dark:hover:bg-[#5e6ad2]/40 dark:text-[#a8aef5] transition-colors font-medium text-sm"
                      >
                        {dj.name}
                      </Link>
                    );
                  }
                  
                  return (
                    <span
                      key={dj.slug}
                      className="px-2.5 py-1 bg-[var(--muted)]/20 border border-[var(--border)] rounded-md text-[var(--muted)] font-medium text-sm cursor-default"
                    >
                      {dj.name}
                    </span>
                  );
                })}
              </div>
              <p className="mb-1 text-[var(--muted)]">Released: {tape.released}</p>
              {tape.source && (
                <p className="text-[var(--muted)]">Source: {tape.source_url ? (
                  <a href={tape.source_url} target="_blank" rel="nofollow noopener noreferrer" className="text-[var(--accent)] hover:underline">{tape.source}</a>
                ) : tape.source}</p>
              )}
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
                <div className="space-y-4">
                  {playlist.map((track, idx) => (
                    <div key={track.position}>
                      <div className="mb-2">
                        <h2 className="text-xl font-semibold text-[var(--text)]">
                          {track.title}
                        </h2>
                        {track.djs && track.djs.length > 0 && (
                          <p className="text-sm text-[var(--muted)] mt-1">
                            By{" "}
                            {track.djs.map((dj, djIdx) => {
                              const shouldLink = dj.link !== false && dj.slug !== "unknown";
                              
                              return (
                                <Fragment key={dj.slug}>
                                  {shouldLink ? (
                                    <Link href={`/djs/${dj.slug}`} className="hover:underline hover:text-[var(--accent)] transition-colors">{dj.name}</Link>
                                  ) : (
                                    <span className="cursor-default">{dj.name}</span>
                                  )}
                                  {djIdx < track.djs!.length - 1 && ", "}
                                </Fragment>
                              );
                            })}
                          </p>
                        )}
                      </div>
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

      {/* Mobile Images - Stacked */}
      <div className="mb-12 space-y-6 lg:hidden">
        {allImages.map((img, idx) => {
          const isOptimized = img.tapeId && img.src.startsWith("/");
          let mobileSrc = img.src;
          let mobileSrcSet = undefined;
          
          if (isOptimized) {
            if (img.sidePosition) {
              mobileSrc = `/optimized/${img.tapeId}/sides/${img.sidePosition}/800.webp`;
              mobileSrcSet = `/optimized/${img.tapeId}/sides/${img.sidePosition}/400.webp 400w, /optimized/${img.tapeId}/sides/${img.sidePosition}/800.webp 800w, /optimized/${img.tapeId}/sides/${img.sidePosition}/1200.webp 1200w`;
            } else {
              mobileSrc = `/optimized/${img.tapeId}/800.webp`;
              mobileSrcSet = `/optimized/${img.tapeId}/400.webp 400w, /optimized/${img.tapeId}/800.webp 800w, /optimized/${img.tapeId}/1200.webp 1200w`;
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
                  className="w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg"
                  loading="lazy"
                />
              ) : img.src.startsWith("/") ? (
                <Image
                  src={img.src}
                  alt={img.label}
                  width={600}
                  height={600}
                  className={`w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt={img.label}
                  className={`w-full h-auto max-h-[650px] object-contain rounded-lg shadow-lg ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Tracklist */}
      {tape.sides.some(side => side.tracks && side.tracks.length > 0) && (
        <section className="border-t border-[var(--border)] pt-8 mt-10">
          <div className="max-w-3xl">
            <h3 className="text-2xl font-semibold mb-6 text-[var(--text)]">
              Tracklist
            </h3>
          <div className="space-y-8">
            {tape.sides.map((side, idx) => {
              if (!side.tracks || side.tracks.length === 0) return null;
              
              return (
                <div key={idx}>
                  <h4 className="text-lg font-semibold mb-3 text-[var(--text)]">
                    {side.title ?? `Side ${side.position}`}
                  </h4>
                  <div className="space-y-0 leading-snug text-sm">
                    {side.tracks.map((track, trackIdx) => (
                      <div key={trackIdx} className="flex gap-3 text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors py-1.5 px-3 rounded cursor-pointer group">
                        <span className="text-[var(--muted)] opacity-50 tabular-nums flex-shrink-0">
                          {String(trackIdx + 1).padStart(2, '0')}
                        </span>
                        {track.discogs_url ? (
                          <a 
                            href={track.discogs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--accent)] transition-colors cursor-pointer flex-1 flex items-center gap-2"
                          >
                            <span className="flex-1">
                              <span className="font-medium">{track.artist}</span>
                              <span className="text-[var(--muted)]"> - </span>
                              <span>{track.title}</span>
                              {track.duration && (
                                <span className="ml-2 text-[var(--muted)] text-sm">
                                  ({track.duration})
                                </span>
                              )}
                            </span>
                            <svg 
                              className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--accent)] flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" 
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
                            <span className="text-[var(--muted)]"> - </span>
                            <span>{track.title}</span>
                            {track.duration && (
                              <span className="ml-2 text-[var(--muted)] text-sm">
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
      <section className="border-t border-[var(--border)] pt-8 mt-10">
        <div className="max-w-3xl">
          <h3 className="text-2xl font-semibold mb-4 text-[var(--text)]">
            Comments
          </h3>
          <LiveComments tapeId={id} />

          <h3 className="text-2xl font-semibold mb-4 mt-10 text-[var(--text)]">
            Leave a Comment
          </h3>
          <CommentForm tapeId={id} />
        </div>
      </section>

      {/* Archived Comments */}
      {archivedComments.length > 0 && (
        <section className="border-t border-[var(--border)] pt-8 mt-10">
          <div className="max-w-3xl">
            <h3 className="text-2xl font-semibold mb-2 text-[var(--text)]">
              Archived Comments
            </h3>
            <p className="text-sm text-[var(--muted)] mb-6">
              {archivedComments.length} comment{archivedComments.length !== 1 ? 's' : ''} from the original simfonik.com
            </p>
            
            {(() => {
              // Group comments by source for circa tapes
              const isCircaTape = id === 'circa-92' || id === 'circa-94';
              
              if (!isCircaTape) {
                // Normal tape: flat list
                return (
                  <div className="space-y-6">
                    {archivedComments.map((comment, idx) => (
                      <div key={idx} className="border-l-2 border-[var(--border)] pl-4 py-1">
                        <div className="mb-2">
                          <div className="font-medium text-[var(--text)]">
                            {comment.author}
                          </div>
                          <div className="text-sm text-[var(--muted)]">
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
                                  className="text-[var(--accent)] hover:underline break-all"
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
                      <h4 className="text-lg font-semibold mb-4 text-[var(--text)] border-b border-[var(--border)] pb-2">
                        {sourceTitle}
                      </h4>
                      <div className="space-y-6">
                        {comments.map((comment, idx) => (
                          <div key={idx} className="border-l-2 border-[var(--border)] pl-4 py-1">
                            <div className="mb-2">
                              <div className="font-medium text-[var(--text)]">
                                {comment.author}
                              </div>
                              <div className="text-sm text-[var(--muted)]">
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
                                      className="text-[var(--accent)] hover:underline break-all"
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
    </div>
  );
}
