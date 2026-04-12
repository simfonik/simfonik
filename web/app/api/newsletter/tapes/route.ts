import { NextResponse } from 'next/server';
import { getAllTapes, getCoverImageUrl } from '@/lib/data';



export async function GET() {
  const tapes = getAllTapes(); // already reversed: newest first

  const options = tapes.map((tape) => {
    const coverUrl = getCoverImageUrl(tape);

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
