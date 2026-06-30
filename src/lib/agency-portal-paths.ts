/** Vidinis kelias (app.piksel.lt / localhost). */
export const AGENCY_PORTAL_BASE = '/piksel/agency';

export const AGENCY_LOGIN_PATH = `${AGENCY_PORTAL_BASE}/login`;

/** Produkcijos agentūrų subdomenas. */
export const AGENCY_PUBLIC_HOST = 'agency.piksel.lt';

export function normalizeHost(host: string): string {
  return host.split(':')[0].toLowerCase();
}

export function isAgencyPublicHost(host: string): boolean {
  return normalizeHost(host) === AGENCY_PUBLIC_HOST;
}

export function isAgencyPortalPath(pathname: string): boolean {
  return pathname === AGENCY_PORTAL_BASE || pathname.startsWith(`${AGENCY_PORTAL_BASE}/`);
}

export function isAgencyLoginPath(pathname: string): boolean {
  return pathname === AGENCY_LOGIN_PATH;
}

export interface AgencyUrlPaths {
  portal: string;
  login: string;
}

/** Vieši URL pagal host (server arba client). */
export function resolveAgencyUrlPaths(host: string): AgencyUrlPaths {
  if (isAgencyPublicHost(host)) {
    return { portal: '/', login: '/login' };
  }
  return { portal: AGENCY_PORTAL_BASE, login: AGENCY_LOGIN_PATH };
}

export function getClientAgencyPaths(): AgencyUrlPaths {
  if (typeof window === 'undefined') {
    return { portal: AGENCY_PORTAL_BASE, login: AGENCY_LOGIN_PATH };
  }
  return resolveAgencyUrlPaths(window.location.host);
}

export function isAgencyPublicLoginPath(pathname: string): boolean {
  return pathname === '/login';
}

export function isAgencyPublicPortalPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/login';
}
