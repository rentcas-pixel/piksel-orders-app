/**
 * Sąskaitos būsenos logika (vienas šaltinis).
 *
 * Šaltiniai:
 * 1. DB sąskaitos (coverage) – automatinis „išrašyta“ pagal sąskaitos periodą
 * 2. order_invoice_month_flags – rankinis žymėjimas kelių mėnesių užsakymams (per mėnesį)
 * 3. order_invoice_status (legacy) – tik vieno mėnesio užsakymams
 *
 * Kelių mėnesių užsakymams legacy NENAUDOJAMAS mėnesio rodinyje (ne „išsilieja“ per mėnesius).
 * „Visi + metai“ rodo suvestinę: išrašyta jei bent viename mėnesyje yra coverage arba vėliava.
 */

import { resolveListMonthYear } from '@/lib/orders-filters';
import { getMonthlyDistribution, isMultiMonthOrder } from '@/lib/invoice-utils';
import type { Order, OrderInvoiceStatus } from '@/types';

export interface BillingMonthContext {
  month: string;
  year: string;
}

export interface MonthInvoiceStatus {
  invoice_issued: boolean;
  invoice_sent: boolean;
}

export interface OrderInvoiceCoverage {
  orderId: string;
  invoiceId: string;
  periodFrom: string | null;
  periodTo: string | null;
  invoiceDate: string;
}

export interface BillingMonthInvoiceFlags {
  invoice_issued: boolean;
  invoice_sent: boolean;
}

type ResolutionMode = 'global' | 'year' | 'month';

export const emptyBillingMonthInvoiceFlags = (): BillingMonthInvoiceFlags => ({
  invoice_issued: false,
  invoice_sent: false,
});

export function billingMonthDateRange(
  year: string,
  month: string
): { from: string; to: string } | null {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!year || !month || Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    return null;
  }
  const monthStr = String(m).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${monthStr}-01`,
    to: `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function periodsOverlap(
  aFrom: string | null | undefined,
  aTo: string | null | undefined,
  bFrom: string,
  bTo: string
): boolean {
  if (!aFrom || !aTo) return false;
  return aFrom <= bTo && aTo >= bFrom;
}

/** Užsakymų „išrašyta“ būsenai — pagal sąskaitos periodą. Sąskaitų sąrašui naudokite invoiceMatchesPeriod. */
export function invoiceMatchesBillingMonth(
  invoice: {
    invoice_date: string;
    period_from?: string | null;
    period_to?: string | null;
  },
  month: string,
  year: string
): boolean {
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(month, year);
  if (!resolvedYear) return true;

  if (!resolvedMonth) {
    if (invoice.invoice_date.startsWith(`${resolvedYear}-`)) return true;
    const yearStart = `${resolvedYear}-01-01`;
    const yearEnd = `${resolvedYear}-12-31`;
    return periodsOverlap(invoice.period_from, invoice.period_to, yearStart, yearEnd);
  }

  return periodCoversBillingMonth(
    invoice.period_from,
    invoice.period_to,
    invoice.invoice_date,
    { month: resolvedMonth, year: resolvedYear }
  );
}

export function periodCoversBillingMonth(
  periodFrom: string | null | undefined,
  periodTo: string | null | undefined,
  invoiceDate: string | null | undefined,
  billing: BillingMonthContext
): boolean {
  const range = billingMonthDateRange(billing.year, billing.month);
  if (!range) return false;

  if (periodFrom && periodTo && periodsOverlap(periodFrom, periodTo, range.from, range.to)) {
    return true;
  }

  if (invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    const [iy, im] = invoiceDate.split('-');
    return iy === billing.year && im === billing.month.padStart(2, '0');
  }

  return false;
}

export function nextInvoiceStatusOnToggle(
  current: BillingMonthInvoiceFlags,
  field: 'invoice_issued' | 'invoice_sent',
  value: boolean
): BillingMonthInvoiceFlags {
  let invoice_issued = field === 'invoice_issued' ? value : current.invoice_issued;
  let invoice_sent =
    field === 'invoice_sent'
      ? value
      : field === 'invoice_issued' && !value
        ? false
        : current.invoice_sent;

  if (field === 'invoice_sent' && value) {
    invoice_issued = true;
  }

  return { invoice_issued, invoice_sent };
}

export function monthFlagKey(orderId: string, year: string, month: string): string {
  return `${orderId}:${year}:${parseInt(month, 10)}`;
}

/** @deprecated use monthFlagKey */
export const monthSentFlagKey = monthFlagKey;

export function resolveBillingContext(
  month: string,
  year: string
): BillingMonthContext | null {
  const resolved = resolveListMonthYear(month, year);
  if (!resolved.year) return null;
  return { month: resolved.month, year: resolved.year };
}

export function orderBillingMonthsInYear(order: Order, year: string): BillingMonthContext[] {
  if (!order.from || !order.to) return [];
  const yearNum = parseInt(year, 10);
  if (Number.isNaN(yearNum)) return [];

  return getMonthlyDistribution(order.from, order.to, order.final_price ?? 1)
    .filter((entry) => entry.year === yearNum)
    .map((entry) => ({
      month: String(entry.month).padStart(2, '0'),
      year: String(yearNum),
    }));
}

export function billingMonthsCoveredByInvoice(coverage: OrderInvoiceCoverage): BillingMonthContext[] {
  if (coverage.periodFrom && coverage.periodTo) {
    return getMonthlyDistribution(coverage.periodFrom, coverage.periodTo, 1).map((entry) => ({
      month: String(entry.month).padStart(2, '0'),
      year: String(entry.year),
    }));
  }

  if (coverage.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(coverage.invoiceDate)) {
    const [year, month] = coverage.invoiceDate.split('-');
    return [{ year, month }];
  }

  return [];
}

/** Kelių mėnesių užsakymams reikia konkretaus sąskaitavimo mėnesio rankiniam žymėjimui. */
export function invoiceToggleRequiresBillingMonth(
  order: Order,
  billing: BillingMonthContext | null
): boolean {
  return isMultiMonthOrder(order) && Boolean(billing?.year && !billing.month);
}

export function readInvoiceStatusField(
  order: Order,
  status: MonthInvoiceStatus | OrderInvoiceStatus | null | undefined,
  field: keyof BillingMonthInvoiceFlags
): boolean {
  if (status) return status[field];
  if (field === 'invoice_issued' && !isMultiMonthOrder(order)) {
    return !!order.invoice_sent;
  }
  return false;
}

function resolutionMode(billing: BillingMonthContext | null): ResolutionMode {
  if (!billing?.year) return 'global';
  if (!billing.month) return 'year';
  return 'month';
}

function coverageMatchesYear(coverage: OrderInvoiceCoverage, year: string): boolean {
  return invoiceMatchesBillingMonth(
    {
      invoice_date: coverage.invoiceDate,
      period_from: coverage.periodFrom,
      period_to: coverage.periodTo,
    },
    '',
    year
  );
}

function monthFlagsForOrderInYear(
  orderId: string,
  year: string,
  monthFlags: Record<string, BillingMonthInvoiceFlags>
): BillingMonthInvoiceFlags[] {
  const prefix = `${orderId}:${parseInt(year, 10)}:`;
  return Object.entries(monthFlags)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, flags]) => flags);
}

function resolveMultiMonthMonthStatus(
  orderId: string,
  billing: BillingMonthContext,
  coverages: OrderInvoiceCoverage[],
  monthFlags: Record<string, BillingMonthInvoiceFlags>
): MonthInvoiceStatus {
  const monthCoverage = coverages.some((entry) =>
    periodCoversBillingMonth(entry.periodFrom, entry.periodTo, entry.invoiceDate, billing)
  );
  const flagKey = monthFlagKey(orderId, billing.year, billing.month);
  const flags = monthFlags[flagKey] ?? emptyBillingMonthInvoiceFlags();
  const issued = monthCoverage || flags.invoice_issued || flags.invoice_sent;
  const sent = issued && flags.invoice_sent;

  return { invoice_issued: issued, invoice_sent: sent };
}

function resolveMultiMonthYearStatus(
  orderId: string,
  year: string,
  coverages: OrderInvoiceCoverage[],
  monthFlags: Record<string, BillingMonthInvoiceFlags>
): MonthInvoiceStatus {
  const yearCoverage = coverages.some((entry) => coverageMatchesYear(entry, year));
  const yearMonthFlags = monthFlagsForOrderInYear(orderId, year, monthFlags);
  const anyFlagIssued = yearMonthFlags.some(
    (flags) => flags.invoice_issued || flags.invoice_sent
  );
  const anyFlagSent = yearMonthFlags.some((flags) => flags.invoice_sent);
  const issued = yearCoverage || anyFlagIssued;

  return {
    invoice_issued: issued,
    invoice_sent: anyFlagSent,
  };
}

function resolveMultiMonthGlobalStatus(coverages: OrderInvoiceCoverage[]): MonthInvoiceStatus {
  return {
    invoice_issued: coverages.length > 0,
    invoice_sent: false,
  };
}

function resolveSingleMonthStatus(
  billing: BillingMonthContext | null,
  mode: ResolutionMode,
  coverages: OrderInvoiceCoverage[],
  legacy: OrderInvoiceStatus | undefined
): MonthInvoiceStatus {
  let coverage = coverages.length > 0;
  if (billing?.year && mode !== 'global') {
    coverage = coverages.some((entry) =>
      invoiceMatchesBillingMonth(
        {
          invoice_date: entry.invoiceDate,
          period_from: entry.periodFrom,
          period_to: entry.periodTo,
        },
        billing.month,
        billing.year
      )
    );
  }

  return {
    invoice_issued: coverage || legacy?.invoice_issued === true,
    invoice_sent: legacy?.invoice_sent ?? false,
  };
}

export function resolveOrderMonthInvoiceStatus(params: {
  order: Order | undefined;
  billing: BillingMonthContext | null;
  coverages: OrderInvoiceCoverage[];
  legacy: OrderInvoiceStatus | undefined;
  monthFlags: Record<string, BillingMonthInvoiceFlags>;
}): MonthInvoiceStatus {
  const { order, billing, coverages, legacy, monthFlags } = params;
  const mode = resolutionMode(billing);

  if (order && isMultiMonthOrder(order)) {
    if (mode === 'month' && billing) {
      return resolveMultiMonthMonthStatus(order.id, billing, coverages, monthFlags);
    }
    if (mode === 'year' && billing) {
      return resolveMultiMonthYearStatus(order.id, billing.year, coverages, monthFlags);
    }
    return resolveMultiMonthGlobalStatus(coverages);
  }

  return resolveSingleMonthStatus(billing, mode, coverages, legacy);
}

export function buildMonthStatusMap(params: {
  orderIds: string[];
  ordersById: Record<string, Order | undefined>;
  billing: BillingMonthContext | null;
  coverages: OrderInvoiceCoverage[];
  legacyStatuses: Record<string, OrderInvoiceStatus>;
  monthFlags: Record<string, BillingMonthInvoiceFlags>;
}): Record<string, MonthInvoiceStatus> {
  const { orderIds, ordersById, billing, coverages, legacyStatuses, monthFlags } = params;
  const result: Record<string, MonthInvoiceStatus> = {};

  for (const orderId of orderIds) {
    const order = ordersById[orderId];
    result[orderId] = resolveOrderMonthInvoiceStatus({
      order,
      billing,
      coverages: coverages.filter((entry) => entry.orderId === orderId),
      legacy: legacyStatuses[orderId],
      monthFlags,
    });
  }

  return result;
}

export function toOrderInvoiceStatus(
  orderId: string,
  status: MonthInvoiceStatus
): OrderInvoiceStatus {
  return {
    order_id: orderId,
    invoice_issued: status.invoice_issued,
    invoice_sent: status.invoice_sent,
    updated_at: new Date().toISOString(),
  };
}
