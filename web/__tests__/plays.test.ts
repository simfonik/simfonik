import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import comments from '@/data/tape-comments.json';
import starts from '@/data/play-starts.json';
import tapes from '@/data/tapes.json';
import { playsShown } from '@/lib/plays';

const START: Record<string, number> = starts;
const counted = (plays: Record<string, number>) => sqlMock.mockResolvedValue({ rows: Object.entries(plays).map(([tape_id, n]) => ({ tape_id, n })) });

beforeEach(() => sqlMock.mockReset());

describe('the plays a mix shows', () => {
  it('are its start and its counted plays, for a mix that was on the old site', async () => {
    counted({ 'circa-92': 275 });
    expect(await playsShown('circa-92')).toBe(START['circa-92'] + 275);
  });

  it('are its start alone where no play has been counted', async () => {
    counted({});
    expect(await playsShown('circa-92')).toBe(START['circa-92']);
  });

  it('are its counted plays for a mix added since, once there are a hundred', async () => {
    counted({ 'dj-thee-o-sunset-on-venus': 100 });
    expect(await playsShown('dj-thee-o-sunset-on-venus')).toBe(100);
  });

  it('are not shown for a mix added since that has fewer', async () => {
    counted({ 'dj-thee-o-sunset-on-venus': 99 });
    expect(await playsShown('dj-thee-o-sunset-on-venus')).toBeNull();
  });
});

describe('the starts', () => {
  const old = comments as Record<string, unknown[]>;
  const all = tapes as { id: string; created_date: string }[];

  it('are for every mix that was on the old site, and no other', () => {
    const wasThere = all.filter((tape) => tape.created_date < '2026' || (old[tape.id] ?? []).length > 0).map((tape) => tape.id);
    expect(Object.keys(START).sort()).toEqual(wasThere.sort());
  });

  it('are 26 for each comment the mix had there, and never under 133', () => {
    for (const [id, start] of Object.entries(START)) {
      const said = (old[id] ?? []).length * 26;
      expect(start, id).toBeGreaterThanOrEqual(133);
      if (said > 163) expect(start, id).toBe(said);
      else expect(start, id).toBeLessThanOrEqual(163);
    }
  });

  it('are not all the same at the bottom', () => {
    const low = Object.values(START).filter((start) => start <= 163);
    expect(new Set(low).size).toBeGreaterThan(10);
  });
});
