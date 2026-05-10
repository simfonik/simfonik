import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be set up before importing the route handler. vi.mock is
// hoisted above the file, so top-level consts in the factory aren't
// initialized yet — vi.hoisted is the canonical workaround.
const { sqlMock, sendCommentNotificationMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  sendCommentNotificationMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: sqlMock }));
vi.mock('@/lib/email', () => ({ sendCommentNotification: sendCommentNotificationMock }));

import { POST } from '@/app/api/comments/submit/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://simfonik.com/api/comments/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sqlMock.mockReset();
  sendCommentNotificationMock.mockReset();
  sendCommentNotificationMock.mockResolvedValue(undefined);
  // Default: no existing rate-limit row, all subsequent writes succeed.
  sqlMock.mockResolvedValue({ rows: [] });
});

const validBody = {
  tapeId: 'some-tape',
  authorName: 'Alice',
  authorEmail: 'alice@example.com',
  content: 'A real comment that is well over ten characters long.',
  website: '',
};

describe('POST /api/comments/submit', () => {
  it('accepts a valid comment, inserts it, and fires the notification', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, message: 'Comment posted' });
    expect(sendCommentNotificationMock).toHaveBeenCalledOnce();
  });

  it('rejects when the honeypot field is filled (bot signal)', async () => {
    const res = await POST(makeRequest({ ...validBody, website: 'http://spam.example' }));
    expect(res.status).toBe(400);
    expect(sendCommentNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects when content is shorter than 10 chars', async () => {
    const res = await POST(makeRequest({ ...validBody, content: 'short' }));
    expect(res.status).toBe(400);
  });

  it('rejects when content is whitespace-only', async () => {
    const res = await POST(makeRequest({ ...validBody, content: '          ' }));
    expect(res.status).toBe(400);
  });

  it('rejects when content exceeds 5000 chars', async () => {
    const res = await POST(makeRequest({ ...validBody, content: 'a'.repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it('rejects when tapeId is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, tapeId: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 429 when the IP has hit the rate limit', async () => {
    // First sql call is the rate-limit lookup. Return a row with count=5
    // and a future reset_at to trigger the limit branch.
    const future = new Date(Date.now() + 60_000).toISOString();
    sqlMock.mockResolvedValueOnce({ rows: [{ count: 5, reset_at: future }] });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(sendCommentNotificationMock).not.toHaveBeenCalled();
  });

  it('still succeeds (200) if the notification email throws', async () => {
    sendCommentNotificationMock.mockRejectedValueOnce(new Error('Resend down'));
    const res = await POST(makeRequest(validBody));
    // Note: current implementation `await`s the notification but the
    // notification function catches its own errors, so this should still
    // succeed. If the implementation regresses to letting errors bubble,
    // this test will fail.
    expect(res.status).toBe(200);
  });
});
