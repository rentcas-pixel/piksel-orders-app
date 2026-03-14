export function extractDateOnly(value: string): string {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : value.trim();
}

export function parseDateOnlyLocal(value: string): Date | null {
  const dateOnly = extractDateOnly(value);
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!y || !m || !d) return null;

  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;

  // Guard against invalid overflow dates (e.g. 2026-02-31).
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }

  return parsed;
}

export function formatDateInputValue(value: string): string {
  const parsed = parseDateOnlyLocal(value);
  if (!parsed) return value;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysInclusiveBetween(start: Date, end: Date): number {
  if (start > end) return 0;
  // Compare by calendar day in UTC to avoid DST shifts affecting day counts.
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = endUtc - startUtc;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}
