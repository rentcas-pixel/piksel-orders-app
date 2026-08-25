import { isPikselPartner } from '@/lib/partner-contacts';

export type PartnerConfirmAlertRow = {
  order_id: string;
  partner_id: string;
  partner_name: string;
  confirmed_at: string | null;
};

/** Kalendorinės dienos iki užsakymo `from` (vietinė TZ). Neigiama = jau prasidėjo. */
export function daysUntilBroadcastStart(from: string, now = new Date()): number | null {
  const raw = String(from || '').trim();
  if (!raw) return null;
  const start = parseOrderDateLocal(raw);
  if (!start) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isPartnerConfirmAlertWindow(daysUntil: number | null): boolean {
  return daysUntil != null && daysUntil <= 1;
}

export function unconfirmedPartnerNames(rows: PartnerConfirmAlertRow[]): string[] {
  const byPartner = new Map<
    string,
    { name: string; confirmed: boolean }
  >();

  for (const row of rows) {
    if (!row.partner_id || isPikselPartner(row.partner_name)) continue;
    const prev = byPartner.get(row.partner_id);
    const confirmed = Boolean(row.confirmed_at) || Boolean(prev?.confirmed);
    byPartner.set(row.partner_id, {
      name: (prev?.name || row.partner_name || '').trim() || row.partner_id,
      confirmed,
    });
  }

  return [...byPartner.values()]
    .filter((partner) => !partner.confirmed)
    .map((partner) => partner.name)
    .sort((a, b) => a.localeCompare(b, 'lt'));
}

export function alertsByOrderId(
  rows: PartnerConfirmAlertRow[]
): Record<string, string[]> {
  const grouped = new Map<string, PartnerConfirmAlertRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.order_id) || [];
    list.push(row);
    grouped.set(row.order_id, list);
  }

  const alerts: Record<string, string[]> = {};
  for (const [orderId, orderRows] of grouped) {
    const names = unconfirmedPartnerNames(orderRows);
    if (names.length) alerts[orderId] = names;
  }
  return alerts;
}

function parseOrderDateLocal(value: string): Date | null {
  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
