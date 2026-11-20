'use client';

import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// How a tape has gone down: the plays its page shows, and the hearts on its comments. Both are read once the
// page has loaded (/api/tape-stats), so the page itself stays as it was built.
//
// A heart is a browser's, the site having no accounts. The browser makes itself an id the first time it gives
// one, and remembers which comments it has given a heart to. Both are kept on the device, so they do not
// follow anyone to another, and a browser with its storage shut cannot give hearts.

type TapeStats = {
  /** The plays to show, or null: not read yet, or nothing to show (lib/plays.ts). */
  plays: number | null;
  /** The listener has started a side: one more play, shown at once (the site's own count is hours behind). */
  played: () => void;
  /** How many hearts each comment has, by target (lib/hearts.ts). A comment with none is not in it. */
  hearts: Record<string, number>;
  /** The comments this browser has given its heart to. */
  mine: ReadonlySet<string>;
  /** Gives this browser's heart to a comment, or takes it back. */
  toggle: (target: string) => void;
};

const nothing: TapeStats = { plays: null, played: () => {}, hearts: {}, mine: new Set(), toggle: () => {} };
const Context = createContext<TapeStats>(nothing);

const VISITOR_KEY = 'simfonik:visitor';
const heartsKey = (tapeId: string) => `simfonik:hearts:${tapeId}`;

/** This browser's id, made the first time it is wanted. None where the browser keeps nothing. */
function visitorId(): string | null {
  try {
    const kept = window.localStorage.getItem(VISITOR_KEY);
    if (kept) return kept;
    const made = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return null;
  }
}

function remembered(tapeId: string): Set<string> {
  try {
    const kept: unknown = JSON.parse(window.localStorage.getItem(heartsKey(tapeId)) ?? '[]');
    return new Set(Array.isArray(kept) ? kept.filter((target): target is string => typeof target === 'string') : []);
  } catch {
    return new Set();
  }
}

function remember(tapeId: string, mine: ReadonlySet<string>) {
  try {
    if (mine.size) window.localStorage.setItem(heartsKey(tapeId), JSON.stringify([...mine]));
    else window.localStorage.removeItem(heartsKey(tapeId));
  } catch {
    // Not kept: the heart still stands, and this browser will not know it was its own.
  }
}

export function TapeStatsProvider({ tapeId, children }: { tapeId: string; children: ReactNode }) {
  const [plays, setPlays] = useState<number | null>(null);
  // The plays this listener has started since the page loaded. The site counts the plays again every few
  // hours (lib/plays.ts), so the number it gave does not have these in it yet.
  const [own, setOwn] = useState(0);
  const played = useCallback(() => setOwn((n) => n + 1), []);
  const [hearts, setHearts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<ReadonlySet<string>>(nothing.mine);
  // The comments with a heart on its way to the site: pressed again meanwhile, nothing happens.
  const sending = useRef(new Set<string>());

  useEffect(() => {
    let current = true;
    setMine(remembered(tapeId));
    fetch(`/api/tape-stats/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: { plays: number | null; hearts: Record<string, number> }) => {
        if (!current) return;
        setPlays(data.plays);
        setHearts(data.hearts);
      })
      // Nothing to show is not worth a word on the page: the plays stay off it and the hearts stay bare.
      .catch((error) => console.error('Failed to load tape stats:', error));
    return () => {
      current = false;
    };
  }, [tapeId]);

  const toggle = useCallback(
    (target: string) => {
      const visitor = visitorId();
      if (!visitor || sending.current.has(target)) return;
      sending.current.add(target);
      const had = remembered(tapeId);
      const on = !had.has(target);
      // Shown at once, and kept, as if it had gone through; put back if it turns out not to have.
      const give = (given: boolean, count?: number) => {
        const now = remembered(tapeId);
        if (given) now.add(target);
        else now.delete(target);
        remember(tapeId, now);
        setMine(now);
        setHearts((all) => ({ ...all, [target]: count ?? Math.max(0, (all[target] ?? 0) + (given ? 1 : -1)) }));
      };
      give(on);
      fetch('/api/hearts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tapeId, target, visitor, on }) })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
        .then((data: { count: number }) => give(on, data.count))
        .catch((error) => {
          console.error('Failed to save the heart:', error);
          give(!on);
        })
        .finally(() => sending.current.delete(target));
    },
    [tapeId],
  );

  // A mix with nothing to show has nothing to add to: its number comes when the site's count reaches it.
  const shown = plays === null ? null : plays + own;
  const value = useMemo(() => ({ plays: shown, played, hearts, mine, toggle }), [shown, played, hearts, mine, toggle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Tells the page that the listener has started a side. Outside a tape page it does nothing. */
export const useCountPlay = () => useContext(Context).played;

/**
 * The mix's plays, as the last line of the tape's details. The line is there from the start, empty until the
 * plays are read and where there are none to show, so that nothing under it moves when the number comes.
 */
export function TapePlays() {
  const { plays } = useContext(Context);
  return plays === null ? <p aria-hidden="true">&nbsp;</p> : <p>Plays · {plays.toLocaleString('en-US')}</p>;
}

/**
 * The heart on a comment. Outlined, and filled once this browser has given its own. The count is beside it
 * only when someone has given one: a nought beside every comment would say more than a bare heart does.
 */
export function Heart({ target }: { target: string }) {
  const { hearts, mine, toggle } = useContext(Context);
  const given = mine.has(target);
  // A heart this browser gave is one, whatever an older reading of the counts says.
  const count = Math.max(hearts[target] ?? 0, given ? 1 : 0);
  const Icon = given ? HeartSolid : HeartOutline;
  return (
    <button
      type="button"
      className="comment-heart"
      aria-pressed={given}
      aria-label={count ? `Heart this comment. ${count} so far` : 'Heart this comment'}
      onClick={() => toggle(target)}
    >
      <Icon aria-hidden="true" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
