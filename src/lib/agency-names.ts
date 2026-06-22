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

export function agencyMatchesFilter(orderAgency: string, selectedAgency: string): boolean {
  const orderKey = normalizeAgencyKey(orderAgency);
  const selectedKey = normalizeAgencyKey(selectedAgency);
  if (!selectedKey) return true;
  if (orderKey === selectedKey) return true;
  const orderCanonical = normalizeAgencyKey(getCanonicalAgencyLabel(orderAgency));
  const selectedCanonical = normalizeAgencyKey(getCanonicalAgencyLabel(selectedAgency));
  return orderCanonical === selectedCanonical || orderKey.includes(selectedKey) || selectedKey.includes(orderKey);
}
