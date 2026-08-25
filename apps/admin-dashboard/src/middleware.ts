import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_access_token')?.value;
  const role = request.cookies.get('admin_user_role')?.value;
  const pathname = request.nextUrl.pathname;

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-specific protection: only staff & admin roles allowed in admin dashboard
    const allowedRoles = [
      'super_admin',
      'admin',
      'cinema_admin',
      'staff',
      'gate_checker',
    ];
    if (role && !allowedRoles.includes(role.toLowerCase())) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized_role');
      return NextResponse.redirect(loginUrl);
    }
  }

  // If already logged in and visiting /login or root /, redirect to /dashboard
  if ((pathname === '/login' || pathname === '/') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
};
