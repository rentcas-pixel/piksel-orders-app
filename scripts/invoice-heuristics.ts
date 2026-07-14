const NON_IMPORTABLE_FILENAME_PATTERNS = [
  /\bswed\b/i,
  /\bseb\b/i,
  /\bluminor\b/i,
  /\bcitadele\b/i,
  /\brevolut\b/i,
  /\bwise\b/i,
  /isras/i,
  /išraš/i,
  /\bstatement\b/i,
  /\bbank/i,
  /sutart/i,
  /\bcontract\b/i,
  /\bagreement\b/i,
  /\btnt[_-]/i,
  /\bdhl\b/i,
  /\bups\b/i,
  /courier/i,
  /siuntos/i,
  /važtarašt/i,
  /transaction[_\s-]?no/i,
  /operacij/i,
  /videoarchitekt/i,
  /diodu[-_]?architekt/i,
  /\bval-\d+/i,
  /screenshot/i,
  /isipareigojim/i,
];

const IMPORTABLE_FILENAME_PATTERNS = [
  /invoice/i,
  /saskait/i,
  /sąskait/i,
  /\bbill\b/i,
  /receipt/i,
  /faktur/i,
  /\bpvm\b/i,
  /\bmcs/i,
  /\bele\d/i,
  /\bta\d/i,
  /\bpkl\b/i,
  /\bdf_/i,
  /\bgijo_/i,
  /\bvia\d/i,
  /mongodb/i,
  /nordika/i,
  /ecovacs/i,
  /eurovaist/i,
  /regitra/i,
  /vatinvoice/i,
  /^\d{4,}\.pdf$/i,
];

const UUID_IMAGE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-\d+)?\.(jpe?g|png|webp)$/i;

const VIDEOARCH_FILENAME_PATTERNS = [
  /videoarchitekt/i,
  /diodu[-_]?architekt/i,
  /\bgijo_/i,
  /\bvia\d/i,
  /\bpkl\s+\d/i,
  /\bdet\d+/i,
  /\bdf_\d/i,
  /\bsf\s+\d{4}-\d{2}/i,
  /\bmc\d/i,
  /\bmcš/i,
  /\bevsa\b/i,
  /202606-\d+\s+dom/i,
];

export function isSupportedInvoiceFilename(filename: string): boolean {
  const name = filename.toLowerCase();
  return name.endsWith('.pdf') || /\.(jpe?g|png|webp)$/i.test(name);
}

export function isNonImportableFilename(filename: string): boolean {
  const name = filename.trim();
  if (!name) return true;
  return NON_IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function isUuidOnlyImageFilename(filename: string): boolean {
  return UUID_IMAGE_PATTERN.test(filename.trim());
}

export function isVideoarchitektaiFilename(filename: string): boolean {
  return VIDEOARCH_FILENAME_PATTERNS.some((pattern) => pattern.test(filename));
}

export function isImportableInvoiceFilename(filename: string): boolean {
  if (!isSupportedInvoiceFilename(filename)) return false;
  if (isNonImportableFilename(filename)) return false;
  if (isUuidOnlyImageFilename(filename)) return false;
  if (isVideoarchitektaiFilename(filename)) return false;
  return IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(filename));
}

export function getSkipReason(filename: string): string | null {
  if (!isSupportedInvoiceFilename(filename)) return 'Nepalaikomas formatas';
  if (isVideoarchitektaiFilename(filename)) return 'Videoarchitektų dokumentas';
  if (isUuidOnlyImageFilename(filename)) return 'Kvitai be aiškaus pavadinimo';
  if (isNonImportableFilename(filename)) return 'Ne sąskaita (bankas, kurjeris, sutartis ir pan.)';
  if (!IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(filename))) {
    return 'Neatpažintas kaip sąskaita';
  }
  return null;
}
