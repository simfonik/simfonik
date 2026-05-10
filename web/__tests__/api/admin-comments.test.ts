import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));

import { GET, POST } from '@/app/api/admin/comments/route';

const ADMIN_PW = 'correct-horse-battery-staple';

function authHeader(password: string): Record<string, string> {
  const token = Buffer.from(`admin:${password}`).toString('base64');
  return { authorization: `Basic ${token}` };
}

function makeGet(headers: Record<string, string> = {}) {
  return new Request('https://simfonik.com/api/admin/comments', { headers });
}

function makePost(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://simfonik.com/api/admin/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', ADMIN_PW);
  sqlMock.mockReset();
  sqlMock.mockResolvedValue({ rows: [] });
});

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/admin/comments', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns 401 with a wrong password', async () => {
    const res = await GET(makeGet(authHeader('wrong')));
    expect(res.status).toBe(401);
  });

  it('returns 401 on a malformed Basic header', async () => {
    const res = await GET(makeGet({ authorization: 'Basic !!!not-base64!!!' }));
    expect(res.status).toBe(401);
  });

  it('returns pending comments + total when authed', async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 1, tape_id: 't', author_name: 'A', content: 'x', created_at: 'd' }] })
      .mockResolvedValueOnce({ rows: [{ count: '7' }] });
    const res = await GET(makeGet(authHeader(ADMIN_PW)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comments).toHaveLength(1);
    expect(json.total).toBe(7);
  });
});

describe('POST /api/admin/comments', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(makePost({ action: 'approve', commentId: 1 }));
    expect(res.status).toBe(401);
  });

  it('approves a comment when authed', async () => {
    const res = await POST(makePost({ action: 'approve', commentId: 42 }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledOnce();
  });

  it('deletes a comment when authed', async () => {
    const res = await POST(makePost({ action: 'delete', commentId: 42 }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledOnce();
  });

  it('rejects an unknown action', async () => {
    const res = await POST(makePost({ action: 'nuke', commentId: 42 }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects when commentId is missing', async () => {
    const res = await POST(makePost({ action: 'approve' }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(400);
  });
});
