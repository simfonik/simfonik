import { notFound } from "next/navigation";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTapeById, getAllTapes, getCommentsForTape } from "../../../lib/data";
import { TapeGallery } from "../../../components/TapeGallery";
import { AudioCoordinator } from "../../../components/AudioCoordinator";
import { CommentForm } from "../../../components/CommentForm";
import { LiveComments } from "../../../components/LiveComments";

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

  // Priority: Cover > Side A > Side B > Default
  const ogImagePath =
    tape.images?.cover ||
    tape.sides[0]?.image ||
    tape.sides[1]?.image ||
    '/media/site/og.jpg';
  
  // Make absolute URL for social sharing
  const ogImageUrl = `https://simfonik.com${ogImagePath}`;

  const djNames = tape.djs.map(dj => dj.name).join(', ');
  const description = `${djNames} - ${tape.title} (${tape.released})${tape.source ? ` • Tape Source: ${tape.source}` : ''}`;

  return {
    title: `${tape.title} - ${djNames}`,
    description,
    openGraph: {
      title: `${tape.title} - ${djNames}`,
      description,
      images: [
        {
          url: ogImageUrl,
          alt: `${tape.title} by ${djNames}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tape.title} - ${djNames}`,
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

  // If no images found, add the placeholder
  if (allImages.length === 0) {
    allImages.push({ src: "/media/site/blank-tape.svg", label: "Cover" });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
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
          <p className="text-[var(--muted)]">Source: {tape.source}</p>
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
                <p className="text-[var(--muted)]">Source: {tape.source}</p>
              )}
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
                        {side.djs.map((dj, djIdx) => {
                          const shouldLink = dj.link !== false && dj.slug !== "unknown";
                          
                          return (
                            <Fragment key={dj.slug}>
                              {shouldLink ? (
                                <Link href={`/djs/${dj.slug}`} className="hover:underline hover:text-[var(--accent)] transition-colors">{dj.name}</Link>
                              ) : (
                                <span className="cursor-default">{dj.name}</span>
                              )}
                              {djIdx < side.djs!.length - 1 && ", "}
                            </Fragment>
                          );
                        })}
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

      {/* Live Comments */}
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
