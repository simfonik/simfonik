import { NextResponse } from 'next/server';
import { getAllTapes, getCoverImageWithFallback } from '@/lib/data';

const SITE_URL = 'https://simfonik.com';

export async function GET() {
  const tapes = getAllTapes(); // already reversed: newest first

  const options = tapes.map((tape) => {
    const coverPath = getCoverImageWithFallback(tape);
    const coverUrl = coverPath.startsWith('/media/tapes/')
      ? `${SITE_URL}/optimized/${tape.id}/800.avif`
      : `${SITE_URL}${coverPath}`;

    return {
      id: tape.id,
      title: tape.title,
      djName: tape.djs.map((dj) => dj.name).join(' & '),
      released: tape.released,
      coverUrl,
    };
  });

  return NextResponse.json({ tapes: options });
}
