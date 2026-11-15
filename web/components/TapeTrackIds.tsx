'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { RunningOrder, TrackId } from '../lib/track-ids/compose';

/** Takes the tape to a moment on a side. `position` is the side's label, or null on a tape with one side. */
type GoTo = (position: string | null, time: number) => void;

/** A comment posted through the site, as /api/comments/[tapeId] gives it. */
export type TapeComment = { id: number; tape_id: string; author_name: string; content: string; created_at: string };

/** Where the tape is: which of its sides is loaded, how far in, and whether it has been played at all. */
export type Playhead = { side: number; time: number; started: boolean };

/** A track someone wants to ID or put right from outside the player: the side's label and where it starts. */
type Asked = { position: string | null; time: number };

type TapeTrackIds = {
  /** The IDs the comments give: one list per side, in the order the tape has its sides. Empty until they arrive. */
  sides: TrackId[][];
  /** Each side's tracks in order, where a list gives them without times (see lib/track-ids/read.ts). */
  orders: (RunningOrder | null)[];
  /**
   * The comments posted through the site, oldest first; null until they have been read. They are read once
   * here for both of the places that show them: the comment list, and the tracklist's history of ID posts.
   */
  comments: TapeComment[] | null;
  /** Counts up each time the comments are known to have changed. Whatever shows comments reads them again. */
  changed: number;
  /** A comment has been posted: read everything again. */
  refresh: () => void;
  /** The player says how to take the tape to a moment; a time in the tracklist can then be pressed. */
  setPlayer: (goTo: GoTo | null) => void;
  goTo: GoTo;
  /** The player says where the tape is, as it moves. */
  report: (side: number, time: number, started: boolean) => void;
  /** Where the tape is at this instant, for whatever is pressed. To follow it as it moves, `usePlayhead`. */
  playhead: () => Playhead;
  watch: (changed: () => void) => () => void;
  /** The tracklist asks for the form that IDs a track to open for one of its lines; the form answers once. */
  ask: (position: string | null, time: number) => void;
  asked: Asked | null;
  answered: () => void;
};

const STILL: Playhead = { side: 0, time: 0, started: false };
const nothing: TapeTrackIds = {
  sides: [],
  orders: [],
  comments: null,
  changed: 0,
  refresh: () => {},
  setPlayer: () => {},
  goTo: () => {},
  report: () => {},
  playhead: () => STILL,
  watch: () => () => {},
  ask: () => {},
  asked: null,
  answered: () => {},
};
const Context = createContext<TapeTrackIds>(nothing);

/**
 * What a tape page's separate parts share about track IDs: the player, far up the page, and the tracklist
 * and the comments, far down it. The IDs are read from the comments (see lib/track-ids/read.ts), so when a
 * comment is posted from either place all are told; a time in the tracklist can send the player to it; and
 * the tracklist knows where the tape is, to light the track playing and to time one that starts now.
 */
export function TapeTrackIdsProvider({ tapeId, children }: { tapeId: string; children: ReactNode }) {
  const [{ sides, orders }, setRead] = useState<Pick<TapeTrackIds, 'sides' | 'orders'>>({ sides: [], orders: [] });
  const [comments, setComments] = useState<TapeComment[] | null>(null);
  const [changed, setChanged] = useState(0);
  const [asked, setAsked] = useState<Asked | null>(null);
  const player = useRef<GoTo | null>(null);
  // The tape's place changes several times a second. It is kept out of what the page renders from, and
  // whatever follows it says what it wants to know of it (`usePlayhead`), so a page of tracks isn't drawn
  // again for every tick of the clock.
  const head = useRef<Playhead>(STILL);
  const watchers = useRef(new Set<() => void>());

  useEffect(() => {
    let current = true;
    fetch(`/api/track-ids/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: Pick<TapeTrackIds, 'sides' | 'orders'>) => {
        if (current) setRead({ sides: data.sides, orders: data.orders });
      })
      .catch((error) => console.error('Failed to load track IDs:', error));
    fetch(`/api/comments/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: TapeComment[]) => {
        if (current) setComments(data);
      })
      .catch((error) => {
        console.error('Failed to load comments:', error);
        // Nothing to show is told apart from still reading: the page stops saying it is loading.
        if (current) setComments([]);
      });
    return () => {
      current = false;
    };
  }, [tapeId, changed]);

  const refresh = useCallback(() => setChanged((n) => n + 1), []);
  const setPlayer = useCallback((goTo: GoTo | null) => {
    player.current = goTo;
  }, []);
  const goTo = useCallback<GoTo>((position, time) => player.current?.(position, time), []);
  const report = useCallback((side: number, time: number, started: boolean) => {
    head.current = { side, time, started };
    watchers.current.forEach((tell) => tell());
  }, []);
  const playhead = useCallback(() => head.current, []);
  const watch = useCallback((tell: () => void) => {
    watchers.current.add(tell);
    return () => {
      watchers.current.delete(tell);
    };
  }, []);
  const ask = useCallback((position: string | null, time: number) => setAsked({ position, time }), []);
  const answered = useCallback(() => setAsked(null), []);

  const value = useMemo(
    () => ({ sides, orders, comments, changed, refresh, setPlayer, goTo, report, playhead, watch, ask, asked, answered }),
    [sides, orders, comments, changed, refresh, setPlayer, goTo, report, playhead, watch, ask, asked, answered],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The tape's track IDs and the ways to act on them. Outside a tape page there are none, and the ways do nothing. */
export const useTapeTrackIds = () => useContext(Context);

/**
 * One thing about where the tape is, kept up to date: `pick` says what, as a string, a number or a yes or
 * no, and whatever asks is drawn again only when the answer changes, not each time the tape moves on.
 */
export function usePlayhead<T extends string | number | boolean>(pick: (head: Playhead) => T): T {
  const { watch, playhead } = useContext(Context);
  return useSyncExternalStore(
    watch,
    () => pick(playhead()),
    () => pick(STILL),
  );
}
