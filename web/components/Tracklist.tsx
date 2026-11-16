'use client';

import { FormEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { idPlace, readComposed, type RunningOrder } from '../lib/track-ids/compose';
import { canMoveTo, contributors, couldStartAt, isUnposted, playingAt, type Row } from '../lib/track-ids/side';
import { formatTime } from '../lib/time-utils';
import { usePlayhead, useTapeTrackIds } from './TapeTrackIds';

/** A long side shows this many tracks before the rest are asked for. */
const COLLAPSED_COUNT = 20;
const NONE = new Set<number>();

const names = (people: string[]) => {
  const [a, b, c, ...rest] = people;
  if (rest.length) return `${a}, ${b}, ${c}, and ${rest.length} ${rest.length === 1 ? 'other' : 'others'}`;
  return c ? `${a}, ${b}, and ${c}` : b ? `${a} and ${b}` : a;
};

const count = (n: number) => (n === 1 ? '1 ID' : `${n} IDs`);

/**
 * How far along a side is, in a few words, by what the comments have: the visitor's unposted times are not
 * the side's yet. Nothing where all there is of the side is theirs.
 */
function progress(all: Row[], order: RunningOrder | null) {
  const rows = all.filter((row) => row.n !== null || !isUnposted(row));
  if (rows.length === 0) return '';
  const timed = rows.filter((row) => row.start !== null && !isUnposted(row)).length;
  const unknown = rows.filter((row) => !row.known).length;
  const parts = order
    ? [timed === rows.length && !unknown ? `All ${rows.length} tracks timed` : `${timed} of ${rows.length} timed`]
    : [`${rows.length - unknown} ${rows.length - unknown === 1 ? 'track' : 'tracks'} ID’d`];
  if (unknown) parts.push(`${unknown} unknown`);
  return parts.join(' · ');
}

const day = (posted: string) => new Date(posted).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const small = 'font-mono text-[11px] uppercase leading-[1.45] tracking-[0.22em] text-balance text-[var(--muted)]';
const chevron = (
  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * The tape's tracklist: each side's rows, as the whole page has them (lib/track-ids/side.ts). The names in
 * order come from the tape's own tracklist or a list someone kept in the comments, the times from the IDs,
 * and a side with only IDs is those IDs in order of time. A tape is done when every row has a name and a
 * time, and the rows that lack one show what is left.
 *
 * A time is pressed to hear the tape from there, and the row playing is lit as the tape moves. A row with no
 * time carries its number in the list where the time will go. While its side plays, the rows that could be
 * the track starting now have a + there instead, and pressing it gives the row that moment. A row that has
 * its time has "Edit", which opens the blanks at the player for that track: its name put right, its time
 * moved, or the ID taken away. A row still waiting for its time has it too, and there the blanks take a time
 * typed by hand (the line's number, where the time will go, opens them as well: on a phone it is the way
 * to them). With a mouse the blanks open in the row itself (the row makes a place for
 * them, and components/TrackIds.tsx puts them there); on a phone they are the sheet.
 *
 * What the visitor has said and not posted (a + here, a point marked by ear up at the player) is on its row
 * like any other time, in full colour, with the way to take it back. A bar at the foot of the screen says how
 * many wait and posts them together, as one comment (lib/track-ids/compose.ts).
 *
 * Who the list is owed to is said once, above it. Every post that made it is kept under History, at its foot,
 * and out of the comments, where a run of them would bury the talk.
 */
export function Tracklist() {
  const { tape, sides, read, name: remembered, unposted, goTo, playhead, say, unsay, post: send, ask, editing, setSlot } = useTapeTrackIds();
  const several = tape.length > 1;
  const labelled = several || Boolean(tape[0]?.title);
  const place = (side: number) => (several ? tape[side].position : null);

  // What the list needs to know of where the tape is: the side playing, the row playing on it, the rows
  // that could be given this moment as their start, and the timed rows whose time could be moved to it:
  // of the last to start and the next to, those `canMoveTo` allows. (None of either until the comments are
  // back: a time is given on top of what they say.) A time given is a whole second, so it is the whole
  // second that is asked about.
  const [liveSide, litRow, couldStart, couldMove] = usePlayhead((head) => {
    if (!head.started) return '-1|-1||';
    const { rows = [], length } = sides[head.side] ?? {};
    const lit = playingAt(rows, head.time);
    if (read === 'reading') return `${head.side}|${lit}||`;
    const now = Math.floor(head.time);
    const nearest = [rows.findLastIndex((row) => row.start !== null && row.start <= now), rows.findIndex((row) => row.start !== null && row.start > now)];
    return `${head.side}|${lit}|${couldStartAt(rows, now, length).join(',')}|${nearest.filter((k) => k >= 0 && canMoveTo(rows, rows[k], now, length)).join(',')}`;
  }).split('|');
  const live = Number(liveSide);
  const lit = Number(litRow);
  const markable = useMemo(() => new Set(couldStart ? couldStart.split(',').map(Number) : []), [couldStart]);
  const movable = useMemo(() => new Set(couldMove ? couldMove.split(',').map(Number) : []), [couldMove]);

  // Posting the visitor's times.
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();
  // Not before the comments are back: until then the visitor's changes aren't on the page to be seen.
  const some = read !== 'reading' && unposted.length > 0;

  const mark = (side: number, k: number) => {
    const head = playhead();
    const time = Math.floor(head.time);
    const { rows, length } = sides[side];
    // The + was there when it was pressed; the tape may have reached another track's start since.
    if (head.side !== side || !couldStartAt(rows, time, length).includes(k)) return;
    // A line the list has down as unknown is marked, not named: it is still nobody's ID.
    say({ side, time, artist: rows[k].known ? rows[k].artist : '', title: rows[k].known ? rows[k].title : '' });
    setThanks('');
  };
  const identify = (side: number, start: number) => {
    // An unknown track is ID'd by ear: the tape goes there, and the blanks open for it.
    goTo(place(side), start);
    ask({ position: place(side), time: start, n: null });
  };
  const edit = (side: number, start: number | null, n: number | null) => {
    // A row is edited with the tape left as it is: playing or not, and where it is, so that a track's time
    // can be moved to there. On a side that isn't the one in the player the tape goes to the track first, or
    // for a line with no time yet to the start of its side: the blanks are the loaded side's.
    if (side !== playhead().side) goTo(place(side), start ?? 0);
    ask({ position: place(side), time: start, n });
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
    const posted = count(unposted.length);
    const failed = await send(unposted, poster);
    if (failed) {
      setStatus('error');
      setMessage(failed);
      return;
    }
    setStatus('idle');
    setThanks(`Posted ${posted}. Thanks.`);
  }

  const credit = contributors(sides.map(({ rows, order }) => ({ rows, keeper: order?.by ?? null })));
  // Said for as long as a line lacks a posted time: it stays put while the visitor gives theirs.
  const waiting = sides.some(({ rows }) => rows.some((row) => row.n !== null && (row.start === null || isUnposted(row))));
  const headingId = useId();
  if (sides.every(({ rows }) => rows.length === 0)) return null;

  return (
    <section id="tracklist" className="scroll-mt-4 border-t-[1.5px] border-[var(--border)] pt-14 mt-16" aria-labelledby={headingId}>
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
        {/* The comments since the archive couldn't be read, or not all of them: what is here is true, and may not be all. */}
        {read === 'short' && <p className="mt-2 max-w-prose text-[0.8125rem] leading-normal text-pretty text-[var(--muted)]">The latest IDs couldn’t be read just now, so some may be missing here.</p>}
        <div className="mt-8 space-y-10">
          {sides.map(({ rows, order }, i) =>
            rows.length === 0 ? null : (
              <SideList
                key={tape[i].position}
                heading={labelled ? (tape[i].title ?? `Side ${tape[i].position}`) : null}
                summary={progress(rows, order)}
                rows={rows}
                position={place(i)}
                silent={Boolean(tape[i].silent)}
                lit={live === i ? lit : -1}
                markable={live === i ? markable : NONE}
                movable={live === i ? movable : NONE}
                editing={editing && editing.position === place(i) ? editing : null}
                slot={setSlot}
                onPlay={(start) => goTo(place(i), start)}
                onMark={(k) => mark(i, k)}
                onUndo={unsay}
                onIdentify={(start) => identify(i, start)}
                onEdit={(start, n) => edit(i, start, n)}
              />
            ),
          )}
        </div>
        {some && (
          <form onSubmit={post} noValidate className="tracklist-post" aria-label="Post your IDs">
            {/* The page's own column, so the bar's words start on the edge everything else does. With a name
                to ask for, the count has the bar's first line and the name and Post its second. */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="flex max-w-3xl flex-wrap items-center gap-x-4">
                <p className={`${small} min-w-0 ${remembered ? 'flex-1' : 'w-full pt-2'}`}>
                  {count(unposted.length)} pending
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
                <p id={messageId} role="alert" className="w-full font-mono text-[10px] uppercase leading-[1.6] tracking-[0.22em] text-pretty text-red-500 empty:hidden">
                  {message}
                </p>
              </div>
            </div>
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
  /** The site has no audio for the side: its times say where a track is, and can't be gone to. */
  silent: boolean;
  /** The row playing, or -1. */
  lit: number;
  /** The rows that could be given the moment the tape is at as their start, by their place in `rows`. */
  markable: Set<number>;
  /** The timed rows whose time could be moved to the moment the tape is at. */
  movable: Set<number>;
  /**
   * The row whose blanks are open in it, by where it starts or, for a line with no time yet, by its number
   * in the list; or null. And how the row gives the blanks their place.
   */
  editing: { time: number | null; n: number | null } | null;
  slot: (place: HTMLElement | null) => void;
  onPlay: (start: number) => void;
  onMark: (row: number) => void;
  onUndo: (change: NonNullable<Row['mine']>) => void;
  onIdentify: (start: number) => void;
  /** For a row that has its time, where it starts; for a line with none, null and its number in the list. */
  onEdit: (start: number | null, n: number | null) => void;
};

function SideList({ heading, summary, rows, position, silent, lit, markable, movable, editing, slot, onPlay, onMark, onUndo, onIdentify, onEdit }: SideListProps) {
  const collapsible = rows.length > COLLAPSED_COUNT;
  // A side that is short when it first shows is never folded later, when a row is added to it.
  const [expanded, setExpanded] = useState(!collapsible);
  const firstRevealed = useRef<HTMLLIElement>(null);
  const listId = useId();
  const all = expanded || !collapsible;

  // "Show all" goes when the rest are shown; the keyboard goes on to the first of them, not back to the top
  // of the page. Only then: a row added to a side that was never folded moves the keyboard nowhere.
  const [shownAll, setShownAll] = useState(false);
  useEffect(() => {
    if (shownAll) firstRevealed.current?.focus();
  }, [shownAll]);

  // A folded side opens by itself when the track playing is in the part folded away: the row the page is
  // pointing at is never the one it hides. Whoever is reading further down the page then keeps their place:
  // the page is scrolled by as much as the side grew, measured from the top of the page so that it comes
  // out the same whether or not the browser has already held the place itself.
  const whole = useRef<HTMLDivElement>(null);
  const folded = useRef<{ bottom: number; scroll: number } | null>(null);
  useLayoutEffect(() => {
    if (expanded || lit < COLLAPSED_COUNT || !whole.current) return;
    folded.current = { bottom: whole.current.getBoundingClientRect().bottom, scroll: window.scrollY };
    setExpanded(true);
  }, [expanded, lit]);
  useLayoutEffect(() => {
    const was = folded.current;
    if (!expanded || !was || !whole.current) return;
    folded.current = null;
    const grew = whole.current.getBoundingClientRect().bottom + window.scrollY - (was.bottom + was.scroll);
    if (was.bottom <= 0) window.scrollTo({ top: was.scroll + grew, behavior: 'instant' });
  }, [expanded]);

  // When the blanks in a row shut with the keyboard still in them, it goes back to what opened them in that
  // row. If the row is no longer as it was (its track moved or taken away, or the line given its time), it
  // goes to the time of the row that is now nearest: never to a cue, which the next press of Enter would
  // set off.
  const list = useRef<HTMLOListElement>(null);
  const edited = useRef<SideListProps['editing']>(null);
  useEffect(() => {
    const was = edited.current;
    edited.current = editing;
    if (was === null || editing !== null || document.activeElement !== document.body || !list.current) return;
    const row = list.current.querySelector<HTMLElement>(was.time !== null ? `[data-start="${was.time}"]` : `[data-n="${was.n}"]`);
    const opener = row?.querySelector<HTMLElement>(was.time !== null ? '.tracklist-edit' : 'button.tracklist-n');
    const far = (other: HTMLElement) => Math.abs(Number(other.dataset.start) - (was.time ?? 0));
    const [nearest] = was.time === null ? [] : [...list.current.querySelectorAll<HTMLElement>('[data-start]')].sort((x, y) => far(x) - far(y));
    (opener ?? (row ?? nearest)?.querySelector<HTMLElement>('.tracklist-time'))?.focus({ preventScroll: true });
  }, [editing]);

  return (
    <div ref={whole}>
      {heading && <h3 className="font-display text-xl leading-tight text-[var(--text)] mb-1">{heading}</h3>}
      {summary && <p className={`${small} mb-3`}>{summary}</p>}
      {/* Pulled out by a row's own padding, so what is in the rows starts on the edge the heading does. */}
      <ol ref={list} id={listId} className={`-mx-2${all ? '' : ' tracklist-fade'}`}>
        {rows.map((row, k) => {
          const label = row.known ? [row.artist, row.title].filter(Boolean).join(' — ') : 'Unknown track';
          const unposted = isUnposted(row);
          return (
            <li
              key={row.n === null ? `at ${row.start}` : `no ${row.n}`}
              ref={k === COLLAPSED_COUNT ? firstRevealed : undefined}
              tabIndex={k === COLLAPSED_COUNT ? -1 : undefined}
              hidden={!all && k >= COLLAPSED_COUNT}
              aria-current={k === lit ? 'true' : undefined}
              data-movable={movable.has(k) ? '' : undefined}
              data-start={row.start ?? undefined}
              data-n={row.n ?? undefined}
              className="tracklist-row"
            >
              {editing && (editing.time !== null ? row.start === editing.time : row.start === null && row.n === editing.n) ? (
                <div ref={slot} className="tracklist-blanks" />
              ) : (
                <>
                  <span>
                    {row.start !== null && silent ? (
                      <span className="tracklist-n">{formatTime(row.start)}</span>
                    ) : row.start !== null ? (
                      <button
                        type="button"
                        onClick={() => onPlay(row.start as number)}
                        className="tracklist-time"
                        data-unposted={unposted ? '' : undefined}
                        aria-label={`Play from ${idPlace(position, row.start)}${unposted ? ', your time, not posted yet' : ''}`}
                      >
                        {formatTime(row.start)}
                      </button>
                    ) : markable.has(k) ? (
                      // Several lines can be unknown: one is told from the next by its number in the list.
                      <button type="button" onClick={() => onMark(k)} className="tracklist-mark" aria-label={`${row.known ? label : `Track ${row.n}`} starts here`}>
                        +
                      </button>
                    ) : row.n !== null && silent ? (
                      <span className="tracklist-n" aria-hidden>
                        {String(row.n).padStart(2, '0')}
                      </span>
                    ) : (
                      // The line's number stands where its time will go, and is pressed to give it one by hand.
                      row.n !== null && (
                        <button type="button" onClick={() => onEdit(null, row.n)} className="tracklist-n" aria-label={`Set the time for ${row.known ? label : `track ${row.n}`}`} title="Set its time">
                          {String(row.n).padStart(2, '0')}
                        </button>
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
                    {unposted ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onUndo(row.mine as NonNullable<Row['mine']>)}
                          className="tracklist-cue"
                          aria-label={row.known ? `Take back the time for ${label}` : `Take back the mark at ${idPlace(position, row.start as number)}`}
                        >
                          Undo
                        </button>
                        {/* The visitor's own is edited like any other: its time typed over, and nothing posted by it. */}
                        {!silent && (
                          <button type="button" onClick={() => onEdit(row.start, null)} className="tracklist-cue tracklist-edit" aria-label={`Edit ${row.known ? label : 'your mark'}, at ${idPlace(position, row.start as number)}`}>
                            Edit
                          </button>
                        )}
                      </>
                  ) : silent ? null : row.start === null ? (
                      row.n !== null && (
                        <button type="button" onClick={() => onEdit(null, row.n)} className="tracklist-cue tracklist-edit" aria-label={`Edit ${row.known ? label : `track ${row.n}`}`}>
                          Edit
                        </button>
                      )
                    ) : row.known ? (
                      <button type="button" onClick={() => onEdit(row.start, null)} className="tracklist-cue tracklist-edit" aria-label={`Edit ${label}, at ${idPlace(position, row.start)}`}>
                        Edit
                      </button>
                    ) : (
                      <button type="button" onClick={() => onIdentify(row.start as number)} className="tracklist-cue tracklist-add" aria-label={`ID the unknown track at ${idPlace(position, row.start)}`}>
                        + ID
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {!all && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setShownAll(true);
          }}
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
  const { comments, tape, goTo } = useTapeTrackIds();
  const [open, setOpen] = useState(false);
  const listId = useId();

  // The reader's own test of what is a post of IDs (and for which sides), so what is listed here is what was
  // read as one, and what is left out of the comments is what is listed here.
  const positions = tape.map((side) => side.position);
  const posts = (comments ?? [])
    .flatMap((comment) => {
      const ids = readComposed(comment.content, positions);
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
                const position = tape.length > 1 ? tape[id.side].position : null;
                const at = idPlace(position, id.start);
                return (
                  <p key={k} className="comment-id">
                    {tape[id.side].silent ? (
                      <span className="tabular-nums text-[var(--muted)]">{at}</span>
                    ) : (
                      <button type="button" onClick={() => goTo(position, id.start)} className="comment-time" aria-label={`Play from ${at}`}>
                        {at}
                      </button>
                    )}{' '}
                    {id.gone ? <span className="text-[var(--muted)]">Removed</span> : [id.artist, id.title].filter(Boolean).join(' — ') || 'Unknown track'}
                    {id.line && <span className="text-[var(--muted)]"> (was {[id.line.artist, id.line.title].filter(Boolean).join(' — ')})</span>}
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
