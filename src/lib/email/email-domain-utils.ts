const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
  'inbox.lt',
  'mail.ru',
]);

export function extractEmailDomain(address: string | null | undefined): string | null {
  if (!address?.includes('@')) return null;
  const domain = address.split('@')[1]?.trim().toLowerCase();
  return domain || null;
}

export function isCompanyDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  if (GENERIC_EMAIL_DOMAINS.has(domain)) return false;
  if (domain.endsWith('.gmail.com')) return false;
  return domain.includes('.');
}

export function guessCompanyNameFromDomain(domain: string): string {
  const label = domain.split('.')[0] ?? domain;
  return label
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
