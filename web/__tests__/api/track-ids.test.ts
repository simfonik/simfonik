import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));
// unstable_cache needs Next's incremental cache; pass the reader straight through here.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
// Only tapes in the archive may be read; 'some-tape' stands in for one, with a comment from 2013 on it.
vi.mock('@/lib/data', () => ({
  getTapeById: (id: string) => (id === 'some-tape' ? { id, sides: [{ position: 'A' }] } : undefined),
  getCommentsForTape: () => [{ author: 'Rents', date: '2013-05-01', content: 'Orbital - Chime at 5:00, what a tune' }],
}));

import { GET } from '@/app/api/track-ids/[tapeId]/route';
import type { NextRequest } from 'next/server';

const request = () => new Request('https://simfonik.com/api/track-ids/some-tape') as unknown as NextRequest;
const ctx = (tapeId: string) => ({ params: Promise.resolve({ tapeId }) });
const names = (body: { sides: { start: number; artist: string; title: string }[][] }) => body.sides[0].map((moment) => `${moment.start} ${moment.artist} - ${moment.title}`);

beforeEach(() => sqlMock.mockReset());

describe('GET /api/track-ids/[tapeId]', () => {
  it('returns the tape’s comments and, in the same answer, what they and the archive say is on it', async () => {
    const rows = [{ id: 1, tape_id: 'some-tape', author_name: 'Dana', content: '[12:34] Moby - Go', created_at: '2026-01-01T00:00:00.000Z' }];
    sqlMock.mockResolvedValueOnce({ rows });
    const res = await GET(request(), ctx('some-tape'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toEqual(rows);
    expect(body.complete).toBe(true);
    expect(names(body)).toEqual(['300 Orbital - Chime', '754 Moby - Go']);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a tape not in the archive without touching the DB', async () => {
    const res = await GET(request(), ctx('no-such-tape'));
    expect(res.status).toBe(404);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('still answers when the DB throws, with the archive alone, and says the answer is not whole', async () => {
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    sqlMock.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(request(), ctx('some-tape'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ complete: false, comments: [] });
    expect(names(body)).toEqual(['300 Orbital - Chime']);
    expect(failed).toHaveBeenCalled();
    failed.mockRestore();
  });
});
