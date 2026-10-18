import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Abaikan file internal Next.js & static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/v1/auth') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Ekstraksi Subdomain Tenant
  const host = request.headers.get('host') ?? '';
  const domainParts = host.split('.');
  let tenantSubdomain = 'default';

  // Jika hostname berformat <subdomain>.domain.tld
  if (domainParts.length >= 3 && domainParts[0] && domainParts[0] !== 'www' && domainParts[0] !== 'localhost') {
    tenantSubdomain = domainParts[0];
  }

  // 3. Cek Auth Cookie
  const token = request.cookies.get('sica_access_token')?.value;

  // 4. Redirect ke login jika rute terproteksi diakses tanpa token
  const isAuthRoute = pathname === '/login' || pathname.startsWith('/login');
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/academic');

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Jika sudah login dan mencoba ke /login, redirect ke /dashboard
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 5. Teruskan tenant context via request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSubdomain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
