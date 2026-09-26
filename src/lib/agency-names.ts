/** Kanoniniai agentūrų pavadinimai (sutampa su AgencyAnalysis) */
const AGENCY_CANONICAL: Record<string, string> = {
  bpn: 'BPN',
  omg: 'OMG',
  omd: 'OMD',
  mbd: 'MBD',
  dentsu: 'Dentsu',
  carat: 'Carat',
  mediacom: 'Mediacom',
  mindshare: 'Mindshare',
  'media house': 'Media House',
  'arena media': 'Arena Media',
  havas: 'Havas Media',
  'havas media': 'Havas Media',
  'publicis groupe': 'Publicis Groupe',
  open: 'Open',
  'open agency': 'Open',
};

export function normalizeAgencyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCanonicalAgencyLabel(value: string): string {
  const raw = value.trim();
  if (!raw || raw === '-') return 'Nepriskirta';
  return AGENCY_CANONICAL[normalizeAgencyKey(raw)] || raw;
}

export const CANONICAL_AGENCY_OPTIONS = [...new Set(Object.values(AGENCY_CANONICAL))].sort((a, b) =>
  a.localeCompare(b, 'lt')
);

/** Dažniau naudotas agentūras kelia į sąrašo viršų. */
export function sortAgenciesByOrderFrequency(
  options: string[] = CANONICAL_AGENCY_OPTIONS,
  agencies: string[] = []
): string[] {
  const counts = new Map<string, number>();
  for (const raw of agencies) {
    const label = getCanonicalAgencyLabel(raw);
    if (label === 'Nepriskirta') continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...options].sort((a, b) => {
    const diff = (counts.get(b) || 0) - (counts.get(a) || 0);
    return diff !== 0 ? diff : a.localeCompare(b, 'lt');
  });
}

export function agencyMatchesFilter(orderAgency: string, selectedAgency: string): boolean {
  const orderKey = normalizeAgencyKey(orderAgency);
  const selectedKey = normalizeAgencyKey(selectedAgency);
  if (!selectedKey) return true;
  if (orderKey === selectedKey) return true;
  const orderCanonical = normalizeAgencyKey(getCanonicalAgencyLabel(orderAgency));
  const selectedCanonical = normalizeAgencyKey(getCanonicalAgencyLabel(selectedAgency));
  return orderCanonical === selectedCanonical || orderKey.includes(selectedKey) || selectedKey.includes(orderKey);
}
