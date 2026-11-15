'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { clock, composeId, idAt, idLabel, type TrackId } from '../lib/track-ids/compose';

// A visitor's name is asked for once and offered back the next time, on this device only.
const NAME_KEY = 'simfonik:id-name';
const rememberedName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

type Props = {
  tapeId: string;
  /** The side's label as the site shows it ("A", "1B"), or null on a tape that is one recording. */
  position: string | null;
  /** The IDs the comments give for this side, in order of time. */
  ids: TrackId[];
  /** Where the tape is, in seconds. */
  time: number;
  /** An ID has been posted: the comments have changed and should be read again. */
  onPosted: () => void;
};

/**
 * Under the bar: the track playing now, as the comments have ID'd it, and the way to ID one. An ID is an
 * ordinary comment that carries the side and the time (see lib/track-ids/compose.ts), posted through the same
 * route as any comment. Nothing is kept anywhere else.
 */
export function TrackIds({ tapeId, position, ids, time, onPosted }: Props) {
  const playing = idAt(ids, time);
  // The form is for one moment of the tape, fixed when it opens, while the tape plays on underneath.
  const [at, setAt] = useState<number | null>(null);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const openButton = useRef<HTMLButtonElement>(null);
  const artistField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();

  const open = () => {
    // Putting a known ID right goes to where that track starts, so the newer word replaces the older one.
    setAt(playing?.known ? playing.start : Math.floor(time));
    setName(rememberedName());
    setStatus('idle');
    setMessage('');
    setThanks('');
  };
  const shut = () => setAt(null);
  // The keyboard goes into the form as it opens, and back to the button that opened it as it shuts.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (at !== null) artistField.current?.focus();
    else if (wasOpen.current) openButton.current?.focus();
    wasOpen.current = at !== null;
  }, [at]);

  const refuse = (text: string, field: HTMLInputElement | null) => {
    setStatus('error');
    setMessage(text);
    field?.focus();
  };

  async function post(e: FormEvent) {
    e.preventDefault();
    if (status === 'sending' || at === null) return;
    if (!artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', artistField.current);
    if (!name.trim()) return refuse('Enter your name.', nameField.current);

    setStatus('sending');
    setMessage('');
    try {
      const response = await fetch('/api/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tapeId, authorName: name.trim(), authorEmail: '', content: composeId({ position, time: at, artist, title }), website: '' }),
      });
      const data = await response.json();
      if (!response.ok) return refuse(data.error || 'That didn’t post. Please try again.', artistField.current);
    } catch {
      return refuse('That didn’t post. Please try again.', artistField.current);
    }

    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Storage is off in this browser: the name is asked for again next time.
    }
    setArtist('');
    setTitle('');
    setStatus('idle');
    setThanks('Posted. Thanks.');
    onPosted();
    shut();
  }

  const fieldClasses =
    'text-field font-mono h-11 w-full min-w-0 border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)]';
  const where = `${position ? `Side ${position} · ` : ''}${clock(at ?? 0)}`;

  return (
    <div className="track-ids mt-3">
      {at === null ? (
        <>
          {/* The track on a line of its own, cut short if it is long. `contain` keeps a long name from
              widening the page: the line takes its width from the player, never the other way round. */}
          <p className="truncate font-mono text-[12px] text-[var(--muted)] [contain:inline-size]">
            {playing ? <span className={playing.known ? 'text-[var(--text)]' : undefined}>{idLabel(playing)}</span> : 'No ID here yet'}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] [contain:inline-size] flex-1">
              {playing ? `${playing.known ? 'ID' : 'Marked'} by ${playing.by}` : '\u00A0'}
            </p>
            <button ref={openButton} type="button" onClick={open} className="track-ids-open">
              {playing?.known ? 'Correct this ID' : 'ID this track'}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={post} noValidate onKeyDown={(e) => e.key === 'Escape' && shut()} aria-label={`ID the track at ${where}`}>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {playing?.known ? 'Correct the ID at' : 'ID the track at'} <span className="tabular-nums text-[var(--text)]">{where}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input ref={artistField} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" aria-label="Artist" aria-describedby={message ? messageId : undefined} autoComplete="off" className={fieldClasses} />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" autoComplete="off" className={fieldClasses} />
            <input ref={nameField} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" autoComplete="name" maxLength={100} className={fieldClasses} />
            <div className="flex items-stretch gap-3">
              <button type="submit" aria-disabled={status === 'sending'} className="poster-btn h-11 flex-1 whitespace-nowrap">
                <span className="grid place-items-center">
                  <span className={`col-start-1 row-start-1 ${status === 'sending' ? 'invisible' : ''}`}>Post ID</span>
                  <span className={`col-start-1 row-start-1 ${status === 'sending' ? '' : 'invisible'}`}>Posting…</span>
                </span>
              </button>
              <button type="button" onClick={shut} className="track-ids-open">
                Cancel
              </button>
            </div>
          </div>
          <p id={messageId} role="alert" className="mt-3 min-h-4 font-mono text-[10px] uppercase leading-4 tracking-[0.22em] text-pretty text-red-500">
            {message}
          </p>
        </form>
      )}
      {/* Always here, so a screen reader hears the thanks arrive. */}
      <p role="status" className="sr-only">
        {thanks}
      </p>
    </div>
  );
}
