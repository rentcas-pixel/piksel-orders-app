import { getCanonicalAgencyLabel, normalizeAgencyKey } from '@/lib/agency-names';

const PRODUCTION_PHOTO_PROOF_BASE_URL =
  'https://photo-management-system-tan.vercel.app';

const LOCAL_PHOTO_PROOF_BASE_URL = 'http://localhost:3000';

/** Photo Proof `agencies.unique_slug` pagal kanoninį agentūros pavadinimą */
const PHOTO_PROOF_SLUGS: Record<string, string> = {
  open: 'open-789d476a',
};

function photoProofBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PHOTO_PROOF_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_PHOTO_PROOF_BASE_URL;
  }
  return PRODUCTION_PHOTO_PROOF_BASE_URL;
}

export function getPhotoProofSlug(agency: string): string | null {
  const canonical = normalizeAgencyKey(getCanonicalAgencyLabel(agency));
  if (!canonical) return null;
  return PHOTO_PROOF_SLUGS[canonical] ?? null;
}

export function getPhotoProofUrl(
  agency: string,
  options?: { embed?: boolean }
): string | null {
  const slug = getPhotoProofSlug(agency);
  if (!slug) return null;
  const base = `${photoProofBaseUrl()}/${slug}`;
  return options?.embed ? `${base}?embed=1` : base;
}
