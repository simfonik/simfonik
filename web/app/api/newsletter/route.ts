import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);
const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID;

export async function POST(request: Request) {
  try {
    if (!segmentId) {
      console.error('RESEND_SEGMENT_ID is not configured');
      return NextResponse.json(
        { error: 'Newsletter signup is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, firstName } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { error } = await resend.contacts.create({
      email: email.trim().toLowerCase(),
      ...(firstName && typeof firstName === 'string' && firstName.trim() && {
        firstName: firstName.trim(),
      }),
      segments: [{ id: segmentId }],
    });

    if (error) {
      console.error('Resend contact creation error:', JSON.stringify(error));
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Newsletter signup error');
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
