import { describe, expect, it } from 'vitest';
import { formatTime, parseTime, typeTime } from '@/lib/time-utils';

describe('a time as a visitor types one', () => {
  it('is read with its hours, without them, and with a full stop, a comma or a space where a phone’s keys have no colon', () => {
    expect(['0:05:00', '5:00', '1:02:03', '75:30', ' 0:00:00 ', '5.00', '5,00', '0 5 0'].map(parseTime)).toEqual([300, 300, 3723, 4530, 0, 300, 300, 300]);
  });

  it('is read from figures alone, as a keypad with nothing else gives them: two for the seconds, two for the minutes, the rest hours', () => {
    expect(['500', '0500', '40', '5', '0', '1234', '10203', '000500'].map(parseTime)).toEqual([300, 300, 40, 5, 0, 754, 3723, 300]);
    // Sixty or more seconds or minutes is no time, however it is typed.
    expect(['90', '175', '17500', '12345678'].map(parseTime)).toEqual([null, null, null, null]);
  });

  it('is no time with four parts, with anything but figures, or with sixty or more seconds or minutes', () => {
    expect(['', '1:2:3:4', 'soon', '5:0x', '-1:00', '5:60', '0:60:00', '1:75:00'].map(parseTime)).toEqual(Array(8).fill(null));
  });

  it('reads back every time the page writes', () => {
    for (const seconds of [0, 59, 60, 3599, 3600, 7325]) expect(parseTime(formatTime(seconds))).toBe(seconds);
  });
});

describe('the time’s blank as it is typed in', () => {
  it('takes the figures in from the right, with the colons where they are', () => {
    expect([['5', '0:00:00'], ['0:00:050', '0:00:05'], ['0:00:500', '0:00:50'], ['0:05:001', '0:05:00'], ['0', '']].map(([text, was]) => typeTime(text, was, false))).toEqual(['0:00:05', '0:00:50', '0:05:00', '0:50:01', '0:00:00']);
  });

  it('reads a time pasted whole as itself, and nothing in what has no figures', () => {
    expect(['5:00', '1:02:03', '000500', 'soon', ':'].map((text) => typeTime(text, '', false))).toEqual(['0:05:00', '1:02:03', '0:05:00', '', '']);
  });

  it('lets a figure back out the way it came, and is empty when only zeros are left', () => {
    expect(['0:05:0', '0:00:5', '0:00:0', ''].map((text) => typeTime(text, '0:05:00', true))).toEqual(['0:00:50', '0:00:05', '', '']);
  });

  it('leaves the blank as it was at a sixth figure', () => {
    expect(typeTime('1:02:034', '1:02:03', false)).toBe('1:02:03');
  });
});
