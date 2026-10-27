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
    <div className="text-[var(--text)] whitespace-pre-wrap leading-relaxed">
      {splitDiscogsLinks(content).map((part, idx) =>
        part.type === 'link' ? (
          <a
            key={idx}
            href={part.content}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="text-[var(--accent-text)] hover:underline break-all"
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
