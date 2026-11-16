import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sqlMock, revalidateTagMock } = vi.hoisted(() => ({ sqlMock: vi.fn(), revalidateTagMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock, unstable_cache: (fn: unknown) => fn }));

import { GET, POST } from '@/app/api/admin/comments/route';

const ADMIN_PW = 'correct-horse-battery-staple';

function authHeader(password: string): Record<string, string> {
  const token = Buffer.from(`admin:${password}`).toString('base64');
  return { authorization: `Basic ${token}` };
}

function makeGet(headers: Record<string, string> = {}, query = '') {
  return new Request(`https://simfonik.com/api/admin/comments${query}`, { headers });
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
  revalidateTagMock.mockReset();
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

  it('returns all comments (approved included) + total when authed', async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, tape_id: 't', author_name: 'A', content: 'x', created_at: 'd', approved: true }] })
      .mockResolvedValueOnce({ rows: [{ count: '7' }] });
    const res = await GET(makeGet(authHeader(ADMIN_PW)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].approved).toBe(true);
    expect(json.total).toBe(7);
    // Neither query may filter on approval status, or auto-approved comments vanish from moderation.
    for (const call of sqlMock.mock.calls) {
      expect(call[0].join('')).not.toMatch(/approved\s*=/);
    }
  });

  it('lists the posts of track IDs apart from the talk, each read line by line, and counts the two', async () => {
    // What the database takes for posts of IDs: one that is, and one that only looks it (a time and a name
    // with no side said, on a tape with two sides), which is talk.
    const post = { id: 5, tape_id: 'dj-greg-j-1992-rave-jams', author_name: 'Dana', content: '[1:09] Butsch - The Count (Remix) [was Butsch - The Count]\n[1:30] no track starts here', created_at: 'd', approved: true };
    const looksIt = { id: 6, tape_id: 'dj-trance-raw-wake-up-la', content: '[12:30] Moby - Go' };
    const queries = () => sqlMock.mockResolvedValueOnce({ rows: [post, looksIt] });

    queries().mockResolvedValueOnce({ rows: [post] }).mockResolvedValueOnce({ rows: [{ count: '9' }] });
    const ids = await (await GET(makeGet(authHeader(ADMIN_PW), '?kind=ids'))).json();
    expect(ids).toMatchObject({ kind: 'ids', total: 1, counts: { talk: 8, ids: 1 } });
    expect(ids.comments[0].ids).toEqual([
      { side: 0, position: null, start: 69, artist: 'Butsch', title: 'The Count (Remix)', gone: false, line: { artist: 'Butsch', title: 'The Count' } },
      { side: 0, position: null, start: 90, artist: '', title: '', gone: true },
    ]);
    // The list is of exactly those posts; the talk is everything else.
    expect(sqlMock.mock.calls[1].slice(1)).toContainEqual([5]);

    sqlMock.mockClear();
    queries().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '9' }] });
    const talk = await (await GET(makeGet(authHeader(ADMIN_PW)))).json();
    expect(talk).toMatchObject({ kind: 'talk', total: 8, counts: { talk: 8, ids: 1 } });
    expect(sqlMock.mock.calls[1][0].join('')).toMatch(/NOT \(id = ANY/);
    expect(sqlMock.mock.calls[1].slice(1)).toContainEqual([5]);
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
    expect(revalidateTagMock).toHaveBeenCalledWith('comments');
  });

  it('rejects an unknown action', async () => {
    const res = await POST(makePost({ action: 'nuke', commentId: 42 }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('rejects when commentId is missing', async () => {
    const res = await POST(makePost({ action: 'approve' }, authHeader(ADMIN_PW)));
    expect(res.status).toBe(400);
  });
});
