import { getTapeById } from '@/lib/data';
import { buildEmailHtml, tapeEmailData } from '@/lib/email';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tapeId = searchParams.get('tapeId');
  const message = searchParams.get('message') ?? '';

  if (!tapeId) {
    return new Response('tapeId is required', { status: 400 });
  }

  const tape = getTapeById(tapeId);
  if (!tape) {
    return new Response(`Tape "${tapeId}" not found`, { status: 404 });
  }

  const { djName, tapeUrl, coverImageUrl, previewText } = tapeEmailData(tape, message);
  const html = buildEmailHtml({
    tapeTitle: tape.title,
    djName,
    tapeUrl,
    coverImageUrl,
    message: message.trim(),
    previewText,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
