import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get Basic Auth credentials from environment variables
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASS;

  // If no credentials are set, allow all traffic (for local dev)
  if (!basicAuthUser || !basicAuthPass) {
    return NextResponse.next();
  }

  // Get the authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Parse the authorization header
  const auth = authHeader.split(' ')[1];
  const [user, pass] = Buffer.from(auth, 'base64').toString().split(':');

  // Check if credentials match
  if (user !== basicAuthUser || pass !== basicAuthPass) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Authentication successful
  return NextResponse.next();
}

// Configure which routes to protect
// Protects ALL routes including home page
// Only exempts Next.js internals, media files, and common static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /_next/ (Next.js internals)
     * - /media/ (static media files like tape covers)
     * - Common static files (favicon.ico, robots.txt, sitemap.xml, etc.)
     */
    '/((?!_next/static|_next/image|media|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};
