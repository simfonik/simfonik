'use client';

import { FormEvent, RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHONE, useOnPhone } from '../hooks/useMedia';
import { hasLink, idLabel, idPlace } from '../lib/track-ids/compose';
import { sameRecord } from '../lib/track-ids/moments';
import { rememberedName } from '../lib/track-ids/post';
import { asListed, canStartAt, isUnposted, playingAt, saidBy, startingAt, suggest, type Change, type Row } from '../lib/track-ids/side';
import { formatTime, parseTime, typeTime } from '../lib/time-utils';
import { usePlayhead, useSide, useTapeTrackIds } from './TapeTrackIds';

/** The most an artist or a title may run to, in characters: far past any real one, and a comment line stays a line. */
const NAME_LENGTH = 150;

/** What the blanks are about to do: post what is in them, take the mark away, or mark the moment with no name. */
type Act = 'id' | 'remove' | 'mark';

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

/** The blanks a visitor can be sent back to. */
type Blank = 'time' | 'artist' | 'name';

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
 * moment. A name already there is pressed to put it right, and a mark can be taken away; both are posts like
 * any other. The time in the blanks is a blank too: typed over, or given the tape's time with "Use", the
 * track is moved there with the same Post, wherever a track could start.
 *
 * A track that isn't the one playing is reached from its row in the tracklist, and with a mouse its blanks
 * open in that row, where the visitor is looking, and the tape is left where it is.
 *
 * Beside the line is "New track": a track starts here, whatever is playing. With a mouse it opens the blanks
 * for this moment, to say which track; under them is "Mark unknown", which says only that one starts, so a
 * visitor can set the points and leave the names to whoever knows them. It is not there on the second a
 * track starts: one moment, one track. A mark with no name is the visitor's own until they post what they
 * have (the tracklist keeps the count and the Post), and until then it is taken back, or ID'd, like any
 * other mark.
 *
 * On a phone the line has no room for a track's name and the words beside it, and it is at the top of a long
 * page. There, once the tape has been played, all of it is in a tray at the foot of the screen instead: the
 * name on two lines, then play, the ID and "New track", each always in its place so none moves under a
 * thumb. There "New track" marks the point in one press, with no name: a tape is gone through by ear with a
 * thumb, and the track is ID'd after.
 *
 * Where the side has a list of its tracks, the two lines of it likeliest to be the track being ID'd are
 * offered, and pressing one writes it into the blanks.
 */
export function TrackIds({ side, position, time, isPlaying, onToggle, length = null }: Props) {
  const { rows, order, length: end } = useSide(side);
  const { read, say, unsay, post: send, asked, answered, editing, setEditing, slot } = useTapeTrackIds();
  const played = usePlayhead((head) => head.started);
  const now = Math.floor(time);
  const playing = rows[playingAt(rows, time)] ?? null;
  // A track could start at this moment: the tape has been played, the comments are back (what is said is
  // said on top of them), nothing starts on this second, and the side has room left for a track.
  const free = played && read !== 'reading' && canStartAt(rows, now, end);
  // With nothing playing and no room left on the side for a track to start, there is nothing to ID.
  const nothing = playing === null && !canStartAt(rows, now, end);
  // The blanks are for one moment of the tape, fixed when they open, while the tape plays on underneath.
  const [at, setAt] = useState<number | null>(null);
  // The mark the blanks are for, where the side has one at that moment: as the side has it now, which may
  // not be as it was when the blanks opened (the visitor may have posted it since, or the comments changed).
  // Or they are for a line of the list still waiting for its time, by its number there: no moment yet, and
  // no mark. Given a time, the line waits to be posted with the visitor's other times, as after a + on its row.
  const [lineNo, setLineNo] = useState<number | null>(null);
  const waiting = lineNo === null ? null : (rows.find((row) => row.n === lineNo && row.start === null) ?? null);
  const mark = at === null || lineNo !== null ? null : (rows[startingAt(rows, at)] ?? null);
  const [doing, setDoing] = useState<Act>('id');
  const [sheet, setSheet] = useState(false);
  // The visitor's name is asked for the first time only. The line has room for one thing at a time, so it
  // asks as a second step; the sheet has a row for it from the start.
  const [askName, setAskName] = useState(false);
  // Counts each time the name is asked for after the blanks are open, so the keyboard can go to it.
  const [nameWanted, setNameWanted] = useState(0);
  const [offers, setOffers] = useState<Row[]>([]);
  // The time as it stands in its blank, which the visitor may type over.
  const [when, setWhen] = useState('');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  // Counts each time the blanks are opened, for a track or for another while they are open, so the keyboard
  // goes into them every time.
  const [opened, setOpened] = useState(0);
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  // While the sheet is up the rest of the page is out of a screen reader's hearing, the line that says the
  // thanks with it, and words that change there are never read out. So thanks owed from the sheet are said
  // once it has gone.
  const owed = useRef('');
  // The blank a refusal is about, so that it alone is marked as wrong and has the words read with it.
  const [wrong, setWrong] = useState<Blank | null>(null);
  const line = useRef<HTMLButtonElement>(null);
  const trayId = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timeField = useRef<HTMLInputElement>(null);
  const artistField = useRef<HTMLInputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();
  // Whether the blanks were opened from a row of the tracklist, and not from the line or the tray.
  const fromRow = useRef(false);

  // `start` is the moment the blanks are for; null with `marked` a line of the list that has no time yet.
  const begin = (marked: Row | null, start: number | null, inRow = false) => {
    const onPhone = window.matchMedia(PHONE).matches;
    const remembered = rememberedName();
    const untimed = start === null ? (marked?.n ?? null) : null;
    setOpened((count) => count + 1);
    fromRow.current = inRow;
    setAt(start ?? now);
    setLineNo(untimed);
    setWhen(start === null ? '' : formatTime(start));
    setEditing(inRow && !onPhone ? { position, time: start, n: untimed } : null);
    setDoing('id');
    setArtist(marked?.known ? marked.artist : '');
    setTitle(marked?.known ? marked.title : '');
    setOffers(marked?.known || start === null ? [] : suggest(rows, start, length));
    setName(remembered);
    setSheet(onPhone);
    // A time that waits to be posted needs no name yet: the bar that posts it asks.
    setAskName(onPhone && !remembered && start !== null);
    setNameWanted(0);
    setStatus('idle');
    setMessage('');
    setWrong(null);
    setThanks('');
    owed.current = '';
  };
  // An ID is for the track playing. Where the side has one marked, it goes to where that track starts: a
  // correction then replaces the older word, and an ID for a track marked unknown fills the whole of it and
  // doesn't split it at the moment the visitor happened to speak up. With nothing playing it goes to this
  // moment.
  const open = () => {
    if (nothing) return;
    begin(playing, playing?.start ?? now);
  };
  /** "New track", with a mouse: a track starts here, whatever is playing, and the blanks open to say which. */
  const openNew = () => begin(null, now);
  const markHere = () => {
    if (!free) return;
    say({ side, time: now, artist: '', title: '' });
    setThanks(`Marked ${idPlace(position, now)}. Not posted yet.`);
  };
  // The tracklist asks for one of its rows. On a tape with sides the blanks belong to the side loaded, so a
  // row on another side is answered once the player has loaded that side; and they open on the side's rows
  // and the tape's place as they are when the asking is heard.
  const answer = useRef<(row: { time: number | null; n: number | null }) => void>(() => {});
  useEffect(() => {
    answer.current = ({ time: start, n }) => {
      if (start !== null) return begin(rows.find((row) => row.start === start) ?? null, start, true);
      const line = rows.find((row) => row.n === n && row.start === null);
      if (line) begin(line, null, true);
    };
  });
  useEffect(() => {
    if (!asked || asked.position !== position) return;
    answered();
    answer.current(asked);
  }, [asked, position, answered]);
  const shut = () => {
    setAt(null);
    setLineNo(null);
    setEditing(null);
  };
  // Blanks open in a row go when the row does (the comments, read again, may no longer have the track), and
  // blanks for a line waiting for its time go when it has one.
  const rowGone = at !== null && ((lineNo !== null && !waiting) || (editing !== null && editing.time !== null && !rows.some((row) => row.start === editing.time)));
  useEffect(() => {
    if (rowGone) shut();
  });
  useEffect(() => () => setEditing(null), [setEditing]);
  // The sheet goes back down the way it came up; the blanks in the line just go.
  const leave = () => (sheet && dialog.current ? dismiss(dialog.current) : shut());
  const thank = (text: string) => {
    if (sheet && dialog.current?.open) owed.current = text;
    else setThanks(text);
  };
  // However the sheet went: sent down, or gone with the line it was for.
  useEffect(() => {
    if (at !== null || !owed.current) return;
    setThanks(owed.current);
    owed.current = '';
  }, [at]);

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
  const taken = useRef(0);
  useEffect(() => {
    if (at === null) {
      // Opened from a row, the keyboard goes back to the row (the tracklist sees to it, or on a phone the
      // sheet does as it closes), not up the page to the line.
      if (wasOpen.current && !fromRow.current) (trayId.current ?? line.current)?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    // In a row the blanks are there once the row has made its place for them. (Opened for one row while
    // open in another, they are for a moment still in the old row's place, which has left the page.)
    if (editing && !slot?.isConnected) return;
    if (taken.current === opened) return;
    taken.current = opened;
    // A line waiting for its time is first of all given one.
    focus((lineNo !== null ? timeField : artistField).current, sheet);
  }, [at, sheet, editing, slot, lineNo, opened]);
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
    setWrong(null);
  };
  // The keyboard goes to the blank to put right. A post that failed is no blank's fault: it goes to one all
  // the same, to try again from, and none is marked.
  const refuse = (text: string, blank: Blank, itsFault = true) => {
    setStatus('error');
    setMessage(text);
    setWrong(itsFault ? blank : null);
    focus({ time: timeField, artist: artistField, name: nameField }[blank].current, sheet);
  };
  const told = (blank: Blank) => ({ 'aria-invalid': wrong === blank || undefined, 'aria-describedby': wrong === blank ? messageId : undefined });
  const typed = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    settle();
  };
  // A time is typed as its figures alone, which come in from the right (5, 0, 0 for 0:05:00: typeTime), so a
  // phone's number keys are all it needs. The time the blank already has is selected as the keyboard comes
  // to it, and the first figure takes its place. A tap puts the cursor where it landed just after the blank
  // takes focus, which would undo the selection, so it is made a frame later.
  const typedTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false;
    setWhen(typeTime(e.target.value, when, deleting));
    settle();
  };
  const selectTime = (e: React.FocusEvent<HTMLInputElement>) => {
    const field = e.currentTarget;
    requestAnimationFrame(() => {
      if (document.activeElement === field) field.setSelectionRange(0, field.value.length);
    });
  };
  // In the time's blank the up and down arrows move it a second at a time, ten with Shift held.
  const nudge = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const by = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    const time = parseTime(when);
    if (!by || time === null) return;
    e.preventDefault();
    setWhen(formatTime(Math.max(0, time + by * (e.shiftKey ? 10 : 1))));
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
    // The visitor's own unposted mark is theirs to take back or move: nothing was said, so nothing is posted.
    const own = mark?.mine && !mark.mine.sent ? mark.mine : null;
    if (what === 'remove' && own) {
      unsay(own);
      thank('Taken back.');
      return leave();
    }
    // Where the track is to start is the time in its blank. A time other than the one it has must be one a
    // track could start at with this one set aside.
    let to = at;
    if (what !== 'remove') {
      const entered = parseTime(when);
      if (entered === null) return refuse(when ? 'Minutes and seconds only go up to 59.' : 'Enter the time, like 500 for 0:05:00.', 'time');
      const unchanged = lineNo === null && entered === at;
      const others = rows.filter((row) => row !== mark);
      const taken = others[startingAt(others, entered)];
      if (!unchanged && taken) return refuse(`Another track starts at ${formatTime(taken.start as number)}.`, 'time');
      if (!unchanged && !canStartAt(others, entered, end)) return refuse('That is past where a track could start on this side.', 'time');
      to = entered;
    }
    // An ID is an artist and a title, and no place for a web address: the site takes none (the route says so too).
    if (what === 'id' && hasLink(`${artist} ${title}`)) return refuse('Track IDs can’t include links.', 'artist');
    // "Mark unknown": only that a track starts there. It is the visitor's own, and waits to be posted.
    if (what === 'mark') {
      say({ side, time: to, artist: '', title: '' });
      thank(`Marked ${idPlace(position, to)}. Not posted yet.`);
      return leave();
    }
    // One track can't follow itself: named again where it is already playing, or just before where it
    // starts, it is taken as the one play (`settle`), and the ID would show nowhere. So it is not taken.
    if (what === 'id' && (artist.trim() || title.trim())) {
      const others = rows.filter((row) => row !== mark && row.start !== null);
      const twin = [others.findLast((row) => (row.start as number) < to), others.find((row) => (row.start as number) > to)].find((row) => row?.known && sameRecord(row, { artist, title }));
      if (twin) return refuse(`That track is already here, at ${formatTime(twin.start as number)}. One track can’t play twice in a row.`, 'artist');
    }
    // The list's own words for the track, where the names in the blanks are not the list's: the ID says
    // which line it is, and the line stays that line under its new name (compose.ts).
    const listed = (waiting ?? mark)?.line;
    const line = listed && (artist.trim() || title.trim()) && !asListed({ artist, title }, listed) ? { line: listed } : {};
    // A line of the list given its time by hand is said as a + on its row says it, and waits to be posted.
    if (lineNo !== null) {
      if (waiting?.known && !artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', 'artist');
      say({ side, time: to, artist, title, ...line });
      thank(`Added at ${idPlace(position, to)}. Not posted yet.`);
      return leave();
    }
    const moved = mark !== null && to !== at;
    const renamed = artist.trim() !== (mark?.known ? mark.artist : '') || title.trim() !== (mark?.known ? mark.title : '');
    // Moved and nothing more, the visitor's own is said again at the new moment, and waits to be posted as it did.
    if (own && moved && !renamed) {
      unsay(own);
      say({ side, time: to, artist, title, ...line });
      thank(`Moved to ${idPlace(position, to)}. Not posted yet.`);
      return leave();
    }
    // Only an ID needs a name: a mark is taken away or moved as it is, named or not.
    if (what === 'id' && !moved && !artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', 'artist');
    if (!name.trim()) {
      if (askName) return refuse('Enter your name.', 'name');
      // The line asks for the name as a step of its own, and the step ends in what was being done.
      setDoing(what);
      return wantName();
    }
    // Taking a mark away is one line; moving it is that line and the ID at its new place, in one post.
    const gone: Change[] = mark && !own && (what === 'remove' || moved) ? [{ side, time: mark.start as number, artist: '', title: '', gone: true }] : [];
    const id: Change[] = what === 'remove' ? [] : [{ side, time: to, artist, title, ...line }];

    setStatus('sending');
    setMessage('');
    setWrong(null);
    const failed = await send([...gone, ...id], name);
    // In the line the name, once asked for, is the only blank there is.
    if (failed) return refuse(failed, askName && !sheet ? 'name' : 'artist', false);
    // The visitor's own mark, named and moved in one go, has been posted where it went: it no longer waits where it was.
    if (own && moved) unsay(own);
    setStatus('idle');
    thank(what === 'remove' ? 'Removed.' : moved ? 'Moved. Thanks.' : 'Posted. Thanks.');
    leave();
  }
  const post = (e: FormEvent) => {
    e.preventDefault();
    act(doing);
  };

  const where = idPlace(position, at ?? 0);
  // What the blanks are, said to a screen reader: for a moment of the tape, or for a line still to be timed.
  const purpose = lineNo !== null ? `The time track ${lineNo} starts` : `ID the track at ${where}`;
  const sending = status === 'sending';
  const from = order?.by ? `From ${order.by}’s list` : 'From the tape’s tracklist';
  const posting = (
    <span className="grid place-items-center">
      <span className={`col-start-1 row-start-1 ${sending ? 'invisible' : ''}`}>{lineNo !== null ? 'Add' : doing === 'remove' ? 'Remove' : 'Post'}</span>
      <span className={`col-start-1 row-start-1 ${sending ? '' : 'invisible'}`}>…</span>
    </span>
  );
  // What can be done with a mark already on the tape besides putting its name right.
  // The visitor's own unposted mark is taken back, as on its row in the tracklist, and nothing is posted. Any
  // other is taken away with a post.
  // And under the blanks for a moment with nothing marked, the way to mark it without a name.
  const upkeep = mark ? (
    <button type="button" onClick={() => act('remove')} aria-disabled={sending} className="track-ids-post">
      {isUnposted(mark) ? 'Undo' : mark.known ? 'Remove this ID' : 'Remove this mark'}
    </button>
  ) : lineNo === null ? (
    <button type="button" onClick={() => act('mark')} aria-disabled={sending} className="track-ids-post" aria-label="Mark unknown: a track starts here, and you don’t know what it is" title="A track starts here, and you don’t know what it is">
      Mark unknown
    </button>
  ) : null;
  // The time, in the same quiet type as before, and a blank: with the side's label before it where the tape
  // has sides. Beside it, once the tape has been played, is where the tape is now, which follows the tape and
  // is pressed to write that time into the blank: a time found by ear needs no typing. Nothing is posted by
  // it. It is marked as unavailable, and keeps its place, while that is the time the blank already has or
  // one no track could start at with this one set aside.
  const usable = at !== null && formatTime(now) !== when && ((lineNo === null && now === at) || canStartAt(rows.filter((row) => row !== mark), now, end));
  const use = () => {
    if (!usable) return;
    setWhen(formatTime(now));
    settle();
  };
  const timeBlank = (
    <>
      {position !== null && <span className="track-ids-where">{position}</span>}
      <input ref={timeField} value={when} onChange={typedTime} onFocus={selectTime} onKeyDown={nudge} placeholder="0:00:00" aria-label="Starts at" {...told('time')} inputMode="numeric" autoComplete="off" maxLength={9} enterKeyHint="send" className="track-ids-field track-ids-when" />
      {played && !(askName && !sheet) && (
        <button type="button" onClick={use} aria-disabled={!usable} className="track-ids-post track-ids-use" aria-label={`Use ${formatTime(now)}, the tape’s time`} title="Where the tape is now">
          Use {formatTime(now)}
        </button>
      )}
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

  // The blanks, where there is no sheet: in the line's own place, or in the row of the tracklist they were
  // opened from.
  const inRow = editing !== null;
  const blanks = at !== null && !sheet && (
    <form onSubmit={post} noValidate onKeyDown={(e) => e.key === 'Escape' && !e.nativeEvent.isComposing && shut()} aria-label={purpose} className={inRow ? undefined : 'mt-2'}>
      {/* The line itself, with blanks where the names go: the same type in the same place, a rule under
          each blank, and no boxes. */}
      <div className="flex min-h-11 items-center gap-x-3">
        {timeBlank}
        {askName ? (
          <input ref={nameField} value={name} onChange={typed(setName)} placeholder="Your name" aria-label="Your name" {...told('name')} autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} maxLength={100} enterKeyHint="send" className="track-ids-field" />
        ) : (
          <>
            <input ref={artistField} value={artist} onChange={typed(setArtist)} placeholder="Artist" aria-label="Artist" maxLength={NAME_LENGTH} {...told('artist')} autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="send" className="track-ids-field" />
            <span aria-hidden className="text-[var(--muted)]">
              —
            </span>
            <input value={title} onChange={typed(setTitle)} placeholder="Title" aria-label="Title" maxLength={NAME_LENGTH} autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="send" className="track-ids-field" />
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
      {upkeep && !askName && <div className="flex">{upkeep}</div>}
      {complaint}
    </form>
  );

  return (
    <div className="track-ids">
      {at === null || sheet || inRow ? (
        // As tall as the blanks that take its place, so nothing below moves when they do. Under the sheet it
        // stays as it was.
        <div className="track-ids-row mt-2 flex min-h-11 items-center gap-x-3">
          {playing?.known ? (
            <button ref={line} type="button" onClick={open} className="track-ids-line text-[var(--text)]" aria-label={`Now playing: ${idLabel(playing)}. Correct this ID`} title={`${saidBy(playing)}. Press to correct it.`}>
              {idLabel(playing)}
            </button>
          ) : (
            <button ref={line} type="button" onClick={open} aria-disabled={nothing} className="track-ids-line text-[var(--muted)]">
              {playing ? 'Unknown track. Know it?' : 'Know this track?'} <span className="track-ids-cue">ID it</span>
            </button>
          )}
          {unposted && <span className="track-ids-state">Pending</span>}
          {/* Not on the second a track starts: what is said there is said of that track. */}
          {free && (
            <button type="button" onClick={openNew} className="track-ids-post" aria-label="New track: a track starts here" title="A track starts here">
              New track
            </button>
          )}
        </div>
      ) : (
        blanks
      )}
      {inRow && slot && createPortal(blanks, slot)}
      {at !== null && sheet && (
        <dialog
          ref={dialog}
          className="id-sheet"
          aria-label={purpose}
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
                {lineNo !== null ? 'Time this track' : 'ID this track'}
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
              <div className="id-sheet-label flex items-center gap-3">
                <span aria-hidden>Starts at</span>
                {timeBlank}
              </div>
              <input ref={artistField} value={artist} onChange={typed(setArtist)} onKeyDown={onward(titleField)} placeholder="Artist" aria-label="Artist" maxLength={NAME_LENGTH} {...told('artist')} autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" className="track-ids-field" />
              <input ref={titleField} value={title} onChange={typed(setTitle)} onKeyDown={askName && !name.trim() ? onward(nameField) : undefined} placeholder="Title" aria-label="Title" maxLength={NAME_LENGTH} autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint={askName && !name.trim() ? 'next' : 'send'} className="track-ids-field" />
              {askName && (
                <input ref={nameField} value={name} onChange={typed(setName)} placeholder="Your name" aria-label="Your name" {...told('name')} autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} maxLength={100} enterKeyHint="send" className="track-ids-field" />
              )}
            </div>
            {!askName && lineNo === null && (
              <p className="id-sheet-label mt-2 flex min-h-11 items-center">
                Posting as <span className="id-sheet-where">{name}</span>
                <button type="button" onClick={wantName} className="track-ids-post ml-auto">
                  Change
                </button>
              </p>
            )}
            {upkeep && <div className="flex justify-end">{upkeep}</div>}
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
              {unposted && <span className="track-ids-state flex-none">Pending</span>}
            </p>
            <div className="player-tray-row">
              <button type="button" onClick={onToggle} className="player-tray-btn player-tray-primary" aria-label={isPlaying ? 'Pause' : 'Play'}>
                <svg className="h-3.5 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
                  <path d={isPlaying ? 'M0 0h4v14H0zM8 0h4v14H8z' : 'M0 0v14l11-7z'} />
                </svg>
              </button>
              <button ref={trayId} type="button" onClick={open} aria-disabled={nothing} className="player-tray-btn">
                {playing?.known ? 'Edit ID' : 'ID it'}
              </button>
              {/* Marked as unavailable, not taken away, in a track's first moments: it keeps its place. */}
              <button type="button" onClick={markHere} aria-disabled={!free} className="player-tray-btn" aria-label="New track: a track starts here">
                New track
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
