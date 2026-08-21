/** Partnerių el. paštų katalogas. */

export type PartnerContact = {
  emails: string[];
  /** Jei true — Siųsti praleidžia (Piksel Live ir pan.) */
  skipSend?: boolean;
};

const DEFAULT_CONTACTS: Record<string, PartnerContact> = {
  piksel: { emails: [], skipSend: true },
  owexx: { emails: ['elena@owexx.com'] },
  biciulis: { emails: ['asta@pbiciulis.lt'] },
  gijota: { emails: ['egle@gijota.lt'] },
  marijampole: { emails: ['ledboxekranai@gmail.com'] },
  utena: { emails: ['ignas.ekranas@gmail.com'] },
};

function normalizePartnerKey(nameOrSlug: string): string {
  return String(nameOrSlug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Env override: PARTNER_EMAIL_OWEXX=a@b.lt,c@d.lt */
function envEmailsForPartner(key: string): string[] | null {
  const envKey = `PARTNER_EMAIL_${key.toUpperCase()}`;
  const raw = process.env[envKey]?.trim();
  if (!raw) return null;
  return raw
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isPikselPartner(nameOrSlug: string): boolean {
  const key = normalizePartnerKey(nameOrSlug);
  return key === 'piksel' || key.startsWith('piksel');
}

export function shouldSkipPartnerPlanSend(nameOrSlug: string): boolean {
  if (isPikselPartner(nameOrSlug)) return true;
  const key = normalizePartnerKey(nameOrSlug);
  const contact = DEFAULT_CONTACTS[key];
  return Boolean(contact?.skipSend);
}

/**
 * Gavėjų sąrašas partnerio planui / klipams.
 * PARTNER_TEST_TO — jei nustatytas, VISI partneriai (išskyrus Piksel) gauna tik šį adresą.
 * Be jo — katalogas / PARTNER_EMAIL_* ; nežinomas → skipped.
 */
export function resolvePartnerPlanEmails(
  nameOrSlug: string
): { emails: string[]; skipped: boolean; reason?: string } {
  if (shouldSkipPartnerPlanSend(nameOrSlug)) {
    return { emails: [], skipped: true, reason: 'Piksel / skip' };
  }

  const testOverride = process.env.PARTNER_TEST_TO?.trim();
  if (testOverride) {
    return { emails: [testOverride], skipped: false };
  }

  const key = normalizePartnerKey(nameOrSlug);
  const fromEnv = envEmailsForPartner(key);
  if (fromEnv?.length) {
    return { emails: fromEnv, skipped: false };
  }

  const contact = DEFAULT_CONTACTS[key];
  if (contact?.emails?.length) {
    return { emails: contact.emails, skipped: false };
  }

  return {
    emails: [],
    skipped: true,
    reason: `Nėra el. pašto partneriui „${nameOrSlug}“`,
  };
}
