import { NextResponse, type NextRequest } from 'next/server';
import { guardAdminFinanceApi, updateMainAppSession, updateSupabaseSession } from '@/lib/supabase/middleware';
import {
  AGENCY_PORTAL_BASE,
  isAgencyPortalPath,
  isAgencyPublicHost,
  isAgencyPublicLoginPath,
} from '@/lib/agency-portal-paths';

function isAdminFinanceApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/email') ||
    pathname.startsWith('/api/ocr/received-invoice') ||
    pathname.startsWith('/api/received-invoices')
  );
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  if (isAdminFinanceApiPath(pathname) && !isAgencyPublicHost(host)) {
    const denied = await guardAdminFinanceApi(request);
    if (denied) return denied;
  }

  // Senas kelias /agency/* → /piksel/agency/*
  if (pathname === '/agency' || pathname.startsWith('/agency/')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `${AGENCY_PORTAL_BASE}${pathname.slice('/agency'.length)}`;
    return NextResponse.redirect(redirectUrl);
  }

  // agency.piksel.lt — švarūs URL (/login, /)
  if (isAgencyPublicHost(host)) {
    if (pathname.startsWith(AGENCY_PORTAL_BASE)) {
      const suffix = pathname.slice(AGENCY_PORTAL_BASE.length);
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = suffix === '/login' || suffix === '' ? (suffix || '/') : '/';
      if (redirectUrl.pathname !== pathname) {
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (pathname === '/login') {
      return updateSupabaseSession(
        request,
        { loginPath: '/login', isAgencyLogin: true, isAgencyRoute: true },
        '/piksel/agency/login'
      );
    }

    if (pathname === '/') {
      return updateSupabaseSession(
        request,
        { loginPath: '/login', isAgencyLogin: false, isAgencyRoute: true },
        '/piksel/agency'
      );
    }

    if (pathname.startsWith('/api')) {
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  if (isAgencyPortalPath(pathname)) {
    return updateSupabaseSession(request);
  }

  if (pathname === '/' || pathname === '/login') {
    return updateMainAppSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/agency', '/agency/:path*', '/piksel/agency', '/piksel/agency/:path*'],
};
