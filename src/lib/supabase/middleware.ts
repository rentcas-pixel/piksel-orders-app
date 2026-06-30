import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/config';
import type { AppRole } from '@/lib/app-permissions';
import {
  AGENCY_LOGIN_PATH,
  AGENCY_PORTAL_BASE,
  isAgencyLoginPath,
  isAgencyPortalPath,
  isAgencyPublicHost,
  isAgencyPublicLoginPath,
  resolveAgencyUrlPaths,
} from '@/lib/agency-portal-paths';

interface SessionGuardOptions {
  loginPath: string;
  isAgencyLogin: boolean;
  isAgencyRoute: boolean;
}

function createSessionResponse(request: NextRequest, rewritePathname?: string) {
  return rewritePathname
    ? NextResponse.rewrite(new URL(rewritePathname, request.url))
    : NextResponse.next({ request });
}

async function resolveAppRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<'admin' | 'staff' | 'agency_only' | 'forbidden'> {
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (appUser?.role === 'admin' || appUser?.role === 'staff') {
    return appUser.role as AppRole;
  }

  const { data: agencyLink } = await supabase
    .from('agency_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (agencyLink) return 'agency_only';
  return 'forbidden';
}

export async function updateSupabaseSession(
  request: NextRequest,
  guard?: SessionGuardOptions,
  rewritePathname?: string
) {
  let response = createSessionResponse(request, rewritePathname);
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;
  const urlPaths = resolveAgencyUrlPaths(host);

  const isAgencyLogin =
    guard?.isAgencyLogin ??
    (isAgencyPublicHost(host) ? isAgencyPublicLoginPath(pathname) : isAgencyLoginPath(pathname));
  const isAgencyRoute =
    guard?.isAgencyRoute ??
    (isAgencyPublicHost(host)
      ? pathname === '/' || isAgencyPublicLoginPath(pathname)
      : isAgencyPortalPath(pathname));
  const loginPath = guard?.loginPath ?? urlPaths.login;

  const supabase = createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = createSessionResponse(request, rewritePathname);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAgencyRoute && !isAgencyLogin && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPath;
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

const APP_LOGIN_PATH = '/login';

export async function updateMainAppSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isLogin = pathname === APP_LOGIN_PATH;

  const supabase = createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLogin) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = APP_LOGIN_PATH;
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  const role = await resolveAppRole(supabase, user.id);

  if (role === 'agency_only') {
    const agencyUrl = request.nextUrl.clone();
    agencyUrl.pathname = AGENCY_PORTAL_BASE;
    agencyUrl.search = '';
    return NextResponse.redirect(agencyUrl);
  }

  if (role === 'forbidden') {
    if (isLogin) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = APP_LOGIN_PATH;
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

/** @deprecated Naudoti resolveAgencyUrlPaths */
export { AGENCY_LOGIN_PATH };

export async function guardAdminFinanceApi(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Neprisijungęs.', code: 'anonymous' }, { status: 401 });
  }

  const role = await resolveAppRole(supabase, user.id);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Neturite prieigos.', code: 'forbidden' }, { status: 403 });
  }

  return null;
}
