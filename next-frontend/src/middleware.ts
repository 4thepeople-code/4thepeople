
import { NextRequest, NextResponse } from 'next/server';
import { resolveHost } from './lib/routing/hostResolver';

const RESERVED_SLUGS = new Set([
  'www', 'admin', 'api', 'mail', 'app',
  'static', 'assets', 'public', 'auth',
]);

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');

  const resolution = resolveHost(host, {
    isProduction: process.env.NODE_ENV === 'production',
  });

  if (resolution.type === 'INVALID') {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: resolution.reason || 'Invalid hostname',
      },
      { status: 400 }
    );
  }

  const requestHeaders = new Headers(request.headers);

  // Always overwrite client-supplied routing headers.
  requestHeaders.delete('x-yuva-tenant-slug');

  const { pathname } = request.nextUrl;

  // Public landing page and path-based college portals.
  const collegeMatch = pathname.match(
    /^\/college\/([a-z0-9-]+)(?:\/|$)/i
  );

  if (collegeMatch) {
    const slug = collegeMatch[1].toLowerCase();

    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json(
        { error: 'Invalid college slug' },
        { status: 400 }
      );
    }

    requestHeaders.set('x-yuva-host-type', 'COLLEGE');
    requestHeaders.set('x-yuva-tenant-slug', slug);
    requestHeaders.set('x-yuva-clean-host', resolution.cleanHost);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Platform administration uses the /admin path.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    requestHeaders.set('x-yuva-host-type', 'PLATFORM_ADMIN');
    requestHeaders.set('x-yuva-clean-host', resolution.cleanHost);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  requestHeaders.set('x-yuva-host-type', 'PUBLIC');
  requestHeaders.set('x-yuva-clean-host', resolution.cleanHost);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const proxy = middleware;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
