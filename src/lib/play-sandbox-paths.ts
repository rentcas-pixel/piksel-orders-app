/** Player / klipų / test orderių sandbox — tik play.piksel.lt (ir localhost dev). */
export const PLAY_PUBLIC_HOST = 'play.piksel.lt';

export const HUB_PRODUCTION_HOST = 'hub.piksel.lt';

const PLAY_SANDBOX_EXACT_PATHS = new Set([
  '/inbox',
  '/test-orders',
  '/test-pocketbase',
  '/monitoring',
  '/devices',
  '/media',
  /** Tik root — `/calculator/[orderId]` lieka Hub produkcijoje. */
  '/calculator',
]);

export function normalizeHost(host: string): string {
  return host.split(':')[0].toLowerCase();
}

export function isPlayPublicHost(host: string): boolean {
  return normalizeHost(host) === PLAY_PUBLIC_HOST;
}

export function isHubProductionHost(host: string): boolean {
  return normalizeHost(host) === HUB_PRODUCTION_HOST;
}

/** Sandbox UI maršrutai (devices, media, test orderiai, monitoring). */
export function isPlaySandboxRoute(pathname: string): boolean {
  if (PLAY_SANDBOX_EXACT_PATHS.has(pathname)) return true;
  return pathname.startsWith('/devices/') || pathname.startsWith('/media/');
}

/** Kur rodyti / leisti sandbox (play + local dev). */
export function isPlaySandboxHost(host: string): boolean {
  const h = normalizeHost(host);
  if (h === PLAY_PUBLIC_HOST) return true;
  return h === 'localhost' || h === '127.0.0.1';
}

export function isPlaySandboxEnabled(host: string): boolean {
  return isPlaySandboxHost(host);
}

/** Hub produkcijoje — blokuoti tiesioginę prieigą prie sandbox maršrutų. */
export function shouldBlockPlaySandboxOnHost(host: string, pathname: string): boolean {
  return isHubProductionHost(host) && isPlaySandboxRoute(pathname);
}
