import { companyNameMatches, coreCompanyName, normalizeCompanyName } from '@/lib/company-name-match';
import {
  canonicalSkleriaiName,
  fixBalticMojibake,
  isGarbledSkleriaiText,
  normalizeKnownCompanyText,
} from '@/lib/bank-csv-encoding';

const IBAN_ONLY_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,34}$/i;

export function isIbanOnly(value: string | null | undefined): boolean {
  if (!value) return false;
  return IBAN_ONLY_RE.test(value.replace(/\s/g, ''));
}

export function extractCompanyFromBankText(text: string): string | undefined {
  const trimmed = fixBalticMojibake(text).trim();
  if (!trimmed) return undefined;

  if (isGarbledSkleriaiText(trimmed) || /šklėr|skler/i.test(stripDiacritics(trimmed))) {
    return canonicalSkleriaiName();
  }

  const uabMatch = trimmed.match(
    /((?:UAB|MB|AB|VšĮ|IĮ)\s*\.?\s*["«„']?[^"|/\\]+["»""']?)/i
  );
  if (uabMatch) return normalizeKnownCompanyText(uabMatch[1].replace(/\s+/g, ' ').trim());

  const skleriai = trimmed.match(/\b(Šklėriai|ŠKLĖRIAI|Skleriai|SKLERIAI)\b/i);
  if (skleriai) return canonicalSkleriaiName();

  return undefined;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ąàá]/gi, 'a')
    .replace(/[čć]/gi, 'c')
    .replace(/[ęèé]/gi, 'e')
    .replace(/[ė]/gi, 'e')
    .replace(/[įìí]/gi, 'i')
    .replace(/[šś]/gi, 's')
    .replace(/[ųùú]/gi, 'u')
    .replace(/[ū]/gi, 'u')
    .replace(/[žź]/gi, 'z');
}

/** Iš banko lauko parenka geriausią kontrahento pavadinimą sudengimui. */
export function resolveBankCounterparty(
  counterparty?: string | null,
  description?: string | null
): string {
  const party = fixBalticMojibake(counterparty?.trim() ?? '');
  const desc = fixBalticMojibake(description?.trim() ?? '');

  if (party && !isIbanOnly(party)) {
    const fromParty = extractCompanyFromBankText(party);
    if (fromParty) return fromParty;
    if (normalizeCompanyName(party).length >= 3) return party;
  }

  const fromDesc = extractCompanyFromBankText(desc);
  if (fromDesc) return fromDesc;

  if (party && !isIbanOnly(party)) return party;
  if (desc) return desc;
  return 'Nežinomas';
}

export function bankPaymentMatchesCompany(
  counterparty: string | null | undefined,
  description: string | null | undefined,
  companyName: string | null | undefined
): boolean {
  if (!companyName?.trim()) return false;

  const resolved = resolveBankCounterparty(counterparty, description);
  const haystack = `${resolved} ${counterparty ?? ''} ${description ?? ''}`.trim();

  if (companyNameMatches(haystack, companyName)) return true;
  if (companyNameMatches(resolved, companyName)) return true;

  const companyCore = normalizeCompanyName(companyName);
  const resolvedCore = normalizeCompanyName(resolved);
  if (companyCore && resolvedCore && companyCore === resolvedCore) return true;

  const haystackCore = coreCompanyName(haystack);
  return companyCore.length >= 4 && haystackCore.includes(companyCore);
}
