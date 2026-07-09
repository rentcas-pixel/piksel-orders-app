import type { ProcessedEmail } from '@/lib/email/types';

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/i;

export function parseAddressList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  return value
    .split(/[;,]/)
    .map((part) => parseRecipientEntry(part).email)
    .filter((part) => part.length > 0);
}

export function parseRecipientEntry(value: string): { email: string; name: string | null } {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return { email: '', name: null };

  const angleMatch = trimmed.match(/^(.+?)\s*<([^<>]+)>$/);
  if (angleMatch) {
    const email = angleMatch[2].trim();
    const name = angleMatch[1].trim();
    return { email, name: name || null };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return { email: trimmed, name: null };
  }

  return { email: trimmed, name: null };
}

export function formatRecipientEntry(email: string, name?: string | null): string {
  const trimmedEmail = email.trim();
  const trimmedName = name?.trim();
  if (trimmedName && trimmedName.toLowerCase() !== trimmedEmail.toLowerCase()) {
    return `${trimmedName} <${trimmedEmail}>`;
  }
  return trimmedEmail;
}

export function hasRecipientAddresses(toAddresses?: string[] | null): boolean {
  if (!Array.isArray(toAddresses) || toAddresses.length === 0) return false;
  return toAddresses.some((item) => Boolean(item?.trim()));
}

export function formatAddressList(addresses: string[]): string {
  return [...new Set(addresses.map((item) => item.trim()).filter(Boolean))].join(', ');
}

export function isValidAddressList(value: string): boolean {
  const addresses = parseAddressList(value);
  if (addresses.length === 0) return false;
  return addresses.every((address) => EMAIL_PATTERN.test(address));
}

export function extractAddressesFromMailparser(
  value:
    | { value?: Array<{ address?: string; name?: string }>; text?: string }
    | Array<{ value?: Array<{ address?: string; name?: string }>; text?: string }>
    | undefined
): string[] {
  if (!value) return [];

  const groups = Array.isArray(value) ? value : [value];
  const addresses: string[] = [];

  for (const group of groups) {
    for (const item of group.value ?? []) {
      const address = item.address?.trim();
      if (!address) continue;
      addresses.push(
        item.name?.trim() ? formatRecipientEntry(address, item.name) : address
      );
    }

    if ((group.value ?? []).length === 0 && group.text?.trim()) {
      for (const address of parseAddressList(group.text)) {
        if (address) addresses.push(address);
      }
    }
  }

  return [...new Set(addresses)];
}

export function extractRecipientsFromParsedMail(parsed: {
  to?: Parameters<typeof extractAddressesFromMailparser>[0];
  cc?: Parameters<typeof extractAddressesFromMailparser>[0];
  headers?: { get(name: string): unknown };
  envelope?: { to?: string[] | null; cc?: string[] | null };
}): { toAddresses: string[]; ccAddresses: string[] } {
  let toAddresses = extractAddressesFromMailparser(parsed.to);
  let ccAddresses = extractAddressesFromMailparser(parsed.cc);

  if (toAddresses.length === 0 && parsed.envelope?.to?.length) {
    toAddresses = parsed.envelope.to.map((item) => item.trim()).filter(Boolean);
  }

  if (ccAddresses.length === 0 && parsed.envelope?.cc?.length) {
    ccAddresses = parsed.envelope.cc.map((item) => item.trim()).filter(Boolean);
  }

  const headerTo = parsed.headers?.get('to');
  if (toAddresses.length === 0 && typeof headerTo === 'string') {
    toAddresses = parseAddressList(headerTo);
  }

  const headerCc = parsed.headers?.get('cc');
  if (ccAddresses.length === 0 && typeof headerCc === 'string') {
    ccAddresses = parseAddressList(headerCc);
  }

  const headerDeliveredTo = parsed.headers?.get('delivered-to');
  if (toAddresses.length === 0 && typeof headerDeliveredTo === 'string') {
    toAddresses = parseAddressList(headerDeliveredTo);
  }

  const headerXOriginalTo = parsed.headers?.get('x-original-to');
  if (toAddresses.length === 0 && typeof headerXOriginalTo === 'string') {
    toAddresses = parseAddressList(headerXOriginalTo);
  }

  return {
    toAddresses: [...new Set(toAddresses)],
    ccAddresses: [...new Set(ccAddresses)],
  };
}

export function extractRecipientsFromRawSource(source: Buffer): {
  toAddresses: string[];
  ccAddresses: string[];
} {
  const raw = source.toString('utf8', 0, Math.min(source.length, 32000));
  const headerBlock = raw.split(/\r?\n\r?\n/)[0] ?? '';
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, ' ');

  const readHeader = (name: string): string => {
    const match = unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
    return match?.[1]?.trim() ?? '';
  };

  const toAddresses = parseAddressList(readHeader('To'));
  const ccAddresses = parseAddressList(readHeader('Cc'));

  if (toAddresses.length === 0) {
    toAddresses.push(...parseAddressList(readHeader('Delivered-To')));
  }
  if (toAddresses.length === 0) {
    toAddresses.push(...parseAddressList(readHeader('X-Original-To')));
  }

  return {
    toAddresses: [...new Set(toAddresses)],
    ccAddresses: [...new Set(ccAddresses)],
  };
}

export function buildReplyRecipients(
  email: Pick<ProcessedEmail, 'from_address' | 'to_addresses' | 'cc_addresses'>,
  mailboxAddress: string,
  mode: 'reply' | 'reply-all'
): { to: string; cc: string } {
  const self = mailboxAddress.trim().toLowerCase();
  const sender = email.from_address?.trim() ?? '';

  if (mode === 'reply' || !sender) {
    return { to: sender, cc: '' };
  }

  const others = new Set<string>();
  for (const address of [...(email.to_addresses ?? []), ...(email.cc_addresses ?? [])]) {
    const normalized = address.trim().toLowerCase();
    if (!normalized || normalized === self || normalized === sender.toLowerCase()) continue;
    others.add(address.trim());
  }

  return {
    to: sender,
    cc: formatAddressList([...others]),
  };
}

export function collectEnvelopeRecipients(
  to: string,
  cc?: string,
  bcc?: string
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const address of [...parseAddressList(to), ...parseAddressList(cc), ...parseAddressList(bcc)]) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(address);
  }

  return result;
}
