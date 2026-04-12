import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getTapeById } from '@/lib/data';
import { buildEmailHtml, tapeEmailData, FROM, REPLY_TO } from '@/lib/email';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiter for failed auth attempts
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const failedAttempts = new Map<string, { count: number; windowStart: number }>();

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) return true; // allow
  return entry.count < MAX_FAILURES;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip: string) {
  failedAttempts.delete(ip);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { tapeId, segmentId, message = '', adminPassword } = body;

    if (!segmentId || typeof segmentId !== 'string') {
      return NextResponse.json({ error: 'segmentId is required.' }, { status: 400 });
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      recordFailure(ip);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    clearFailures(ip);


    if (!tapeId || typeof tapeId !== 'string') {
      return NextResponse.json({ error: 'tapeId is required' }, { status: 400 });
    }

    const tape = getTapeById(tapeId);
    if (!tape) {
      return NextResponse.json({ error: `Tape "${tapeId}" not found` }, { status: 404 });
    }

    const { djName, tapeUrl, coverImageUrl, previewText } = tapeEmailData(tape, message);
    const html = buildEmailHtml({ tapeTitle: tape.title, djName, tapeUrl, coverImageUrl, message: message.trim(), previewText });
    const subject = `New mix: ${tape.title}`;

    const { data, error } = await resend.broadcasts.create({
      name: `${tape.title} — ${djName}`,
      segmentId,
      from: FROM,
      replyTo: REPLY_TO,
      subject,
      previewText,
      html,
      send: true,
    });

    if (error) {
      console.error('Resend broadcast error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to send broadcast. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, broadcastId: data?.id });
  } catch (err) {
    console.error('Broadcast error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
