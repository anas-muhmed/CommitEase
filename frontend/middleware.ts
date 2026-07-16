import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE = 'crt';

// Routes that require the refresh cookie to exist.
const PROTECTED_PREFIXES = ['/dashboard', '/members', '/payments', '/reports', '/plans'];
const ADMIN_PREFIXES = ['/admin'];
// Routes that logged-in users should not see.
const AUTH_ROUTES = ['/login', '/change-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(REFRESH_COOKIE);

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → login.
  if (isProtected && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting a login/change-password route → dashboard.
  // (change-password is excluded so the mustChangePassword wall still works.)
  if (isAuthRoute && pathname === '/login' && hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
