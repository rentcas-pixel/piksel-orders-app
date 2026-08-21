/**
 * Viešos confirm nuorodos bazė.
 * Prod: https://piksel.lt
 * Lokalus: http://localhost:3000 (arba NEXT_PUBLIC_CONFIRM_BASE_URL)
 */
export function getPartnerConfirmBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_CONFIRM_BASE_URL?.trim() ||
    process.env.PARTNER_CONFIRM_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  return 'https://piksel.lt';
}

export function buildPartnerConfirmUrl(token: string): string {
  const base = getPartnerConfirmBaseUrl();
  return `${base}/c/${encodeURIComponent(token)}`;
}
