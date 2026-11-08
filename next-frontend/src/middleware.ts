import { NextRequest, NextResponse } from 'next/server';
import { resolveHost } from './lib/routing/hostResolver';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');

  // Next.js running behind trusted reverse proxy: only trust forwarded headers if explicitly configured
  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxy = process.env.TRUST_PROXY === 'true';

  const resolution = resolveHost(host, {
    isProduction,
    trustProxy,
    forwardedHost,
  });

  // 1. Invalid or unrecognized host: Reject explicitly with HTTP 400
  // Crucial: Never silently fall back to public directory
  if (resolution.type === 'INVALID') {
    return new NextResponse(
      JSON.stringify({
        error: 'Bad Request',
        message: resolution.reason || 'Invalid or unrecognized hostname',
        host: resolution.cleanHost,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'x-yuva-host-type': 'INVALID',
        },
      }
    );
  }

  // 2. Clone headers and attach verified tenant / routing claims
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-yuva-host-type', resolution.type);
  requestHeaders.set('x-yuva-clean-host', resolution.cleanHost);
  if (resolution.slug) {
    requestHeaders.set('x-yuva-tenant-slug', resolution.slug);
  }

  const { pathname } = request.nextUrl;

  // 3. API endpoints: pass through without UI rewriting so BFF proxy catches /api/*
  if (pathname.startsWith('/api')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 4. Canonical Subdomain Enforcements on PUBLIC host
  // Prevent /college/[slug] or /admin from being directly accessed on public root domain
  if (resolution.type === 'PUBLIC') {
    const proto = isProduction ? 'https' : 'http';
    const port = request.nextUrl.port ? `:${request.nextUrl.port}` : '';

    if (pathname.startsWith('/admin')) {
      const adminDomain = isProduction ? 'admin.4thepeople.in' : `admin.localhost${port}`;
      const subPath = pathname.replace(/^\/admin/, '') || '/';
      return NextResponse.redirect(
        new URL(`${proto}://${adminDomain}${subPath}${request.nextUrl.search}`),
        308
      );
    }

    const collegeMatch = pathname.match(/^\/college\/([a-z0-9-]+)(\/.*)?$/);
    if (collegeMatch) {
      const slug = collegeMatch[1];
      const remainder = collegeMatch[2] || '/';
      const tenantDomain = isProduction ? `${slug}.4thepeople.in` : `${slug}.localhost${port}`;
      return NextResponse.redirect(
        new URL(`${proto}://${tenantDomain}${remainder}${request.nextUrl.search}`),
        308
      );
    }
  }

  // 5. Routing rewrites based on verified host type
  // Multi-subdomain mapping to route areas:
  // - COLLEGE: rewritten to /college/[slug]/...
  // - PLATFORM_ADMIN: rewritten to /admin/...
  // - PUBLIC: regular root / (public) paths
  if (resolution.type === 'COLLEGE' && resolution.slug) {
    // If not already rewritten
    if (!pathname.startsWith(`/college/${resolution.slug}`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/college/${resolution.slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });
    }
  } else if (resolution.type === 'PLATFORM_ADMIN') {
    if (!pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  // Standard passthrough with enriched routing headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Next.js 16 proxy convention alias
export const proxy = middleware;

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/icons/fonts with common extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
