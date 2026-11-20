import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sqlMock, revalidateTagMock, OLD } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  OLD: [
    { author: 'Thomas', date: '2009-02-07', content: 'Wow!' },
    { author: 'Rachel', date: '2009-05-04', content: 'This makes me remember.' },
  ],
}));

vi.mock('@/lib/db', () => ({ sql: sqlMock }));
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock, unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/data', () => ({
  getTapeById: (id: string) => (id === 'some-tape' ? { id } : undefined),
  // The tape has two comments kept from the old site.
  getCommentsForTape: (id: string) => (id === 'some-tape' ? OLD : []),
}));

import { POST } from '@/app/api/hearts/route';
import { GET } from '@/app/api/tape-stats/[tapeId]/route';
import { archivedTarget } from '@/lib/heart-targets';
import { NextRequest } from 'next/server';

const RACHEL = archivedTarget(OLD[1]);

const VISITOR = '0b6f0e7c-3f1a-4c58-9d3e-2a7b5c9d1e4f';
const heart = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  POST(new Request('https://simfonik.com/api/hearts', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ tapeId: 'some-tape', target: RACHEL, visitor: VISITOR, on: true, ...body }) }));
/** The statements the route ran, each as one line of text. */
const ran = () => sqlMock.mock.calls.map(([strings]) => (strings as string[]).join('?').replace(/\s+/g, ' ').trim());

beforeEach(() => {
  sqlMock.mockReset();
  revalidateTagMock.mockReset();
  // No rate-limit row, no comments posted through the site, and a count of one for whatever is counted.
  sqlMock.mockImplementation(async (strings: string[]) => ({ rows: strings.join('').includes('COUNT(*)') ? [{ n: 1 }] : [] }));
});

describe('POST /api/hearts', () => {
  it('knows an archived comment by what it is, not by where it sits in the archive', () => {
    expect(RACHEL).toMatch(/^a[0-9a-f]{10}$/);
    expect(archivedTarget({ ...OLD[1] })).toBe(RACHEL);
    expect(archivedTarget(OLD[0])).not.toBe(RACHEL);
  });

  it('gives a heart to an archived comment, says the count, and has the tape’s counts read again', async () => {
    const res = await heart({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 1 });
    expect(ran().some((statement) => statement.startsWith('INSERT INTO hearts'))).toBe(true);
    expect(revalidateTagMock).toHaveBeenCalledWith('hearts:some-tape');
  });

  it('takes a heart back', async () => {
    const res = await heart({ on: false });
    expect(res.status).toBe(200);
    expect(ran().some((statement) => statement.startsWith('DELETE FROM hearts'))).toBe(true);
    expect(ran().some((statement) => statement.startsWith('INSERT INTO hearts'))).toBe(false);
  });

  it('keeps a hash of the browser’s id, never the id', async () => {
    await heart({});
    const insert = sqlMock.mock.calls.find(([strings]) => (strings as string[]).join('').includes('INSERT INTO hearts'));
    expect(insert?.slice(1)).not.toContain(VISITOR);
    expect(insert?.[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a heart to a comment posted through the site, when it is that tape’s', async () => {
    sqlMock.mockImplementation(async (strings: string[]) => {
      const text = strings.join('');
      if (text.includes('FROM comments')) return { rows: [{ id: 154 }] };
      return { rows: text.includes('COUNT(*)') ? [{ n: 1 }] : [] };
    });
    expect((await heart({ target: 'c154' })).status).toBe(200);
    expect((await heart({ target: 'c155' })).status).toBe(400);
  });

  it.each([
    ['a tape that does not exist', { tapeId: 'no-such-tape' }],
    ['an id no browser made', { visitor: 'me' }],
    ['no word on whether it is given or taken back', { on: 'yes' }],
    ['a target that is not a comment', { target: 'x1' }],
  ])('refuses %s without asking the database', async (_what, body) => {
    const res = await heart(body);
    expect(res.status).toBe(400);
    expect(ran().some((statement) => statement.includes('hearts'))).toBe(false);
  });

  it('refuses an archived comment the tape does not have', async () => {
    expect((await heart({ target: archivedTarget({ ...OLD[1], content: 'Something nobody said.' }) })).status).toBe(400);
    expect(ran().some((statement) => statement.includes('hearts'))).toBe(false);
  });

  it('stops an address that has given a great many in the hour, counting hearts apart from comments', async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ count: 120, reset_at: new Date(Date.now() + 60000).toISOString() }] });
    const res = await heart({}, { 'x-forwarded-for': '1.2.3.4' });
    expect(res.status).toBe(429);
    expect(ran()).toHaveLength(1);
  });
});

describe('GET /api/tape-stats/[tapeId]', () => {
  const stats = (tapeId: string) => GET(new NextRequest(`https://simfonik.com/api/tape-stats/${tapeId}`), { params: Promise.resolve({ tapeId }) });

  it('gives the hearts on the tape’s comments by target', async () => {
    sqlMock.mockImplementation(async (strings: string[]) => ({ rows: strings.join('').includes('FROM hearts') ? [{ target: RACHEL, n: 3 }, { target: 'c154', n: 1 }] : [] }));
    const res = await stats('some-tape');
    expect(res.status).toBe(200);
    expect((await res.json()).hearts).toEqual({ [RACHEL]: 3, c154: 1 });
  });

  it('still answers where the hearts cannot be read', async () => {
    sqlMock.mockImplementation(async (strings: string[]) => {
      if (strings.join('').includes('FROM hearts')) throw new Error('relation "hearts" does not exist');
      return { rows: [] };
    });
    const res = await stats('some-tape');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plays: null, hearts: {} });
  });

  it('does not ask the database about a tape that does not exist', async () => {
    expect((await stats('no-such-tape')).status).toBe(404);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
