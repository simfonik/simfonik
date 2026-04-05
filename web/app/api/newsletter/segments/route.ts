import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const password = request.headers.get('x-admin-password');
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await resend.segments.list();

  if (error || !data) {
    console.error('Failed to fetch segments:', error);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }

  const segments = data.data.map((s) => ({ id: s.id, name: s.name }));
  return NextResponse.json({ segments });
}
