type Part = { type: 'text' | 'link'; content: string };

const DISCOGS_LINK = /(https?:\/\/(?:www\.)?discogs\.com\/[^\s"'<>]+)/gi;

// Split comment text into plain runs and Discogs links so links can be
// rendered as real anchors. Everything is emitted as React elements, never as
// HTML, so visitor-written text can't inject markup.
export function splitDiscogsLinks(content: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(DISCOGS_LINK)) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', content: match[1] });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

export function CommentBody({ content }: { content: string }) {
  return (
    // A web address or a held-down key ("shreddddddder!!!") has nowhere to break, and unbroken it is wider
    // than a phone and takes the whole page with it. Such a run may break wherever the line ends. On a wide
    // screen the lines stop at a width that is easy to read back along, not at the column's edge.
    <div className="max-w-[32rem] text-[var(--text)] whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
      {splitDiscogsLinks(content).map((part, idx) =>
        part.type === 'link' ? (
          <a
            key={idx}
            href={part.content}
            target="_blank"
            rel="nofollow noopener noreferrer"
            // The link is the text's own colour, so it is underlined where it stands, quietly, and in full on hover.
            className="text-[var(--accent-text)] underline underline-offset-4 decoration-[color-mix(in_srgb,var(--muted)_45%,transparent)] hover:decoration-current break-all"
          >
            {part.content}
          </a>
        ) : (
          <span key={idx}>{part.content}</span>
        )
      )}
    </div>
  );
}
