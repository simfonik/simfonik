import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));
// unstable_cache needs Next's incremental cache; pass the reader straight through here.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
// Only tapes in the archive may be queried; 'some-tape' stands in for a real one.
vi.mock('@/lib/data', () => ({ getTapeById: (id: string) => (id === 'some-tape' ? { id } : undefined) }));

import { GET } from '@/app/api/comments/[tapeId]/route';
import type { NextRequest } from 'next/server';

function makeRequest() {
  return new Request('https://simfonik.com/api/comments/some-tape') as unknown as NextRequest;
}

const ctx = (tapeId: string) => ({ params: Promise.resolve({ tapeId }) });

beforeEach(() => sqlMock.mockReset());

describe('GET /api/comments/[tapeId]', () => {
  it('returns approved comment rows for the tape', async () => {
    const rows = [
      { id: 1, tape_id: 'some-tape', author_name: 'A', content: 'Nice', created_at: '2026-01-01' },
    ];
    sqlMock.mockResolvedValueOnce({ rows });
    const res = await GET(makeRequest(), ctx('some-tape'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
  });

  it('returns 404 for a tape not in the archive without touching the DB', async () => {
    const res = await GET(makeRequest(), ctx('no-such-tape'));
    expect(res.status).toBe(404);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the DB throws', async () => {
    sqlMock.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(makeRequest(), ctx('some-tape'));
    expect(res.status).toBe(500);
  });
});
