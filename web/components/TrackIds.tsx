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
 * One line under the bar. It says the track playing now, as the comments have ID'd it; where they haven't, it
 * asks. Pressed, the line becomes two fields in its own place, and Enter posts what was typed as an ordinary
 * comment that carries the side and the time (see lib/track-ids/compose.ts), through the same route as any
 * comment. A name already there can be pressed to put it right. Nothing is kept anywhere else.
 */
export function TrackIds({ tapeId, position, ids, time, onPosted }: Props) {
  const playing = idAt(ids, time);
  // The fields are for one moment of the tape, fixed when they open, while the tape plays on underneath.
  const [at, setAt] = useState<number | null>(null);
  // The visitor's name is asked for the first time only, as a second step in the same line.
  const [step, setStep] = useState<'track' | 'name'>('track');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [thanks, setThanks] = useState('');
  const line = useRef<HTMLButtonElement>(null);
  const artistField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const messageId = useId();

  const open = () => {
    // Putting a known ID right starts from what it says and goes to where that track starts, so the newer
    // word replaces the older one.
    setAt(playing?.known ? playing.start : Math.floor(time));
    setArtist(playing?.known ? playing.artist : '');
    setTitle(playing?.known ? playing.title : '');
    setName(rememberedName());
    setStep('track');
    setStatus('idle');
    setMessage('');
    setThanks('');
  };
  const shut = () => setAt(null);

  // The keyboard follows: into the fields as they open, on to the name when it is asked for, and back to the
  // line when they shut.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (at === null) {
      if (wasOpen.current) line.current?.focus();
    } else if (step === 'name') nameField.current?.focus();
    else artistField.current?.focus();
    wasOpen.current = at !== null;
  }, [at, step]);

  const refuse = (text: string, field: HTMLInputElement | null) => {
    setStatus('error');
    setMessage(text);
    field?.focus();
  };
  const typed = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    if (status === 'error') {
      setStatus('idle');
      setMessage('');
    }
  };

  async function post(e: FormEvent) {
    e.preventDefault();
    if (status === 'sending' || at === null) return;
    if (!artist.trim() && !title.trim()) return refuse('Enter the artist or the title.', artistField.current);
    if (!name.trim()) {
      if (step === 'name') return refuse('Enter your name.', nameField.current);
      return setStep('name');
    }

    setStatus('sending');
    setMessage('');
    const back = step === 'name' ? nameField.current : artistField.current;
    try {
      const response = await fetch('/api/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tapeId, authorName: name.trim(), authorEmail: '', content: composeId({ position, time: at, artist, title }), website: '' }),
      });
      const data = await response.json();
      if (!response.ok) return refuse(data.error || 'That didn’t post. Please try again.', back);
    } catch {
      return refuse('That didn’t post. Please try again.', back);
    }

    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Storage is off in this browser: the name is asked for again next time.
    }
    setStatus('idle');
    setThanks('Posted. Thanks.');
    onPosted();
    shut();
  }

  const fieldClasses =
    'text-field font-mono h-11 w-full min-w-0 border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)]';
  const where = `${position ? `${position} · ` : ''}${clock(at ?? 0)}`;
  const sending = status === 'sending';

  return (
    <div className="track-ids mt-2">
      {at === null ? (
        // As tall as the fields that take its place, so nothing below moves when they do.
        <div className="flex min-h-11 items-center">
          {playing?.known ? (
            <button
              ref={line}
              type="button"
              onClick={open}
              className="track-ids-line text-[var(--text)]"
              aria-label={`Now playing: ${idLabel(playing)}. Correct this ID`}
              title={`ID by ${playing.by}. Press to correct it.`}
            >
              {idLabel(playing)}
            </button>
          ) : (
            <button ref={line} type="button" onClick={open} className="track-ids-line text-[var(--muted)]">
              {playing ? 'Unknown track. Know it?' : 'Know this track?'} <span className="track-ids-cue">ID it</span>
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={post} noValidate onKeyDown={(e) => e.key === 'Escape' && shut()} aria-label={`ID the track at ${where}`}>
          <div className="grid items-center gap-3 sm:grid-cols-[auto_1fr_1fr_auto_auto]">
            <span className="font-mono text-[12px] tabular-nums text-[var(--text)]">{where}</span>
            {step === 'track' ? (
              <>
                <input ref={artistField} value={artist} onChange={typed(setArtist)} placeholder="Artist" aria-label="Artist" aria-describedby={message ? messageId : undefined} autoComplete="off" autoCapitalize="words" enterKeyHint="send" className={fieldClasses} />
                <input value={title} onChange={typed(setTitle)} placeholder="Title" aria-label="Title" autoComplete="off" autoCapitalize="words" enterKeyHint="send" className={fieldClasses} />
              </>
            ) : (
              <input ref={nameField} value={name} onChange={typed(setName)} placeholder="Your name" aria-label="Your name" aria-describedby={message ? messageId : undefined} autoComplete="name" maxLength={100} enterKeyHint="send" className={`${fieldClasses} sm:col-span-2`} />
            )}
            <div className="flex items-center gap-1">
              <button type="submit" aria-disabled={sending} className="poster-btn h-11 flex-1 whitespace-nowrap">
                <span className="grid place-items-center">
                  <span className={`col-start-1 row-start-1 ${sending ? 'invisible' : ''}`}>Post</span>
                  <span className={`col-start-1 row-start-1 ${sending ? '' : 'invisible'}`}>…</span>
                </span>
              </button>
              <button type="button" onClick={shut} aria-label="Cancel" className="track-ids-shut">
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
          </div>
          <p id={messageId} role="alert" className="font-mono text-[10px] uppercase leading-4 tracking-[0.22em] text-pretty text-red-500 empty:hidden mt-2">
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
