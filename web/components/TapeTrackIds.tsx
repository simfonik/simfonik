'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { composeId, composeRemoval, ONE_MOMENT, type RunningOrder, type TrackId } from '../lib/track-ids/compose';
import { postIds, rememberedName } from '../lib/track-ids/post';
import { sideRows, standing, withChanges, type Change, type Row } from '../lib/track-ids/side';
import type { Side } from '../types/tape';

/** Takes the tape to a moment on a side. `position` is the side's label, or null on a tape with one side. */
type GoTo = (position: string | null, time: number) => void;

/** A comment posted through the site, as /api/comments/[tapeId] gives it. */
export type TapeComment = { id: number; tape_id: string; author_name: string; content: string; created_at: string };

/** Where the tape is: which of its sides is loaded, how far in, and whether it has been played at all on this visit. */
export type Playhead = { side: number; time: number; started: boolean };

/** A track someone wants to ID or put right from outside the player: the side's label and where it starts. */
type Asked = { position: string | null; time: number };

/** What the page needs of a side to name it and to show its own tracklist. */
export type TapeSide = Pick<Side, 'position' | 'title' | 'tracks'>;

/** A side as the whole page has it: its list, where it has one, and its rows (lib/track-ids/side.ts). */
export type SideModel = { order: RunningOrder | null; rows: Row[] };

/** How the reading of the comments stands: not back yet, back whole, or back short of the newer ones (or not at all). */
type Read = 'reading' | 'read' | 'short';

type TapeTrackIds = {
  /** The tape's sides, in order. */
  tape: TapeSide[];
  /** Each side as every part of the page shows it, in the same order. */
  sides: SideModel[];
  read: Read;
  /**
   * The comments posted through the site, oldest first; null until they have been read. They are read once
   * here for both of the places that show them: the comment list, and the tracklist's history of ID posts.
   */
  comments: TapeComment[] | null;
  /** A comment has been posted some other way (the comment form): read everything again. */
  reread: () => void;
  /** The player says how to take the tape to a moment; a time in the tracklist can then be pressed. */
  setPlayer: (goTo: GoTo | null) => void;
  goTo: GoTo;
  /** The player says where the tape is, as it moves. */
  report: (side: number, time: number, started: boolean) => void;
  /** Where the tape is at this instant, for whatever is pressed. To follow it as it moves, `usePlayhead`. */
  playhead: () => Playhead;
  watch: (changed: () => void) => () => void;
  /** The name the visitor last posted under on this device, or none: it is asked for once. */
  name: string;
  /** The visitor's changes that wait to be posted, oldest first. */
  unposted: Change[];
  /** Says something of a moment and keeps it, unposted, on this device. It replaces what the visitor had unposted of that moment. */
  say: (change: Pick<Change, 'side' | 'time' | 'artist' | 'title'>) => void;
  /** Takes an unposted change back. */
  unsay: (change: Change) => void;
  /**
   * Posts changes as one comment under a name: the unposted ones the visitor has, or what the blanks have
   * just been given. Once posted they show on the page as posted, at once. Gives back nothing when it
   * posted, and otherwise what to tell the visitor.
   */
  post: (changes: Change[], name: string) => Promise<string | null>;
  /** The tracklist asks for the blanks that ID a track to open for one of its rows; they answer once. */
  ask: (position: string | null, time: number) => void;
  asked: Asked | null;
  answered: () => void;
};

const STILL: Playhead = { side: 0, time: 0, started: false };
const nothing: TapeTrackIds = {
  tape: [],
  sides: [],
  read: 'reading',
  comments: null,
  reread: () => {},
  setPlayer: () => {},
  goTo: () => {},
  report: () => {},
  playhead: () => STILL,
  watch: () => () => {},
  name: '',
  unposted: [],
  say: () => {},
  unsay: () => {},
  post: () => Promise.resolve(null),
  ask: () => {},
  asked: null,
  answered: () => {},
};
const Context = createContext<TapeTrackIds>(nothing);

/**
 * A side's list: the tape's own tracklist, which is in the page from the start with what only it has (a
 * record's page on Discogs, its length), or failing that the one the comments give, which arrives with the IDs.
 */
const listOf = (side: TapeSide, kept: RunningOrder | null | undefined): RunningOrder | null =>
  side.tracks?.length ? { by: null, tracks: side.tracks.map((t, k) => ({ n: k + 1, artist: t.artist, title: t.title, known: true, link: t.discogs_url, duration: t.duration })) } : (kept ?? null);

const sameMoment = (a: Pick<Change, 'side' | 'time'>, b: Pick<Change, 'side' | 'time'>) => a.side === b.side && Math.abs(a.time - b.time) <= ONE_MOMENT;

const isUnposted = (x: unknown): x is Change => {
  const c = x as Change;
  return Boolean(c) && [c.side, c.time].every(Number.isFinite) && typeof c.artist === 'string' && typeof c.title === 'string' && !c.gone && !c.sent;
};

/**
 * What a tape page's separate parts share about track IDs: the player, far up the page, and the tracklist
 * and the comments, far down it.
 *
 * It holds the two things the page knows: what the comments say (read from /api/track-ids, and read again
 * whenever something is posted) and what this visitor has said since (their changes). From those it works
 * out each side once (lib/track-ids/side.ts), and every part of the page shows that. So the line under the
 * player, the tray, the waveform and the tracklist can't differ, and a change shows on all of them at the
 * moment it is made.
 *
 * A change is the visitor's own until they post it, kept on this device through a reload. It is posted
 * here and nowhere else; from then until the comments have been read again it stays on the page, as
 * posted, so nothing a visitor has done blinks away while the page catches up.
 *
 * It also carries the two things the parts ask of each other: the tracklist sends the player to a moment,
 * and knows from the player where the tape is.
 */
export function TapeTrackIdsProvider({ tapeId, sides: tape, children }: { tapeId: string; sides: TapeSide[]; children: ReactNode }) {
  const [said, setSaid] = useState<{ ids: TrackId[][]; orders: (RunningOrder | null)[] }>({ ids: [], orders: [] });
  const [read, setRead] = useState<Read>('reading');
  const [comments, setComments] = useState<TapeComment[] | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [name, setName] = useState('');
  useEffect(() => setName(rememberedName()), []);
  // Each reading of the comments has a number. A change posted while reading n is under way is in reading
  // n + 1 at the earliest, and stays on the page until that one is back.
  const [reading, setReading] = useState(0);
  const latest = useRef(0);
  const player = useRef<GoTo | null>(null);
  // The tape's sides as they are now, for a reading that comes back later.
  const sidesNow = useRef(tape);
  useEffect(() => {
    sidesNow.current = tape;
  }, [tape]);
  // The tape's place changes several times a second. It is kept out of what the page renders from, and
  // whatever follows it says what it wants to know of it (`usePlayhead`), so a page of tracks isn't drawn
  // again for every tick of the clock.
  const head = useRef<Playhead>(STILL);
  const watchers = useRef(new Set<() => void>());

  useEffect(() => {
    let current = true;
    fetch(`/api/track-ids/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: { sides: TrackId[][]; orders: (RunningOrder | null)[]; complete: boolean }) => {
        if (!current) return;
        setSaid({ ids: data.sides, orders: data.orders });
        setRead(data.complete ? 'read' : 'short');
        // What was posted before this reading began is in it and no longer needs standing in for, and what
        // the visitor has unposted is let go where the comments have overtaken it.
        setChanges((all) => {
          const still = all.filter((change) => !change.sent || change.sent.read > reading);
          return sidesNow.current.flatMap((side, i) => standing(listOf(side, data.orders[i]), data.sides[i] ?? [], still.filter((change) => change.side === i)));
        });
      })
      .catch((error) => {
        console.error('Failed to load track IDs:', error);
        if (current) setRead('short');
      });
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
  }, [tapeId, reading]);

  // The visitor's unposted changes are kept through a reload: someone who has timed half a side and comes
  // back still has it to post.
  const key = `simfonik:id-changes:${tapeId}`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const kept: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      // Once only, however often the page is put together: a moment the visitor already has is left alone.
      if (Array.isArray(kept)) setChanges((all) => [...kept.filter(isUnposted).filter((was) => !all.some((change) => sameMoment(change, was))), ...all]);
    } catch {
      // Storage is off in this browser, or what it holds isn't ours: the visitor starts with none.
    }
    setRestored(true);
  }, [key]);
  const unposted = useMemo(() => changes.filter((change) => !change.sent), [changes]);
  useEffect(() => {
    if (!restored) return;
    try {
      if (unposted.length) window.localStorage.setItem(key, JSON.stringify(unposted));
      else window.localStorage.removeItem(key);
    } catch {
      // Storage is off: the changes last as long as the page does.
    }
  }, [key, restored, unposted]);

  // Each side, worked out once for the whole page. The visitor's changes join it when the comments are back:
  // they were made on top of what the comments said, and mean nothing certain without it.
  const sides = useMemo(
    () =>
      tape.map((side, i): SideModel => {
        const order = listOf(side, said.orders[i]);
        const mine = read === 'reading' ? [] : changes.filter((change) => change.side === i);
        return { order, rows: sideRows(order, withChanges(said.ids[i] ?? [], mine)) };
      }),
    [tape, said, read, changes],
  );

  const setPlayer = useCallback((goTo: GoTo | null) => {
    player.current = goTo;
  }, []);
  const goTo = useCallback<GoTo>((position, time) => player.current?.(position, time), []);
  const report = useCallback((side: number, time: number, started: boolean) => {
    // Once played, a tape stays played: paused back at its start, it is still one the visitor is listening to.
    head.current = { side, time, started: started || head.current.started };
    watchers.current.forEach((tell) => tell());
  }, []);
  const playhead = useCallback(() => head.current, []);
  const watch = useCallback((tell: () => void) => {
    watchers.current.add(tell);
    return () => {
      watchers.current.delete(tell);
    };
  }, []);

  const say = useCallback((change: Pick<Change, 'side' | 'time' | 'artist' | 'title'>) => setChanges((all) => [...all.filter((was) => was.sent || !sameMoment(was, change)), change]), []);
  const unsay = useCallback((change: Change) => setChanges((all) => all.filter((was) => was !== change)), []);
  const reread = useCallback(() => {
    latest.current += 1;
    setReading(latest.current);
  }, []);
  const several = tape.length > 1;
  const post = useCallback(
    async (posting: Change[], by: string) => {
      const lines = [...posting]
        .sort((a, b) => a.side - b.side || a.time - b.time)
        .map((change) => {
          const where = { position: several ? tape[change.side].position : null, time: change.time };
          return change.gone ? composeRemoval(where) : composeId({ ...where, artist: change.artist, title: change.title });
        });
      const failed = await postIds(tapeId, by, lines.join('\n'));
      if (failed) return failed;
      setName(by.trim());
      const sent = { by: by.trim(), read: latest.current + 1 };
      // Each is now posted, where it stood among the visitor's changes; one that is new to them (from the
      // blanks) goes last, in place of anything the visitor had unposted of the same moment.
      setChanges((all) => [
        ...all.filter((was) => posting.includes(was) || was.sent || !posting.some((now) => sameMoment(was, now))).map((was) => (posting.includes(was) ? { ...was, sent } : was)),
        ...posting.filter((change) => !all.includes(change)).map((change) => ({ ...change, sent })),
      ]);
      reread();
      return null;
    },
    [tapeId, tape, several, reread],
  );
  const ask = useCallback((position: string | null, time: number) => setAsked({ position, time }), []);
  const answered = useCallback(() => setAsked(null), []);

  const value = useMemo(
    () => ({ tape, sides, read, comments, reread, setPlayer, goTo, report, playhead, watch, name, unposted, say, unsay, post, ask, asked, answered }),
    [tape, sides, read, comments, reread, setPlayer, goTo, report, playhead, watch, name, unposted, say, unsay, post, ask, asked, answered],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The tape's track IDs and the ways to act on them. Outside a tape page there are none, and the ways do nothing. */
export const useTapeTrackIds = () => useContext(Context);

const NO_SIDE: SideModel = { order: null, rows: [] };

/** One side as the whole page has it. */
export const useSide = (side: number): SideModel => useContext(Context).sides[side] ?? NO_SIDE;

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
