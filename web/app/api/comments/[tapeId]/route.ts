import { getTapeComments } from '@/lib/comments';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tapeId: string }> }
) {
  try {
    const { tapeId } = await params;
    return Response.json(await getTapeComments(tapeId));
  } catch (error) {
    console.error('Error fetching comments:', error);
    return Response.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}
