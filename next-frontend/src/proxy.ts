/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Runs before every request: resolves the tenant from host + path, sets the
 * x-yuva-* routing headers, rewrites college-subdomain URLs onto the shared
 * /college/[slug] page, and rejects reserved or invalid hosts outright.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveHost } from './lib/routing/hostResolver';
import { resolveCollegeRouting } from './lib/routing/collegePath';

export function proxy(request: NextRequest) {
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

  // Pure routing decision: tenant headers, internal rewrites, rejections.
  const decision = resolveCollegeRouting(pathname, resolution);

  if (decision.status) {
    return NextResponse.json(
      { error: 'Invalid college slug' },
      { status: decision.status }
    );
  }

  requestHeaders.set('x-yuva-host-type', decision.hostType);
  requestHeaders.set('x-yuva-clean-host', resolution.cleanHost);

  if (decision.tenantSlug) {
    requestHeaders.set('x-yuva-tenant-slug', decision.tenantSlug);
  }

  if (decision.rewritePath) {
    // Internal rewrite: browser URL unchanged, shared college page renders both
    // http://lbrce.localhost:3000/ and http://localhost:3000/college/lbrce.
    return NextResponse.rewrite(new URL(decision.rewritePath, request.url), {
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
