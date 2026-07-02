import { getCanonicalAgencyLabel, normalizeAgencyKey } from '@/lib/agency-names';

const PRODUCTION_PHOTO_PROOF_BASE_URL =
  'https://photo-management-system-tan.vercel.app';

const LOCAL_PHOTO_PROOF_BASE_URL = 'http://localhost:3000';

/** Photo Proof `agencies.unique_slug` pagal kanoninį agentūros pavadinimą arba agencies.slug */
const PHOTO_PROOF_SLUGS: Record<string, string> = {
  open: 'open-789d476a',
  'media house': 'media-house-ldeii5fk',
};

const PHOTO_PROOF_SLUGS_BY_AGENCY_SLUG: Record<string, string> = {
  open: 'open-789d476a',
  'media-house': 'media-house-ldeii5fk',
};

function photoProofBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PHOTO_PROOF_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_PHOTO_PROOF_BASE_URL;
  }
  return PRODUCTION_PHOTO_PROOF_BASE_URL;
}

export function getPhotoProofSlug(agency: string, agencySlug?: string | null): string | null {
  if (agencySlug?.trim()) {
    const bySlug = PHOTO_PROOF_SLUGS_BY_AGENCY_SLUG[agencySlug.trim().toLowerCase()];
    if (bySlug) return bySlug;
  }
  const canonical = normalizeAgencyKey(getCanonicalAgencyLabel(agency));
  if (!canonical) return null;
  return PHOTO_PROOF_SLUGS[canonical] ?? null;
}

export function getPhotoProofUrl(
  agency: string,
  options?: { embed?: boolean; agencySlug?: string | null }
): string | null {
  const slug = getPhotoProofSlug(agency, options?.agencySlug);
  if (!slug) return null;
  const base = `${photoProofBaseUrl()}/${slug}`;
  return options?.embed ? `${base}?embed=1` : base;
}
