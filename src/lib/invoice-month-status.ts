import { isMultiMonthOrder } from '@/lib/invoice-utils';
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

export function monthSentFlagKey(orderId: string, year: string, month: string): string {
  return `${orderId}:${year}:${parseInt(month, 10)}`;
}

export function buildMonthStatusMap(params: {
  orderIds: string[];
  ordersById: Record<string, Order | undefined>;
  billing: BillingMonthContext | null;
  coverages: OrderInvoiceCoverage[];
  legacyStatuses: Record<string, OrderInvoiceStatus>;
  monthSentFlags: Record<string, boolean>;
}): Record<string, MonthInvoiceStatus> {
  const { orderIds, ordersById, billing, coverages, legacyStatuses, monthSentFlags } = params;
  const result: Record<string, MonthInvoiceStatus> = {};

  for (const orderId of orderIds) {
    const order = ordersById[orderId];
    const legacy = legacyStatuses[orderId];
    const orderCoverages = coverages.filter((entry) => entry.orderId === orderId);

    if (!billing?.month || !billing?.year) {
      const issued =
        orderCoverages.length > 0 || legacy?.invoice_issued === true || !!order?.invoice_sent;
      result[orderId] = {
        invoice_issued: issued,
        invoice_sent: legacy?.invoice_sent ?? false,
      };
      continue;
    }

    const monthCoverage = orderCoverages.some((entry) =>
      periodCoversBillingMonth(entry.periodFrom, entry.periodTo, entry.invoiceDate, billing)
    );

    if (order && isMultiMonthOrder(order)) {
      const sentKey = monthSentFlagKey(orderId, billing.year, billing.month);
      result[orderId] = {
        invoice_issued: monthCoverage,
        invoice_sent: monthCoverage ? (monthSentFlags[sentKey] ?? false) : false,
      };
      continue;
    }

    result[orderId] = {
      invoice_issued: monthCoverage,
      invoice_sent: legacy?.invoice_sent ?? false,
    };
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
