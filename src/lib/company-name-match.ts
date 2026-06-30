function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
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

export function foldSearchText(value: string | null | undefined): string {
  return stripDiacritics(normalizeText(value));
}

/** Tik raidės ir skaičiai — be kabučių, taškų, tarpų, UAB ir pan. */
export function coreCompanyName(value: string | null | undefined): string {
  return stripDiacritics(normalizeText(value))
    .replace(/["'„""''«»`]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const LEGAL_FORM_PREFIX_RE =
  /^(uab|mb|ab|vsi|imone|akcinebendrove|akcinbendrove|uzdarojiakcinebendrove|individualijiveikla|privatiimone)/;
const LEGAL_FORM_SUFFIX_RE = /(uab|mb|ab|vsi|imone)$/;

/** Pašalina LT juridinės formos prefiksus (UAB, AB, Akcinė bendrovė ir pan.). */
export function normalizeCompanyName(value: string | null | undefined): string {
  let core = coreCompanyName(value);
  while (LEGAL_FORM_PREFIX_RE.test(core)) {
    core = core.replace(LEGAL_FORM_PREFIX_RE, '');
  }
  return core.replace(LEGAL_FORM_SUFFIX_RE, '');
}

export function companyNameMatches(
  haystackRaw: string | null | undefined,
  companyRaw: string | null | undefined
): boolean {
  if (!haystackRaw || !companyRaw) return false;
  const companyCore = normalizeCompanyName(companyRaw);
  const haystackCore = coreCompanyName(haystackRaw);
  const haystackNormalized = normalizeCompanyName(haystackRaw);
  if (!companyCore || companyCore.length < 3) return false;

  if (
    haystackCore.includes(companyCore) ||
    companyCore.includes(haystackCore) ||
    haystackNormalized === companyCore
  ) {
    return true;
  }

  const stem = companyCore.slice(0, Math.min(6, companyCore.length));
  if (stem.length >= 4 && haystackCore.includes(stem)) return true;

  const companyTokens = companyCore.match(/[a-z0-9]{4,}/g) ?? [];
  return companyTokens.some((token) => haystackCore.includes(token.slice(0, Math.min(6, token.length))));
}

export function isPikInvoiceNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\bpik\s*\d+/i.test(value.trim());
}
