'use client';

import { FormEvent, RefObject, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { idLabel, idPlace, tidy } from '../lib/track-ids/compose';
import { rememberedName } from '../lib/track-ids/post';
import { isUnposted, playingAt, saidBy, startingAt, suggest, type Change, type Row } from '../lib/track-ids/side';
import { formatTime } from '../lib/time-utils';
import { usePlayhead, useSide, useTapeTrackIds } from './TapeTrackIds';

/** What the blanks are about to do: post the ID in them, take the mark away, or move it to where the tape is. */
type Act = 'id' | 'remove' | 'move';

/**
 * A screen as narrow as a phone's. There the blanks are a sheet over the page, with a row each, and the line
 * itself gives way to a tray at the foot of the screen (the stylesheet hides the line at the same width).
 */
const PHONE = '(max-width: 39.99rem)';

/** Whether the screen is that narrow, kept up to date. Not before the page is in a browser. */
function useOnPhone() {
  return useSyncExternalStore(
    (changed) => {
      const media = window.matchMedia(PHONE);
      media.addEventListener('change', changed);
      return () => media.removeEventListener('change', changed);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * Puts the keyboard in a field. In the sheet it is done "in place": on an iPhone, a field taking focus makes
 * Safari scroll the page to bring the field to the middle of the screen, even a field in a sheet, which
 * doesn't move with the page, so the sheet stays put and the page slides away underneath it. Safari skips the
 * scroll for a field it takes to be at the top already, so the field is put there for the instant it takes
 * focus. (React Aria does the same.)
 */
function focus(field: HTMLInputElement | null, inPlace: boolean) {
  if (!field) return;
  if (!inPlace) return field.focus();
  field.style.transform = 'translateY(-2000px)';
  field.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    field.style.transform = '';
    reveal(field);
  });
}

/**
 * On a small phone the sheet is taller than what the keyboard leaves of the screen, and scrolls. The blank
 * being typed in is brought up clear of the keyboard, by scrolling the sheet and never the page.
 */
function reveal(field: Element | null) {
  const sheet = field?.closest('dialog');
  const view = window.visualViewport;
  if (!field || !sheet || !view) return;
  const hidden = field.getBoundingClientRect().bottom + 8 - (view.offsetTop + view.height);
  if (hidden > 0) sheet.scrollTop += hidden;
}

/** Sends the sheet back down, then closes it. With no motion to wait for, it closes at once. */
function dismiss(sheet: HTMLDialogElement) {
  if ('leaving' in sheet.dataset) return;
  sheet.dataset.leaving = '';
  // Asking for the animations starts the one the attribute calls for.
  Promise.allSettled(sheet.getAnimations().map((animation) => animation.finished)).then(() => sheet.close());
}

type Props = {
  /** Which of the tape's sides this is, counting from 0. */
  side: number;
  /** The side's label as the site shows it ("A", "1B"), or null on a tape that is one recording. */
  position: string | null;
  /** Where the tape is, in seconds. */
  time: number;
  /** Whether the tape is playing, and the way to play or pause it, for the tray on a phone. */
  isPlaying: boolean;
  onToggle: () => void;
  /** The side's length in seconds, where it is known. */
  length?: number | null;
};

/**
 * One line under the bar. It says the track playing now, by the side's rows as the whole page has them
 * (lib/track-ids/side.ts); where there is none, it asks. Pressed, it takes an ID: with a mouse the line
 * becomes two blanks in its own place; on a phone a sheet rises over the page and stays on top of the
 * keyboard. What is typed is posted as an ordinary comment that carries the side and the time
 * (lib/track-ids/compose.ts), and is on the page as posted from that moment.
 *
 * The blanks are always about one mark: the track playing, or, with nothing playing, a new one at this
 * moment. A name already there is pressed to put it right. A mark can also be taken away, or moved to where
 * the tape is now if it was made too early; both are posts like any other.
 *
 * Beside the line are the two ways to say that a track starts here: "New ID" opens the blanks to say which,
 * and "New unknown" says only that one does, in one press, so a visitor can go through a tape setting the
 * points and leave the names to whoever knows them. Neither is there within a moment of a track's start:
 * one moment, one track. A new unknown is the visitor's own until they post what they have (the tracklist
 * keeps the count and the Post), and until then it is taken back, or ID'd, like any other mark.
 *
 * On a phone the line has no room for a track's name and the words beside it, and it is at the top of a long
 * page. There, once the tape has been played, all of it is in a tray at the foot of the screen instead: the
 * name on two lines, then play, the ID and the new unknown, each always in its place so none moves under a
 * thumb. A new track the visitor can name is marked and then ID'd.
 *
 * Where the side has a list of its tracks, the two lines of it likeliest to be the track being ID'd are
 * offered, and pressing one writes it into the blanks.
 */
export function TrackIds({ side, position, time, isPlaying, onToggle, length = null }: Props) {
  const { rows, order } = useSide(side);
  const { say, unsay, post: send, asked, answered } = useTapeTrackIds();
  const played = usePlayhead((head) => head.started);
  const now = Math.floor(time);
  const playing = rows[playingAt(rows, time)] ?? null;
  // A track could start at this moment: the tape has been played, and nothing starts within a moment of here.
  const free = played && startingAt(rows, now) < 0;
  // The blanks are for one moment of the tape, fixed when they open, while the tape plays on underneath.
  const [at, setAt] = useState<number | null>(null);
  // The mark the blanks are for, where the tape already has one at that moment.
  const [mark, setMark] = useState<Row | null>(null);
  // Where the tape was when the blanks opened, if the mark could be moved there: later than it, and in it.
  const [later, setLater] = useState<number | null>(null);
  const [doing, setDoing] = useState<Act>('id');
  const [sheet, setSheet] = useState(false);
  // The visitor's name is asked for the first time only. The line has room for one thing at a time, so it
  // asks as a second step; the sheet has a row for it from the start.
  const [askName, setAskName] = useState(false);
  // Counts each time the name is asked for after the blanks are open, so the keyboard can go to it.
  const [nameWanted, setNameWanted] = useState(0);
  const [offers, setOffers] = useState<Row[]>([]);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const line = useRef<HTMLButtonElement>(null);
  const trayId = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const artistField = useRef<HTMLInputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();

  const begin = (marked: Row | null, start: number) => {
    const onPhone = window.matchMedia(PHONE).matches;
    const remembered = rememberedName();
    setAt(start);
    setMark(marked);
    // A mark made too early can be moved to here: the tape is in that track, and a track could start at this
    // moment. (The visitor's own unposted mark is taken back and made again.)
    setLater(marked && !isUnposted(marked) && marked === playing && free ? now : null);
    setDoing('id');
    setArtist(marked?.known ? marked.artist : '');
    setTitle(marked?.known ? marked.title : '');
    setOffers(marked?.known ? [] : suggest(rows, start, length));
    setName(remembered);
    setSheet(onPhone);
    setAskName(onPhone && !remembered);
    setNameWanted(0);
    setStatus('idle');
    setMessage('');
    setThanks('');
  };
  // An ID is for the track playing. Where the side has one marked, it goes to where that track starts: a
  // correction then replaces the older word, and an ID for a track marked unknown fills the whole of it and
  // doesn't split it at the moment the visitor happened to speak up. With nothing playing it goes to this
  // moment, or to the mark about to start within a moment of it: one moment, one track.
  const open = () => {
    const marked = playing ?? rows[startingAt(rows, now)] ?? null;
    begin(marked, marked?.start ?? now);
  };
  /** "New ID": a track starts here, whatever is playing, and the visitor will say which. */
  const openNew = () => begin(null, now);
  const markHere = () => {
    if (!free) return;
    say({ side, time: now, artist: '', title: '' });
    setThanks(`Marked ${idPlace(position, now)}. Not posted yet.`);
  };
  // The tracklist asks for one of its rows. On a tape with sides the blanks belong to the side loaded, so a
  // row on another side is answered once the player has loaded that side; and they open on the side's rows
  // and the tape's place as they are when the asking is heard.
  const answer = useRef<(time: number) => void>(() => {});
  useEffect(() => {
    answer.current = (start) => begin(rows.find((row) => row.start === start) ?? null, start);
  });
  useEffect(() => {
    if (!asked || asked.position !== position) return;
    answered();
    answer.current(asked.time);
  }, [asked, position, answered]);
  const shut = () => setAt(null);
  // The sheet goes back down the way it came up; the blanks in the line just go.
  const leave = () => (sheet && dialog.current ? dismiss(dialog.current) : shut());

  useLayoutEffect(() => {
    if (at !== null && sheet && !dialog.current?.open) dialog.current?.showModal();
  }, [at, sheet]);

  // The sheet sits on the keyboard. A phone doesn't move a fixed thing out of the keyboard's way, it draws
  // the keyboard over it, so the sheet is told how much of the screen the keyboard has taken and how much is
  // left to be seen.
  useEffect(() => {
    const el = dialog.current;
    const view = window.visualViewport;
    if (!el || !view) return;
    const follow = () => {
      const keyboard = Math.max(0, window.innerHeight - view.height - view.offsetTop);
      el.style.setProperty('--keyboard', `${keyboard}px`);
      el.style.setProperty('--seen', `${view.height}px`);
      reveal(document.activeElement);
    };
    // The sheet's contents glide up as the keyboard comes; where the blank ends up is known once they stop.
    const settled = () => reveal(document.activeElement);
    follow();
    view.addEventListener('resize', follow);
    view.addEventListener('scroll', follow);
    el.addEventListener('transitionend', settled);
    return () => {
      view.removeEventListener('resize', follow);
      view.removeEventListener('scroll', follow);
      el.removeEventListener('transitionend', settled);
    };
  }, [at, sheet]);

  // The keyboard follows: into the blanks as they open, on to the name when it is asked for, and back to the
  // line when they shut.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (at === null) {
      if (wasOpen.current) (trayId.current ?? line.current)?.focus();
    } else if (!wasOpen.current) focus(artistField.current, sheet);
    wasOpen.current = at !== null;
  }, [at, sheet]);
  useEffect(() => {
    if (nameWanted > 0) focus(nameField.current, sheet);
  }, [nameWanted, sheet]);
  const wantName = () => {
    setAskName(true);
    setNameWanted((n) => n + 1);
  };

  const settle = () => {
    if (status !== 'error') return;
    setStatus('idle');
    setMessage('');
  };
  const refuse = (text: string, field: HTMLInputElement | null) => {
    setStatus('error');
    setMessage(text);
    focus(field, sheet);
  };
  const typed = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    settle();
  };
  const take = (offer: Row) => {
    setArtist(offer.artist);
    setTitle(offer.title);
    settle();
  };
  // In the sheet the keyboard's Next key sends Enter. It should go on to the next blank, not post half an ID.
  const onward = (next: RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || !next.current) return;
    e.preventDefault();
    focus(next.current, true);
  };
  // A tap on another blank in the sheet, taken in place for the reason `focus` gives.
  const tapped = (e: React.TouchEvent<HTMLFormElement>) => {
    const field = e.target instanceof HTMLInputElement ? e.target : null;
    if (!field || field === document.activeElement) return; // a tap in the blank being typed in places the caret
    e.preventDefault();
    focus(field, true);
  };

  async function act(what: Act) {
    if (status === 'sending' || at === null) return;
    // The visitor's own unposted mark is theirs to take back: nothing was said, so nothing is posted.
    if (what === 'remove' && mark?.mine && !mark.mine.sent) {
      unsay(mark.mine);
      setThanks('Removed.');
      return leave();
    }
    // Only an ID needs a name: a mark is taken away or moved as it is, named or not.
    if (what === 'id' && !artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', artistField.current);
    if (!name.trim()) {
      if (askName) return refuse('Enter your name.', nameField.current);
      // The line asks for the name as a step of its own, and the step ends in what was being done.
      setDoing(what);
      return wantName();
    }
    // Taking a mark away is one line; moving it is that line and the ID at its new place, in one post.
    const gone: Change[] = mark && what !== 'id' ? [{ side, time: mark.start as number, artist: '', title: '', gone: true }] : [];
    const id: Change[] = what === 'remove' ? [] : [{ side, time: what === 'move' && later !== null ? later : at, artist: tidy(artist), title: tidy(title) }];

    setStatus('sending');
    setMessage('');
    const failed = await send([...gone, ...id], name);
    // In the line the name, once asked for, is the only blank there is.
    if (failed) return refuse(failed, askName && !sheet ? nameField.current : artistField.current);
    setStatus('idle');
    setThanks(what === 'remove' ? 'Removed.' : what === 'move' ? 'Moved. Thanks.' : 'Posted. Thanks.');
    leave();
  }
  const post = (e: FormEvent) => {
    e.preventDefault();
    act(doing);
  };

  const where = idPlace(position, at ?? 0);
  const sending = status === 'sending';
  const from = order?.by ? `From ${order.by}’s list` : 'From the tape’s tracklist';
  const posting = (
    <span className="grid place-items-center">
      <span className={`col-start-1 row-start-1 ${sending ? 'invisible' : ''}`}>{doing === 'remove' ? 'Remove' : doing === 'move' ? 'Move' : 'Post'}</span>
      <span className={`col-start-1 row-start-1 ${sending ? '' : 'invisible'}`}>…</span>
    </span>
  );
  // What can be done with a mark already on the tape besides putting its name right.
  const upkeep = mark && (
    <>
      {later !== null && (
        <button type="button" onClick={() => act('move')} aria-disabled={sending} className="track-ids-post">
          Starts at {formatTime(later)} instead
        </button>
      )}
      <button type="button" onClick={() => act('remove')} aria-disabled={sending} className="track-ids-post">
        {mark.known ? 'Remove this ID' : 'Remove this mark'}
      </button>
    </>
  );
  const cross = (
    <svg className="h-3 w-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1 1l12 12M13 1L1 13" />
    </svg>
  );
  const complaint = (
    <p id={messageId} role="alert" className="font-mono text-[10px] uppercase leading-[1.6] tracking-[0.22em] text-pretty text-red-500 empty:hidden mt-2">
      {message}
    </p>
  );

  const tray = useOnPhone() && played;
  // Said beside a mark wherever it is the visitor's own and not posted, so no part of the page shows it as the tape's.
  const unposted = playing !== null && isUnposted(playing);

  return (
    <div className="track-ids">
      {at === null || sheet ? (
        // As tall as the blanks that take its place, so nothing below moves when they do. Under the sheet it
        // stays as it was.
        <div className="track-ids-row mt-2 flex min-h-11 items-center gap-x-3">
          {playing?.known ? (
            <button ref={line} type="button" onClick={open} className="track-ids-line text-[var(--text)]" aria-label={`Now playing: ${idLabel(playing)}. Correct this ID`} title={`${saidBy(playing)}. Press to correct it.`}>
              {idLabel(playing)}
            </button>
          ) : (
            <button ref={line} type="button" onClick={open} className="track-ids-line text-[var(--muted)]">
              {playing ? 'Unknown track. Know it?' : 'Know this track?'} <span className="track-ids-cue">ID it</span>
            </button>
          )}
          {unposted && <span className="track-ids-state">Not posted</span>}
          {/* Not within a moment of a track's start: what is said there is said of that track. */}
          {free && playing?.known && (
            <button type="button" onClick={openNew} className="track-ids-post" aria-label="New ID: a track starts here, and you know what it is" title="A track starts here, and you know what it is">
              New ID
            </button>
          )}
          {free && (
            <button type="button" onClick={markHere} className="track-ids-post" aria-label="New unknown: a track starts here, and you don’t know what it is" title="A track starts here, and you don’t know what it is">
              New unknown
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={post} noValidate onKeyDown={(e) => e.key === 'Escape' && shut()} aria-label={`ID the track at ${where}`} className="mt-2">
          {/* The line itself, with blanks where the names go: the same type in the same place, a rule under
              each blank, and no boxes. */}
          <div className="flex min-h-11 items-center gap-x-3">
            <span className="track-ids-where">{where}</span>
            {askName ? (
              <input ref={nameField} value={name} onChange={typed(setName)} placeholder="Your name" aria-label="Your name" aria-describedby={message ? messageId : undefined} autoComplete="name" maxLength={100} enterKeyHint="send" className="track-ids-field" />
            ) : (
              <>
                <input ref={artistField} value={artist} onChange={typed(setArtist)} placeholder="Artist" aria-label="Artist" aria-describedby={message ? messageId : undefined} autoComplete="off" autoCapitalize="words" enterKeyHint="send" className="track-ids-field" />
                <span aria-hidden className="text-[var(--muted)]">
                  —
                </span>
                <input value={title} onChange={typed(setTitle)} placeholder="Title" aria-label="Title" autoComplete="off" autoCapitalize="words" enterKeyHint="send" className="track-ids-field" />
              </>
            )}
            <div className="flex items-center">
              <button type="submit" aria-disabled={sending} className="track-ids-post">
                {posting}
              </button>
              <button type="button" onClick={shut} aria-label="Cancel" className="track-ids-shut">
                {cross}
              </button>
            </div>
          </div>
          {offers.length > 0 && !askName && (
            <div role="group" aria-label={from} className="track-ids-offers">
              {offers.map((offer) => (
                <button key={offer.n} type="button" onClick={() => take(offer)} className="track-ids-offer" title={from}>
                  <span>{offer.n}</span>
                  {offer.artist} — {offer.title}
                </button>
              ))}
            </div>
          )}
          {upkeep && !askName && <div className="flex flex-wrap gap-x-6">{upkeep}</div>}
          {complaint}
        </form>
      )}
      {at !== null && sheet && (
        <dialog
          ref={dialog}
          className="id-sheet"
          aria-label={`ID the track at ${where}`}
          onClose={shut}
          onCancel={(e) => {
            e.preventDefault();
            leave();
          }}
          // A press on the page above the sheet lands on the dialog itself, outside its box.
          onClick={(e) => e.target === e.currentTarget && e.clientY < e.currentTarget.getBoundingClientRect().top && leave()}
        >
          <form onSubmit={post} noValidate onTouchEndCapture={tapped}>
            {/* Cancel, what the sheet is for, and Post, in the one row the keyboard never covers. */}
            <div className="id-sheet-bar mb-1 flex h-14 items-center gap-1">
              {/* The cross is drawn 12px wide in a 44px place to press: pulled left by the 16px between them,
                  so its edge is the edge the blanks start on. */}
              <button type="button" onClick={leave} aria-label="Cancel" className="track-ids-shut -ml-4">
                {cross}
              </button>
              <p className="id-sheet-label min-w-0 flex-1 truncate">
                ID this track <span className="id-sheet-where">{where}</span>
              </p>
              <button type="submit" aria-disabled={sending} className="poster-btn id-sheet-post">
                {posting}
              </button>
            </div>
            {/* What can be answered with one press comes before what needs typing. */}
            {offers.length > 0 && (
              <div role="group" aria-label={from} className="mb-3">
                <p className="id-sheet-label" aria-hidden>
                  {from}
                </p>
                {offers.map((offer) => (
                  <button key={offer.n} type="button" onClick={() => take(offer)} className="id-sheet-offer">
                    <span>{offer.n}</span>
                    {offer.artist} — {offer.title}
                  </button>
                ))}
              </div>
            )}
            {/* A phone's keyboard would put "Altern 8" right and offer words for "Orbital": neither helps. The
                blanks stand a little apart, so each reads as a line of its own. */}
            <div className="grid gap-2">
              <input ref={artistField} value={artist} onChange={typed(setArtist)} onKeyDown={onward(titleField)} placeholder="Artist" aria-label="Artist" aria-describedby={message ? messageId : undefined} autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" className="track-ids-field" />
              <input ref={titleField} value={title} onChange={typed(setTitle)} onKeyDown={askName && !name.trim() ? onward(nameField) : undefined} placeholder="Title" aria-label="Title" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint={askName && !name.trim() ? 'next' : 'send'} className="track-ids-field" />
              {askName && (
                <input ref={nameField} value={name} onChange={typed(setName)} placeholder="Your name" aria-label="Your name" aria-describedby={message ? messageId : undefined} autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} maxLength={100} enterKeyHint="send" className="track-ids-field" />
              )}
            </div>
            {!askName && (
              <p className="id-sheet-label mt-2 flex min-h-11 items-center">
                Posting as <span className="id-sheet-where">{name}</span>
                <button type="button" onClick={wantName} className="track-ids-post ml-auto">
                  Change
                </button>
              </p>
            )}
            {upkeep && <div className="flex flex-wrap justify-between gap-x-6">{upkeep}</div>}
            {complaint}
          </form>
        </dialog>
      )}
      {tray &&
        createPortal(
          <div className="player-tray" role="group" aria-label="Now playing">
            {/* Two lines, always: artist over title, as on a record's label, with where the tape is beside
                them. Each keeps its height when it has nothing to say, so the buttons under them never move. */}
            <p className="player-tray-line">
              <span className="min-w-0 flex-1 truncate">{playing ? (playing.known ? playing.artist || playing.title : 'Unknown track') : 'Nothing ID’d here yet'}</span>
              <span className="flex-none font-mono text-xs font-normal tabular-nums text-[var(--muted)]">{idPlace(position, time)}</span>
            </p>
            <p className="player-tray-line player-tray-sub">
              <span className="min-w-0 flex-1 truncate">{playing ? (playing.known ? (playing.artist ? playing.title : '') : unposted ? 'Marked by you' : 'Nobody has ID’d it yet') : 'Know this track? ID it.'}</span>
              {unposted && <span className="track-ids-state flex-none">Not posted</span>}
            </p>
            <div className="player-tray-row">
              <button type="button" onClick={onToggle} className="player-tray-btn player-tray-primary" aria-label={isPlaying ? 'Pause' : 'Play'}>
                <svg className="h-3.5 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
                  <path d={isPlaying ? 'M0 0h4v14H0zM8 0h4v14H8z' : 'M0 0v14l11-7z'} />
                </svg>
              </button>
              <button ref={trayId} type="button" onClick={open} className="player-tray-btn">
                {playing?.known ? 'Fix ID' : 'ID it'}
              </button>
              {/* Marked as unavailable, not taken away, in a track's first moments: it keeps its place. */}
              <button type="button" onClick={markHere} aria-disabled={!free} className="player-tray-btn" aria-label="New unknown: a track starts here, and you don’t know what it is">
                New unknown
              </button>
            </div>
          </div>,
          document.body,
        )}
      {/* Always here, so a screen reader hears the thanks arrive. */}
      <p role="status" className="sr-only">
        {thanks}
      </p>
    </div>
  );
}
