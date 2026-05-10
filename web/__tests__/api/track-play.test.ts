import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));

import { POST } from '@/app/api/track-play/route';

function makeRequest(body: unknown) {
  return new Request('https://simfonik.com/api/track-play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sqlMock.mockReset();
  sqlMock.mockResolvedValue({ rows: [] });
});

describe('POST /api/track-play', () => {
  it('accepts a valid play and records it', async () => {
    const res = await POST(makeRequest({ tapeId: 'some-tape', sidePosition: 'A' }));
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledOnce();
  });

  it('rejects when tapeId is missing', async () => {
    const res = await POST(makeRequest({ sidePosition: 'A' }));
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects when sidePosition is missing', async () => {
    const res = await POST(makeRequest({ tapeId: 'some-tape' }));
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
