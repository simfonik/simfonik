import { CommentBody } from './CommentBody';
import { Heart } from './TapeStats';

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * One comment on a tape's page, posted through the site or kept from the old one: who, when, a heart to give
 * it, and what they said. `heart` is what the heart is given to (lib/hearts.ts).
 */
export function Comment({ author, date, content, heart }: { author: string; date: string; content: string; heart: string }) {
  return (
    <div className="comment">
      <div className="mb-2">
        <div className="font-display text-xl leading-tight text-[var(--text)]">{author}</div>
        <div className="mt-1 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <span>{formatDate(date)}</span>
          <Heart target={heart} />
        </div>
      </div>
      <CommentBody content={content} />
    </div>
  );
}
