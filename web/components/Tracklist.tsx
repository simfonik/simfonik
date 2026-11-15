'use client';

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { composeId, idPlace, ONE_MOMENT, splitPost, type RunningOrder } from '../lib/track-ids/compose';
import { postIds, rememberedName } from '../lib/track-ids/post';
import { contributors, tracklistRows, type TracklistRow } from '../lib/track-ids/tracklist';
import { formatTime } from '../lib/time-utils';
import type { Side } from '../types/tape';
import { usePlayhead, useTapeTrackIds } from './TapeTrackIds';

/** A long side shows this many tracks before the rest are asked for. */
const COLLAPSED_COUNT = 20;
/** How long a track with no known end is taken to play, as the reader takes it (parse.ts). */
const UNENDED = 240;

/**
 * A time a visitor has given a line of the list by pressing its +. It is kept on this device, with the line
 * as it read when pressed, until the visitor posts what they have: a sitting's times go up as one comment.
 */
type Mark = { side: number; n: number; artist: string; title: string; known: boolean; time: number };

const isMark = (x: unknown): x is Mark => {
  const m = x as Mark;
  return Boolean(m) && [m.side, m.n, m.time].every(Number.isFinite) && typeof m.artist === 'string' && typeof m.title === 'string' && typeof m.known === 'boolean';
};

/** The visitor's unposted times for a tape, kept through a reload. */
function useMarks(tapeId: string) {
  const key = `simfonik:id-marks:${tapeId}`;
  const [marks, setMarks] = useState<Mark[]>([]);
  useEffect(() => {
    try {
      const kept: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      if (Array.isArray(kept)) setMarks(kept.filter(isMark));
    } catch {
      // Storage is off in this browser, or what it holds isn't ours: the visitor starts with none.
    }
  }, [key]);
  const keep = (next: Mark[]) => {
    setMarks(next);
    try {
      if (next.length) window.localStorage.setItem(key, JSON.stringify(next));
      else window.localStorage.removeItem(key);
    } catch {
      // Storage is off: the times last as long as the page does.
    }
  };
  return [marks, keep] as const;
}

type Row = TracklistRow & { /** The visitor's own time, not posted yet. */ pending: boolean };

const names = (people: string[]) => {
  const [a, b, c, ...rest] = people;
  if (rest.length) return `${a}, ${b}, ${c} and ${rest.length} ${rest.length === 1 ? 'other' : 'others'}`;
  return c ? `${a}, ${b} and ${c}` : b ? `${a} and ${b}` : a;
};

/** How far along a side is, in a few words. */
function progress(rows: Row[], order: RunningOrder | null) {
  const timed = rows.filter((row) => row.start !== null && !row.pending).length;
  const unknown = rows.filter((row) => !row.known).length;
  const parts = order
    ? [timed === rows.length && !unknown ? `All ${rows.length} tracks timed` : `${timed} of ${rows.length} timed`]
    : [`${rows.length - unknown} ${rows.length - unknown === 1 ? 'track' : 'tracks'} ID’d`];
  if (unknown) parts.push(`${unknown} unknown`);
  if (order?.by) parts.push(`${order.by}’s list`);
  return parts.join(' · ');
}

const day = (posted: string) => new Date(posted).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const small = 'font-mono text-[11px] uppercase leading-4 tracking-[0.22em] text-[var(--muted)]';
const chevron = (
  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * The tape's tracklist: one list of what is on each side, from everything the page knows. The names in order
 * come from the tape's own tracklist or a list someone kept in the comments, the times from the IDs in the
 * comments (see lib/track-ids/tracklist.ts), and a side with only IDs is those IDs in order of time. A tape
 * is done when every row has a name and a time, and the rows that lack one show what is left.
 *
 * A time is pressed to hear the tape from there, and the row playing is lit as the tape moves. A row with no
 * time carries its number in the list where the time will go. While its side plays, a + is there instead:
 * pressed when the track starts, it gives the row that moment. Those times are the visitor's own until they
 * post them, together, as one comment in the site's form (lib/track-ids/compose.ts).
 *
 * Who the list is owed to is said once, above it. Every post that made it is kept under History, at its foot,
 * and out of the comments, where a run of them would bury the talk.
 */
export function Tracklist({ tapeId, sides }: { tapeId: string; sides: Pick<Side, 'position' | 'title' | 'tracks'>[] }) {
  const trackIds = useTapeTrackIds();
  const several = sides.length > 1;
  const labelled = several || Boolean(sides[0]?.title);
  const [marks, keep] = useMarks(tapeId);
  // Times just posted stay on their rows until the page has read the comments again and has them from there.
  const [sent, setSent] = useState<Mark[]>([]);
  useEffect(() => setSent((was) => (was.length ? [] : was)), [trackIds.sides]);

  const lists = useMemo(
    () =>
      sides.map((side, i) => {
        // The tape's own tracklist is in the page from the start, with what only it has: a record's page on
        // Discogs and its length. A list from the comments arrives with the IDs.
        const order: RunningOrder | null = side.tracks?.length
          ? { by: null, tracks: side.tracks.map((t, k) => ({ n: k + 1, artist: t.artist, title: t.title, known: true, link: t.discogs_url, duration: t.duration })) }
          : (trackIds.orders[i] ?? null);
        return { order, rows: tracklistRows(order, trackIds.sides[i] ?? []) };
      }),
    [sides, trackIds.orders, trackIds.sides],
  );
  const shown = useMemo(
    () =>
      lists.map(({ rows }, i) =>
        rows.map((row): Row => {
          const mine = (m: Mark) => m.side === i && m.n === row.n && m.artist === row.artist && m.title === row.title;
          const mark = row.start === null ? (marks.find(mine) ?? sent.find(mine)) : undefined;
          return mark ? { ...row, start: mark.time, pending: marks.includes(mark) } : { ...row, pending: false };
        }),
      ),
    [lists, marks, sent],
  );
  const pending = marks.filter((m) => shown[m.side]?.some((row) => row.pending && row.n === m.n));

  // What the list needs to know of where the tape is: the side playing, the row playing on it, and whether
  // a track could start at this moment (nothing on the side starts within a moment of it already).
  const [live, lit, clear] = usePlayhead((head) => {
    if (!head.started) return '-1|-1|0';
    const rows = shown[head.side] ?? [];
    let at = -1;
    rows.forEach((row, k) => {
      if (row.start !== null && row.start <= head.time && (at < 0 || row.start >= (rows[at].start as number))) at = k;
    });
    if (at >= 0) {
      const from = rows[at].start as number;
      const next = Math.min(...rows.flatMap((row) => (row.start !== null && row.start > from ? [row.start] : [])));
      if (head.time >= Math.min(rows[at].end ?? from + UNENDED, next)) at = -1;
    }
    const taken = rows.some((row) => row.start !== null && Math.abs(row.start - head.time) <= ONE_MOMENT);
    return `${head.side}|${at}|${taken ? 0 : 1}`;
  })
    .split('|')
    .map(Number);

  // Posting the visitor's times.
  const [remembered, setRemembered] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const some = pending.length > 0;
  useEffect(() => {
    if (some) setRemembered(rememberedName());
  }, [some]);

  const place = (side: number) => (several ? sides[side].position : null);
  const mark = (side: number, row: Row) => {
    const head = trackIds.playhead();
    const time = Math.floor(head.time);
    // The + was there when it was pressed; the tape may have reached another track's start since.
    if (row.n === null || !head.started || head.side !== side || shown[side].some((r) => r.start !== null && Math.abs(r.start - time) <= ONE_MOMENT)) return;
    keep([...marks.filter((m) => !(m.side === side && m.n === row.n)), { side, n: row.n, artist: row.artist, title: row.title, known: row.known, time }]);
    setThanks('');
  };
  const undo = (side: number, row: Row) => keep(marks.filter((m) => !(m.side === side && m.n === row.n)));
  const identify = (side: number, start: number) => {
    // An unknown track is ID'd by ear: the tape goes there, and the blanks open for it.
    trackIds.goTo(place(side), start);
    trackIds.ask(place(side), start);
  };
  async function post(e: FormEvent) {
    e.preventDefault();
    if (status === 'sending' || !some) return;
    const poster = (remembered || name).trim();
    if (!poster) {
      setStatus('error');
      setMessage('Enter your name.');
      nameField.current?.focus();
      return;
    }
    setStatus('sending');
    setMessage('');
    // A line the list has down as unknown is marked, not named: it is still nobody's ID.
    const lines = [...pending]
      .sort((a, b) => a.side - b.side || a.time - b.time)
      .map((m) => composeId({ position: place(m.side), time: m.time, artist: m.known ? m.artist : '', title: m.known ? m.title : '' }));
    const failed = await postIds(tapeId, poster, lines.join('\n'));
    if (failed) {
      setStatus('error');
      setMessage(failed);
      return;
    }
    setStatus('idle');
    setThanks(`Posted ${pending.length === 1 ? '1 time' : `${pending.length} times`}. Thanks.`);
    setSent(pending);
    keep([]);
    trackIds.refresh();
  }

  const credit = contributors(lists.map(({ rows, order }) => ({ rows, keeper: order?.by ?? null })));
  // Said for as long as a line lacks a posted time: it stays put while the visitor gives theirs.
  const waiting = lists.some(({ rows }) => rows.some((row) => row.start === null && row.n !== null));
  const headingId = useId();
  if (shown.every((rows) => rows.length === 0)) return null;

  return (
    <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16" aria-labelledby={headingId}>
      <div className="max-w-3xl">
        <h2 id={headingId} className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-5">
          Tracklist
        </h2>
        {credit.length > 0 && (
          <p className={small}>
            IDs by <span className="text-[var(--text)]">{names(credit)}</span>
          </p>
        )}
        {waiting && <p className="mt-2 max-w-prose text-[0.8125rem] leading-normal text-pretty text-[var(--muted)]">Listening? When a track starts, press the + on its row to give it that time.</p>}
        <div className="mt-8 space-y-10">
          {shown.map((rows, i) =>
            rows.length === 0 ? null : (
              <SideList
                key={sides[i].position}
                heading={labelled ? (sides[i].title ?? `Side ${sides[i].position}`) : null}
                summary={progress(rows, lists[i].order)}
                rows={rows}
                position={place(i)}
                lit={live === i ? lit : -1}
                canMark={live === i && clear === 1}
                onPlay={(start) => trackIds.goTo(place(i), start)}
                onMark={(row) => mark(i, row)}
                onUndo={(row) => undo(i, row)}
                onIdentify={(start) => identify(i, start)}
              />
            ),
          )}
        </div>
        {some && (
          <form onSubmit={post} noValidate className="tracklist-post" aria-label="Post your times">
            {/* With a name to ask for, the count has the bar's first line and the name and Post its second. */}
            <p className={`${small} min-w-0 ${remembered ? 'flex-1' : 'w-full pt-2'}`}>
              {pending.length === 1 ? '1 time' : `${pending.length} times`} not posted
              {remembered && (
                <>
                  {' '}
                  · as <span className="text-[var(--text)]">{remembered}</span>
                </>
              )}
            </p>
            {!remembered && (
              <input
                ref={nameField}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setMessage('');
                  }
                }}
                placeholder="Your name"
                aria-label="Your name"
                aria-describedby={message ? messageId : undefined}
                autoComplete="name"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                maxLength={100}
                enterKeyHint="send"
                className="track-ids-field tracklist-post-name"
              />
            )}
            <button type="submit" aria-disabled={status === 'sending'} className="poster-btn id-sheet-post">
              {status === 'sending' ? '…' : 'Post'}
            </button>
            <p id={messageId} role="alert" className="w-full font-mono text-[10px] uppercase leading-4 tracking-[0.22em] text-pretty text-red-500 empty:hidden">
              {message}
            </p>
          </form>
        )}
        <History />
        {/* Always here, so a screen reader hears the thanks arrive. */}
        <p role="status" className="sr-only">
          {thanks}
        </p>
      </div>
    </section>
  );
}

type SideListProps = {
  /** The side's name, on a tape whose sides have names. */
  heading: string | null;
  summary: string;
  rows: Row[];
  /** The side's label as the site shows it, or null on a tape that is one recording. */
  position: string | null;
  /** The row playing, or -1. */
  lit: number;
  /** The tape is on this side, at a moment where a track could start. */
  canMark: boolean;
  onPlay: (start: number) => void;
  onMark: (row: Row) => void;
  onUndo: (row: Row) => void;
  onIdentify: (start: number) => void;
};

function SideList({ heading, summary, rows, position, lit, canMark, onPlay, onMark, onUndo, onIdentify }: SideListProps) {
  const collapsible = rows.length > COLLAPSED_COUNT;
  const [expanded, setExpanded] = useState(!collapsible);
  const firstRevealed = useRef<HTMLLIElement>(null);
  const listId = useId();
  const all = expanded || !collapsible;

  // The control goes when the rest are shown; the keyboard goes on to the first of them, not back to the
  // top of the page.
  useEffect(() => {
    if (expanded && collapsible) firstRevealed.current?.focus();
  }, [expanded, collapsible]);

  return (
    <div>
      {heading && <h3 className="font-display text-xl leading-tight text-[var(--text)] mb-1">{heading}</h3>}
      <p className={`${small} mb-3`}>{summary}</p>
      {/* Pulled out by a row's own padding, so what is in the rows starts on the edge the heading does. */}
      <ol id={listId} className={`-mx-2${all ? '' : ' tracklist-fade'}`}>
        {rows.map((row, k) => {
          const label = row.known ? [row.artist, row.title].filter(Boolean).join(' — ') : 'Unknown track';
          return (
            <li
              key={row.n === null ? `at ${row.start}` : `no ${row.n}`}
              ref={k === COLLAPSED_COUNT ? firstRevealed : undefined}
              tabIndex={k === COLLAPSED_COUNT ? -1 : undefined}
              hidden={!all && k >= COLLAPSED_COUNT}
              aria-current={k === lit ? 'true' : undefined}
              className="tracklist-row"
            >
              <span>
                {row.start !== null ? (
                  <button
                    type="button"
                    onClick={() => onPlay(row.start as number)}
                    className="tracklist-time"
                    data-pending={row.pending ? '' : undefined}
                    aria-label={`Play from ${idPlace(position, row.start)}${row.pending ? ', your time, not posted yet' : ''}`}
                  >
                    {formatTime(row.start)}
                  </button>
                ) : canMark ? (
                  <button type="button" onClick={() => onMark(row)} className="tracklist-mark" aria-label={`${label} starts here`}>
                    +
                  </button>
                ) : (
                  row.n !== null && (
                    <span className="tracklist-n" aria-hidden>
                      {String(row.n).padStart(2, '0')}
                    </span>
                  )
                )}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {!row.known ? (
                  <span className="text-[var(--muted)]">Unknown track</span>
                ) : row.link ? (
                  <a href={row.link} target="_blank" rel="noopener noreferrer" className="tracklist-link cursor-pointer">
                    <TrackName row={row} />
                    <svg className="ml-2 inline h-3.5 w-3.5 align-[-2px] text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <TrackName row={row} />
                )}
                {row.pending ? (
                  <button type="button" onClick={() => onUndo(row)} className="tracklist-cue" aria-label={`Take back the time for ${label}`}>
                    Undo
                  </button>
                ) : (
                  !row.known &&
                  row.start !== null && (
                    <button type="button" onClick={() => onIdentify(row.start as number)} className="tracklist-cue" aria-label={`ID the unknown track at ${idPlace(position, row.start)}`}>
                      ID it
                    </button>
                  )
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {!all && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={listId}
          className={`cursor-pointer -mt-2 flex min-h-11 items-center gap-2 ${small} transition-colors hover:text-[var(--text)]`}
        >
          Show all {rows.length} tracks
          {chevron}
        </button>
      )}
    </div>
  );
}

function TrackName({ row }: { row: Row }) {
  return (
    <>
      {row.artist && <span className="font-medium">{row.artist}</span>}
      {row.artist && row.title && <span className="text-[var(--muted)]"> — </span>}
      {row.title}
      {row.duration && <span className="ml-2 font-mono text-xs text-[var(--muted)]">({row.duration})</span>}
    </>
  );
}

/**
 * Every post that made the tracklist: the comments that are IDs in the site's own form, newest first, each
 * with who posted it and when. Shut until asked for. A tape nobody has ID'd through the site has none.
 */
function History() {
  const { comments, goTo } = useTapeTrackIds();
  const [open, setOpen] = useState(false);
  const listId = useId();

  const posts = (comments ?? [])
    .flatMap((comment) => {
      const ids = splitPost(comment.content);
      return ids ? [{ ...comment, ids }] : [];
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (posts.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={listId}
        className={`cursor-pointer flex min-h-11 items-center gap-2 ${small} transition-colors hover:text-[var(--text)]`}
      >
        History · {posts.length === 1 ? '1 post' : `${posts.length} posts`}
        <span className={open ? 'rotate-180' : undefined}>{chevron}</span>
      </button>
      <ul id={listId} hidden={!open}>
        {posts.map((post) => (
          <li key={post.id} className="id-log-entry">
            <div className="min-w-0">
              {post.ids.map((id, k) => {
                const at = idPlace(id.position, id.time);
                return (
                  <p key={k} className="comment-id">
                    <button type="button" onClick={() => goTo(id.position, id.time)} className="comment-time" aria-label={`Play from ${at}`}>
                      {at}
                    </button>{' '}
                    {id.gone ? <span className="text-[var(--muted)]">Removed</span> : [id.artist, id.title].filter(Boolean).join(' — ') || 'Unknown track'}
                  </p>
                );
              })}
            </div>
            <p className="id-log-by">
              {post.author_name} · <time dateTime={post.created_at}>{day(post.created_at)}</time>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
