// What a side's moments make (lib/track-ids/moments.ts): the one laying-out of a side as tracks, which the
// reader of the comments and the tape page both use, and the test of which track a time is said of.
import { describe, expect, it } from 'vitest';
import { momentOf, sameRecord, settle, type Moment } from '@/lib/track-ids/moments';

/** What is said to start at a time: "Orbital - Chime", or with no name a spot someone marked. */
const at = (start: number, name = '', more: Partial<Moment> = {}): Moment => {
  const [artist = '', title = ''] = name.split(' - ');
  return { start, artist, title, known: Boolean(name), by: 'Rents', date: '2020-01-01', ...more };
};
const laid = (moments: Moment[], length?: number) => settle(moments, length).map((track) => `${track.start}-${track.end} ${track.known ? track.title : '??'}`);

describe('the tracks a side’s moments make', () => {
  it('each run until the next one starts, in order of time however the moments were given', () => {
    expect(laid([at(600, 'Joey Beltram - Energy Flash'), at(0, 'Orbital - Chime'), at(240)])).toEqual(['0-240 Chime', '240-600 ??', '600-840 Energy Flash']);
  });

  it('run to where a comment says they end, where one does', () => {
    expect(laid([at(0, 'Orbital - Chime', { until: 200 }), at(600, 'Joey Beltram - Energy Flash')])).toEqual(['0-200 Chime', '600-840 Energy Flash']);
    // An end no later than the start says nothing.
    expect(laid([at(300, 'Orbital - Chime', { until: 300 }), at(600)])[0]).toBe('300-600 Chime');
  });

  it('end with the last, which is taken to play four minutes, or to the end of the side', () => {
    expect(laid([at(0, 'Orbital - Chime')])).toEqual(['0-240 Chime']);
    expect(laid([at(0, 'Orbital - Chime')], 100)).toEqual(['0-100 Chime']);
    expect(laid([at(0, 'Orbital - Chime', { until: 500 })], 300)).toEqual(['0-300 Chime']);
  });

  it('let a record play on under those layered over it, to the next that isn’t a layer', () => {
    const side = [at(0, 'Orbital - Chime'), at(100, 'Moby - Next Is The E', { layer: true }), at(150, 'Altern 8 - Infiltrate 202', { layer: true }), at(400)];
    expect(laid(side)).toEqual(['0-400 Chime', '100-150 Next Is The E', '150-400 Infiltrate 202', '400-640 ??']);
  });

  it('take a record named again, with nothing else between, as the one play from the earlier start', () => {
    expect(laid([at(300, 'Altern 8 - Infiltrate 202'), at(360, 'Altern 8 - Infiltrate 202 (Remix)'), at(900)])).toEqual(['300-900 Infiltrate 202', '900-1140 ??']);
    // With anything between them they are two plays, a spot nobody has named included.
    expect(laid([at(300, 'Altern 8 - Infiltrate 202'), at(360), at(420, 'Altern 8 - Infiltrate 202')])).toEqual(['300-360 Infiltrate 202', '360-420 ??', '420-660 Infiltrate 202']);
  });

  it('are never shorter than five seconds', () => {
    expect(laid([at(100), at(104, 'Orbital - Chime')])).toEqual(['104-344 Chime']);
    expect(laid([at(100), at(105, 'Orbital - Chime')])).toEqual(['100-105 ??', '105-345 Chime']);
    // Nor in a side's last seconds. What is said there is no track, and the one before it still ends there.
    expect(laid([at(0, 'Orbital - Chime'), at(897)], 900)).toEqual(['0-897 Chime']);
    expect(laid([at(0, 'Orbital - Chime'), at(895)], 900)).toEqual(['0-895 Chime', '895-900 ??']);
  });
});

describe('the start a time is a moment of', () => {
  it('is the one within five seconds of it, either side', () => {
    expect([94, 95, 100, 105, 106].map((time) => momentOf([0, 100, 300], time))).toEqual([-1, 1, 1, 1, -1]);
  });

  it('is the nearer of two, and of two as near the earlier, in whatever order they come', () => {
    expect([103, 104, 105].map((time) => momentOf([100, 108], time))).toEqual([0, 0, 1]);
    expect(momentOf([108, 100], 104)).toBe(1);
  });

  it('is never a line that has no time yet', () => {
    expect(momentOf([null, 100, null], 100)).toBe(1);
    expect(momentOf([null], 0)).toBe(-1);
  });
});

describe('two names for one record', () => {
  const named = (name: string) => ({ artist: name.split(' - ')[0], title: name.split(' - ')[1] });

  it('have most of the words of the shorter in the longer, a mix in brackets and a slip of the keys aside', () => {
    expect(sameRecord(named('Orbital - Halcyon (Partyunicorn Mix)'), named('orbital - halcyon'))).toBe(true);
    expect(sameRecord(named('Hardfloor - Acperience'), named('Hardfloor - Acperiance'))).toBe(true);
    expect(sameRecord(named('Orbital - Chime'), named('Orbital - Belfast'))).toBe(false);
  });

  it('are not proved by a single word of any length: "Go" in two comments proves nothing', () => {
    expect(sameRecord(named('Moby - Go'), named('Moby - Go'))).toBe(false);
  });
});
