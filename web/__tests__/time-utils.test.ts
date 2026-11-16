import { describe, expect, it } from 'vitest';
import { formatTime, parseTime } from '@/lib/time-utils';

describe('a time as a visitor types one', () => {
  it('is read with its hours, without them, and with a full stop or a space where a phone’s keys have no colon', () => {
    expect(['0:05:00', '5:00', '1:02:03', '75:30', ' 0:00:00 ', '5.00', '0 5 0'].map(parseTime)).toEqual([300, 300, 3723, 4530, 0, 300, 300]);
  });

  it('is no time with one part or four, with anything but figures, or with sixty or more seconds or minutes', () => {
    expect(['', '300', '1:2:3:4', 'soon', '5:0x', '-1:00', '5:60', '0:60:00', '1:75:00'].map(parseTime)).toEqual(Array(9).fill(null));
  });

  it('reads back every time the page writes', () => {
    for (const seconds of [0, 59, 60, 3599, 3600, 7325]) expect(parseTime(formatTime(seconds))).toBe(seconds);
  });
});
