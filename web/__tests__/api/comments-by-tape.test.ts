import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));

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

  it('returns 500 when the DB throws', async () => {
    sqlMock.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(makeRequest(), ctx('some-tape'));
    expect(res.status).toBe(500);
  });
});
