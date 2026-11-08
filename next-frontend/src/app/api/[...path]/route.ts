import { NextRequest, NextResponse } from 'next/server';
import { normalizeHost } from '@/lib/routing/hostResolver';

const BACKEND_INTERNAL_URL =
  process.env.BACKEND_URL ||
  'http://localhost:5000';

const PROXY_SHARED_SECRET = process.env.PROXY_SHARED_SECRET || '';

/**
 * Handles all HTTP methods by securely proxying the request to the upstream Express backend.
 */
async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const subPath = path ? path.join('/') : '';
    const search = request.nextUrl.search || '';

    // Derive target path: Express backend routes /api/platform/auth as /api/platform/auth,
    // and standard routes like /auth, /admin, /departments directly or with /api.
    const upstreamPath = subPath.startsWith('platform/') ? `api/${subPath}` : subPath;
    const targetUrl = `${BACKEND_INTERNAL_URL.replace(/\/$/, '')}/${upstreamPath}${search}`;

    // Host identity derivation: Use middleware-validated x-yuva-clean-host if available,
    // otherwise strictly normalize host header.
    const cleanHost =
      request.headers.get('x-yuva-clean-host') ||
      normalizeHost(request.headers.get('host')) ||
      'localhost';

    let tenantSlug = request.headers.get('x-yuva-tenant-slug');
    let hostType = request.headers.get('x-yuva-host-type');

    // Fallback: If not set by subdomain (e.g. path-based routing on Vercel preview https://.../college/lbrce):
    if (!tenantSlug) {
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const match = refererUrl.pathname.match(/^\/college\/([a-z0-9-]+)/i);
          if (match) {
            tenantSlug = match[1].toLowerCase();
            hostType = 'COLLEGE';
          } else if (refererUrl.pathname.startsWith('/admin')) {
            hostType = 'PLATFORM_ADMIN';
          }
        } catch {}
      }
    }

    if (subPath.startsWith('platform/')) {
      hostType = 'PLATFORM_ADMIN';
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (isProduction ? 'https' : 'http');

    // Build strictly controlled forwarding headers
    const forwardHeaders = new Headers();

    // 1. Host and Tenant forwarding (used by backend resolveCollege.js)
    let effectiveHost = cleanHost;
    if (tenantSlug && hostType === 'COLLEGE' && !cleanHost.includes(tenantSlug)) {
      effectiveHost = `${tenantSlug}.4thepeople.in`;
    } else if (hostType === 'PLATFORM_ADMIN' && !cleanHost.startsWith('admin.')) {
      effectiveHost = 'admin.4thepeople.in';
    }

    forwardHeaders.set('x-forwarded-host', effectiveHost);
    forwardHeaders.set('x-forwarded-proto', proto);

    if (tenantSlug && hostType === 'COLLEGE') {
      forwardHeaders.set('x-yuva-tenant-slug', tenantSlug);
    }

    if (hostType) {
      forwardHeaders.set('x-yuva-host-type', hostType);
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';
    forwardHeaders.set('x-forwarded-for', clientIp);

    // 2. Secret injection (mandatory in production for backend proxySecurity.js)
    if (PROXY_SHARED_SECRET) {
      forwardHeaders.set('x-proxy-shared-secret', PROXY_SHARED_SECRET);
    }

    // 3. Selective header forwarding (allowlist)
    const allowedHeaders = [
      'cookie',
      'authorization',
      'content-type',
      'accept',
      'accept-language',
      'user-agent',
    ];

    for (const header of allowedHeaders) {
      const val = request.headers.get(header);
      if (val) {
        forwardHeaders.set(header, val);
      }
    }

    // 4. Origin & Referer forwarding (required by backend originValidation.js)
    const origin = request.headers.get('origin') || `${proto}://${cleanHost}`;
    forwardHeaders.set('origin', origin);

    const referer = request.headers.get('referer');
    if (referer) {
      forwardHeaders.set('referer', referer);
    }

    // Prepare body for non-GET/HEAD methods
    const method = request.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    let body: BodyInit | null = null;

    if (hasBody) {
      body = await request.arrayBuffer();
    }

    // Execute upstream request
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      redirect: 'manual', // Do not automatically follow redirects
    });

    // Copy upstream response headers
    const responseHeaders = new Headers();

    const forwardResponseHeaders = [
      'content-type',
      'content-length',
      'content-disposition',
      'etag',
      'last-modified',
    ];

    for (const h of forwardResponseHeaders) {
      const v = upstreamResponse.headers.get(h);
      if (v) {
        responseHeaders.set(h, v);
      }
    }

    // Critical: Prevent downstream caching of authenticated or dynamic API data
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    responseHeaders.set('Pragma', 'no-cache');

    // Handle Set-Cookie: preserve all upstream session cookies (yuva_token, yuva_platform_token, token)
    // using getSetCookie() for standards-compliant multi-cookie extraction
    const setCookies = typeof upstreamResponse.headers.getSetCookie === 'function'
      ? upstreamResponse.headers.getSetCookie()
      : [upstreamResponse.headers.get('set-cookie')].filter(Boolean) as string[];

    for (const cookieStr of setCookies) {
      responseHeaders.append('Set-Cookie', cookieStr);
    }

    const responseBody = await upstreamResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Upstream service error';
    return NextResponse.json(
      {
        success: false,
        message: 'Backend proxy error: Unable to communicate with upstream service',
        error: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, private',
        },
      }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;

