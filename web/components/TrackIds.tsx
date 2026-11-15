'use client';

import { FormEvent, RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { composeId, composeRemoval, idAt, idLabel, idPlace, ONE_MOMENT, type ListedTrack, type RunningOrder, type TrackId } from '../lib/track-ids/compose';
import { suggest } from '../lib/track-ids/names';
import { postIds, rememberedName } from '../lib/track-ids/post';
import { formatTime } from '../lib/time-utils';
import { useTapeTrackIds } from './TapeTrackIds';

/** What the blanks are about to do: post the ID in them, take the mark away, or move it to where the tape is. */
type Act = 'id' | 'remove' | 'move';

/** A screen as narrow as a phone's. There the blanks are a sheet over the page, with a row each. */
const PHONE = '(max-width: 39.99rem)';

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
  tapeId: string;
  /** The side's label as the site shows it ("A", "1B"), or null on a tape that is one recording. */
  position: string | null;
  /** The IDs the comments give for this side, in order of time. */
  ids: TrackId[];
  /** Where the tape is, in seconds. */
  time: number;
  /** The side's tracks in order, where a list gives them without times: likely names are offered from it. */
  order?: RunningOrder | null;
  /** The side's length in seconds, where it is known. */
  length?: number | null;
  /** An ID has been posted: the comments have changed and should be read again. */
  onPosted: () => void;
};

/**
 * One line under the bar. It says the track playing now, as the comments have ID'd it; where they haven't, it
 * asks. Pressed, it takes an ID: with a mouse the line becomes two blanks in its own place; on a phone a sheet
 * rises over the page and stays on top of the keyboard. What is typed is posted as an ordinary comment that
 * carries the side and the time (see lib/track-ids/compose.ts), through the same route as any comment. A name
 * already there can be pressed to put it right, and beside it is the way to say that a new track has started:
 * an ID runs until the next one, so without that a side with one ID could never be given a second. Nothing is
 * kept anywhere else.
 *
 * A mark already on the tape can also be taken away, or moved to where the tape is now if it was made too
 * early. Both are posts like any other: a line that says no track starts there, which the reader lets
 * outweigh what was said of that moment before. The tracklist, down the page, can ask for the blanks to
 * open for one of its lines.
 *
 * Where the side has a list of its tracks with no times, the two lines of it likeliest to be this track are
 * offered, and pressing one writes it into the blanks.
 */
export function TrackIds({ tapeId, position, ids, time, order = null, length = null, onPosted }: Props) {
  const playing = idAt(ids, time);
  // The blanks are for one moment of the tape, fixed when they open, while the tape plays on underneath.
  const [at, setAt] = useState<number | null>(null);
  // The mark the blanks are for, where the tape already has one at that moment.
  const [mark, setMark] = useState<TrackId | null>(null);
  // Where the tape was when the blanks opened, if the mark could be moved there: later than it, and in it.
  const [later, setLater] = useState<number | null>(null);
  const [act, setAct] = useState<Act>('id');
  const [sheet, setSheet] = useState(false);
  // The visitor's name is asked for the first time only. The line has room for one thing at a time, so it
  // asks as a second step; the sheet has a row for it from the start.
  const [askName, setAskName] = useState(false);
  // Counts each time the name is asked for after the blanks are open, so the keyboard can go to it.
  const [nameWanted, setNameWanted] = useState(0);
  const [offers, setOffers] = useState<ListedTrack[]>([]);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const line = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const artistField = useRef<HTMLInputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();

  const begin = (marked: TrackId | null, start: number) => {
    const onPhone = window.matchMedia(PHONE).matches;
    const remembered = rememberedName();
    const now = Math.floor(time);
    setAt(start);
    setMark(marked);
    // A mark made too early can be moved to here: the tape is in that track, well past where it is marked,
    // and nothing else starts at this moment.
    setLater(marked && marked === playing && now - marked.start > ONE_MOMENT && !ids.some((id) => id !== marked && Math.abs(id.start - now) <= ONE_MOMENT) ? now : null);
    setAct('id');
    setArtist(marked?.known ? marked.artist : '');
    setTitle(marked?.known ? marked.title : '');
    setOffers(order && !marked?.known ? suggest(start, order.tracks, ids, length) : []);
    setName(remembered);
    setSheet(onPhone);
    setAskName(onPhone && !remembered);
    setNameWanted(0);
    setStatus('idle');
    setMessage('');
    setThanks('');
  };
  // An ID is for the track playing. Where the comments have marked one, it goes to where that track starts:
  // a correction then replaces the older word, and an ID for a track marked unknown fills the whole of it
  // and doesn't split it at the moment the visitor happened to speak up. Putting a known ID right starts
  // from what it says. Where nothing is marked, or the visitor says a new track has started, the ID goes to
  // this moment.
  const open = (fresh: boolean) => {
    const marked = fresh ? null : playing;
    begin(marked, marked ? marked.start : Math.floor(time));
  };
  // The tracklist asks for one of its lines. On a tape with sides the blanks belong to the side loaded, so a
  // line on another side is answered once the player has loaded that side.
  const { asked, answered } = useTapeTrackIds();
  // The blanks open on the side's IDs and the tape's place as they are when the asking is heard.
  const answer = useRef<(time: number) => void>(() => {});
  useEffect(() => {
    answer.current = (start) => begin(ids.find((id) => id.start === start) ?? null, start);
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
      if (wasOpen.current) line.current?.focus();
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
  const take = (offer: ListedTrack) => {
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

  async function send(what: Act) {
    if (status === 'sending' || at === null) return;
    // Only an ID needs a name: a mark is taken away or moved as it is, named or not.
    if (what === 'id' && !artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', artistField.current);
    if (!name.trim()) {
      if (askName) return refuse('Enter your name.', nameField.current);
      // The line asks for the name as a step of its own, and the step ends in what was being done.
      setAct(what);
      return wantName();
    }
    // Taking a mark away is one line; moving it is that line and the ID at its new place, in one post.
    const gone = mark && what !== 'id' ? [composeRemoval({ position, time: mark.start })] : [];
    const id = what === 'remove' ? [] : [composeId({ position, time: what === 'move' && later !== null ? later : at, artist, title })];

    setStatus('sending');
    setMessage('');
    const failed = await postIds(tapeId, name, [...gone, ...id].join('\n'));
    // In the line the name, once asked for, is the only blank there is.
    if (failed) return refuse(failed, askName && !sheet ? nameField.current : artistField.current);
    setStatus('idle');
    setThanks(what === 'remove' ? 'Removed.' : what === 'move' ? 'Moved. Thanks.' : 'Posted. Thanks.');
    onPosted();
    leave();
  }
  const post = (e: FormEvent) => {
    e.preventDefault();
    send(act);
  };

  const where = idPlace(position, at ?? 0);
  const sending = status === 'sending';
  const from = order?.by ? `From ${order.by}’s list` : 'From the tape’s tracklist';
  const posting = (
    <span className="grid place-items-center">
      <span className={`col-start-1 row-start-1 ${sending ? 'invisible' : ''}`}>{act === 'remove' ? 'Remove' : act === 'move' ? 'Move' : 'Post'}</span>
      <span className={`col-start-1 row-start-1 ${sending ? '' : 'invisible'}`}>…</span>
    </span>
  );
  // What can be done with a mark already on the tape besides putting its name right.
  const upkeep = mark && (
    <>
      {later !== null && (
        <button type="button" onClick={() => send('move')} aria-disabled={sending} className="track-ids-post">
          Starts at {formatTime(later)} instead
        </button>
      )}
      <button type="button" onClick={() => send('remove')} aria-disabled={sending} className="track-ids-post">
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

  return (
    <div className="track-ids mt-2">
      {at === null || sheet ? (
        // As tall as the blanks that take its place, so nothing below moves when they do. Under the sheet it
        // stays as it was.
        <div className="flex min-h-11 items-center gap-x-3">
          {playing?.known ? (
            <>
              <button
                ref={line}
                type="button"
                onClick={() => open(false)}
                className="track-ids-line text-[var(--text)]"
                aria-label={`Now playing: ${idLabel(playing)}. Correct this ID`}
                title={`ID by ${playing.by}. Press to correct it.`}
              >
                {idLabel(playing)}
              </button>
              {/* Not in the track's first moments: an ID there would be read as this same ID said again. */}
              {time - playing.start > ONE_MOMENT && (
                <button type="button" onClick={() => open(true)} className="track-ids-post" aria-label="A new track starts here. ID it">
                  New track
                </button>
              )}
            </>
          ) : (
            <button ref={line} type="button" onClick={() => open(false)} className="track-ids-line text-[var(--muted)]">
              {playing ? 'Unknown track. Know it?' : 'Know this track?'} <span className="track-ids-cue">ID it</span>
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={post} noValidate onKeyDown={(e) => e.key === 'Escape' && shut()} aria-label={`ID the track at ${where}`}>
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
      {/* Always here, so a screen reader hears the thanks arrive. */}
      <p role="status" className="sr-only">
        {thanks}
      </p>
    </div>
  );
}
