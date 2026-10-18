import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, type EdgeAuthEnv } from '@/lib/edge-auth';

const ACCESS_COOKIE = 'sica_access_token';

function readEnv(): EdgeAuthEnv {
  return {
    jwk: process.env['JWT_PUBLIC_KEY_JWK'],
    issuer: process.env['JWT_ISSUER'],
    audience: process.env['JWT_AUDIENCE'],
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Abaikan file internal Next.js & aset statis
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/v1/auth') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Ekstraksi subdomain tenant (hanya sebagai petunjuk tampilan; otoritatif = klaim tid)
  const host = request.headers.get('host') ?? '';
  const domainParts = host.split('.');
  let tenantSubdomain = 'default';
  if (
    domainParts.length >= 3 &&
    domainParts[0] &&
    domainParts[0] !== 'www' &&
    domainParts[0] !== 'localhost'
  ) {
    tenantSubdomain = domainParts[0];
  }

  // 3. Verifikasi tanda tangan akses token di Edge (bukan sekadar cek cookie ada)
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const outcome = await verifyAccessToken(token, readEnv());

  const isAuthRoute = pathname === '/login' || pathname.startsWith('/login');
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/academic');

  // 4. Rute terproteksi: wajib token valid. Fail-secure — invalid/unconfigured → login.
  if (isProtectedRoute && outcome.status !== 'valid') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      // bersihkan cookie basi/kedaluwarsa agar tak menggantung
      response.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return response;
  }

  // 5. Sudah terautentikasi mencoba ke /login → ke dashboard
  if (isAuthRoute && outcome.status === 'valid') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 6. Teruskan konteks tenant via header (tid dari token bila valid, fallback slug)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSubdomain);
  if (outcome.status === 'valid') {
    requestHeaders.set('x-tenant-id', outcome.claims.tid);
    requestHeaders.set('x-user-id', outcome.claims.sub);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
