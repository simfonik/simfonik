import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASS;

  // If no credentials are set, allow all traffic (for local dev)
  if (!basicAuthUser || !basicAuthPass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  try {
    const base64 = authHeader.slice("Basic ".length).trim();
    const decoded = atob(base64); // Edge-safe
    const sep = decoded.indexOf(":");
    const user = sep >= 0 ? decoded.slice(0, sep) : "";
    const pass = sep >= 0 ? decoded.slice(sep + 1) : "";

    if (user !== basicAuthUser || pass !== basicAuthPass) {
      return new NextResponse("Invalid credentials", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
      });
    }

    return NextResponse.next();
  } catch {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|media|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
