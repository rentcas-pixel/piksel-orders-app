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

// Own issued / internal docs that sometimes land in the watch folder.
// Do NOT match bare "Videoarchitektai" or DF_ — suppliers put the buyer name in
// filenames, and DF_ is Digital Foot (UAB Skaitmeninė Pėda) received invoices.
const VIDEOARCH_FILENAME_PATTERNS = [
  /diodu[-_]?architekt/i,
  /\bdet\d+/i,
  /\bsf\s+\d{4}-\d{2}/i,
  /\bmcš/i,
  /\bevsa\b/i,
  /^PIK[\s_-]*\d+/i,
];

/** macOS often stores Lithuanian filenames as NFD; regexes use NFC forms. */
function normalizeFilename(filename: string): string {
  return filename.normalize('NFC').trim();
}

export function isSupportedInvoiceFilename(filename: string): boolean {
  const name = normalizeFilename(filename).toLowerCase();
  return name.endsWith('.pdf') || /\.(jpe?g|png|webp)$/i.test(name);
}

export function isNonImportableFilename(filename: string): boolean {
  const name = normalizeFilename(filename);
  if (!name) return true;
  return NON_IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function isUuidOnlyImageFilename(filename: string): boolean {
  return UUID_IMAGE_PATTERN.test(normalizeFilename(filename));
}

export function isVideoarchitektaiFilename(filename: string): boolean {
  return VIDEOARCH_FILENAME_PATTERNS.some((pattern) => pattern.test(normalizeFilename(filename)));
}

export function isImportableInvoiceFilename(filename: string): boolean {
  const name = normalizeFilename(filename);
  if (!isSupportedInvoiceFilename(name)) return false;
  if (isNonImportableFilename(name)) return false;
  if (isUuidOnlyImageFilename(name)) return false;
  if (isVideoarchitektaiFilename(name)) return false;
  return IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function getSkipReason(filename: string): string | null {
  const name = normalizeFilename(filename);
  if (!isSupportedInvoiceFilename(name)) return 'Nepalaikomas formatas';
  if (isVideoarchitektaiFilename(name)) return 'Videoarchitektų dokumentas';
  if (isUuidOnlyImageFilename(name)) return 'Kvitai be aiškaus pavadinimo';
  if (isNonImportableFilename(name)) return 'Ne sąskaita (bankas, kurjeris, sutartis ir pan.)';
  if (!IMPORTABLE_FILENAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return 'Neatpažintas kaip sąskaita';
  }
  return null;
}
