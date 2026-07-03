import type { Invoice, Order, OrderBillingPeriod } from '@/types';
import { daysInclusiveBetween, parseDateOnlyLocal } from '@/lib/date-utils';
import { isDentsuLatviaOrder, matchesDentsuLatvia } from '@/lib/invoice-clients';
import {
  billablePeriodInMonth,
  getBillableMonthlyDistribution,
  hasActiveBillingPeriods,
} from '@/lib/order-billing-periods';

export const VAT_RATE = 0.21;

export const PIKSEL_LOGO_SRC = '/Piksel-Logotipas-juodas-RGB.jpg';

export const PIKSEL_SELLER = {
  name: 'UAB "Videoarchitektai"',
  companyCode: '304500899',
  vatCode: 'LT100011114017',
  address: 'Beržyno g. 9, LT-08314 Vilnius, Lietuva',
  bank: 'Swedbank',
  bankCode: '73000',
  account: 'LT637300010151911883',
} as const;

export const INVOICE_FOOTER = {
  legalNote: 'Ši sąskaita sugeneruota automatiškai.',
  contactLabel: 'Klausimai dėl sąskaitos:',
  contactEmail: 'info@piksel.lt',
} as const;

/** Paskutinė išrašyta PIK eilės numerio reikšmė prieš pirmą įrašą DB. */
export const DEFAULT_INVOICE_SEQUENCE = 3771;

export const OWEXX_CLIENT_DISCOUNT_PERCENT = 50;

export function isOwexxOrder(order: Pick<Order, 'client' | 'agency'>): boolean {
  const client = order.client?.trim() ?? '';
  const agency = order.agency?.trim() ?? '';
  return /owexx/i.test(client) || /owexx/i.test(agency);
}

/** @deprecated use isOwexxOrder */
export const isOwexxClient = isOwexxOrder;

export function matchesOwexx(label: string): boolean {
  return /owexx/i.test(label.trim());
}

export { isDentsuLatviaOrder, matchesDentsuLatvia } from '@/lib/invoice-clients';

export function resolveVatRate(params: {
  buyerName?: string;
  order?: Pick<Order, 'client' | 'agency'> | null;
}): number {
  const buyerName = params.buyerName?.trim() ?? '';
  if (matchesDentsuLatvia(buyerName)) return 0;
  if (params.order && isDentsuLatviaOrder(params.order)) return 0;
  return VAT_RATE;
}

export function getInvoiceVatRate(invoice: Pick<Invoice, 'amount' | 'vat_amount'>): number {
  const amount = Number(invoice.amount);
  const vatAmount = Number(invoice.vat_amount);
  if (amount > 0 && vatAmount === 0) return 0;
  return VAT_RATE;
}

export function applyPercentDiscount(amount: number, discountPercent: number): number {
  if (discountPercent <= 0) return amount;
  return Math.round(amount * (1 - discountPercent / 100) * 100) / 100;
}

/** Ar išsaugota suma sutampa su automatiškai apskaičiuota (įskaitant Owexx nuolaidą). */
export function invoiceSavedAmountMatchesCalculated(
  savedAmount: number,
  autoCalculatedBase: number,
  owexxDiscountApplied = false
): boolean {
  if (savedAmount <= 0) return true;
  const expected = owexxDiscountApplied
    ? applyPercentDiscount(autoCalculatedBase, OWEXX_CLIENT_DISCOUNT_PERCENT)
    : autoCalculatedBase;
  return Math.abs(savedAmount - expected) < 0.05;
}

/** Užkraunant išsaugotą sąskaitą – išlaikyti rankinę sumą, neperrašyti iš užsakymo. */
export function resolveSavedInvoiceBaseAmount(
  savedAmount: number,
  autoCalculatedBase: number,
  owexxDiscountApplied = false
): number {
  if (invoiceSavedAmountMatchesCalculated(savedAmount, autoCalculatedBase, owexxDiscountApplied)) {
    return autoCalculatedBase;
  }
  if (owexxDiscountApplied) {
    return Math.round((savedAmount / (1 - OWEXX_CLIENT_DISCOUNT_PERCENT / 100)) * 100) / 100;
  }
  return savedAmount;
}

export function formatInvoiceDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const base = formatDateOnly(dateStr);
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatInvoiceDate(date);
}

export function formatDateOnly(dateString: string): string {
  const s = dateString.trim();
  if (!s) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes(' ')) return s.split(' ')[0];
  const normalized = s.replace(/[./]/g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return s;
}

export function isMultiMonthOrder(order: Order): boolean {
  if (!order.from || !order.to) return false;
  try {
    const from = formatDateOnly(order.from);
    const to = formatDateOnly(order.to);
    const [sy, sm] = from.split('-').map(Number);
    const [ey, em] = to.split('-').map(Number);
    return sy !== ey || sm !== em;
  } catch {
    return false;
  }
}

export function getMonthlyDistribution(
  fromDate: string,
  toDate: string,
  totalAmount: number
): Array<{ month: number; year: number; days: number; amount: number }> {
  if (!fromDate || !toDate || !totalAmount) return [];

  const start = parseDateOnlyLocal(fromDate);
  const end = parseDateOnlyLocal(toDate);
  if (!start || !end || start > end) return [];

  const totalDays = daysInclusiveBetween(start, end);
  if (totalDays <= 0) return [];

  const buckets = new Map<string, { month: number; year: number; days: number }>();
  const walk = new Date(start);
  while (walk <= end) {
    const year = walk.getFullYear();
    const month = walk.getMonth() + 1;
    const key = `${year}-${month}`;
    const entry = buckets.get(key) ?? { month, year, days: 0 };
    entry.days++;
    buckets.set(key, entry);
    walk.setDate(walk.getDate() + 1);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((entry) => ({
      ...entry,
      amount: Math.round((entry.days / totalDays) * totalAmount * 100) / 100,
    }));
}

/** Paskutinė mėnesio darbo diena (pr–pn). */
export function lastWorkingDayOfMonth(year: number, month: number): Date {
  const day = new Date(year, month, 0);
  while (day.getDay() === 0 || day.getDay() === 6) {
    day.setDate(day.getDate() - 1);
  }
  return day;
}

/** Numatytoji sąskaitos data: einamojo mėnesio paskutinė darbo diena. */
export function defaultInvoiceDate(reference = new Date()): string {
  return formatInvoiceDate(
    lastWorkingDayOfMonth(reference.getFullYear(), reference.getMonth() + 1)
  );
}

/** Sąskaitos data pagal sąskaitavimo mėnesį (filtras), arba einamasis mėnuo. */
export function invoiceDateForBillingPeriod(month: string, year: string): string {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  if (month && year && !Number.isNaN(monthNum) && !Number.isNaN(yearNum) && monthNum >= 1 && monthNum <= 12) {
    return defaultInvoiceDate(new Date(yearNum, monthNum - 1, 1));
  }
  return defaultInvoiceDate();
}

export interface BillingMonthOption {
  year: number;
  month: number;
  key: string;
  amount: number;
  invoiceDate: string;
}

export function billingMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function billingMonthKeyFromDate(date: string): string | null {
  const parsed = parseDateOnlyLocal(date);
  if (!parsed) return null;
  return billingMonthKey(parsed.getFullYear(), parsed.getMonth() + 1);
}

export function resolveOrderMonthlyDistribution(
  order: Order,
  periods?: OrderBillingPeriod[] | null
): Array<{ month: number; year: number; days: number; amount: number }> {
  if (!order.from || !order.to || !order.final_price) return [];
  if (hasActiveBillingPeriods(periods)) {
    return getBillableMonthlyDistribution(order.from, order.to, order.final_price, periods!);
  }
  return getMonthlyDistribution(order.from, order.to, order.final_price);
}

export function getBillingMonthOptions(
  order: Order,
  periods?: OrderBillingPeriod[] | null
): BillingMonthOption[] {
  if (!isMultiMonthOrder(order) || !order.from || !order.to || !order.final_price) return [];

  return resolveOrderMonthlyDistribution(order, periods).map((entry) => ({
    year: entry.year,
    month: entry.month,
    key: billingMonthKey(entry.year, entry.month),
    amount: entry.amount,
    invoiceDate: invoiceDateForBillingPeriod(String(entry.month), String(entry.year)),
  }));
}

/** Numatytas sąskaitavimo mėnuo: filtras, ankstesnis kalendorinis, arba einamasis. */
export function resolveDefaultBillingMonthKey(
  order: Order,
  billingMonth = '',
  billingYear = '',
  periods?: OrderBillingPeriod[] | null
): string | null {
  const options = getBillingMonthOptions(order, periods);
  if (options.length === 0) return null;

  if (billingMonth && billingYear) {
    const filterKey = billingMonthKey(parseInt(billingYear, 10), parseInt(billingMonth, 10));
    if (options.some((o) => o.key === filterKey)) return filterKey;
  }

  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevKey = billingMonthKey(prevYear, prevMonth);
  if (options.some((o) => o.key === prevKey)) return prevKey;

  const currentKey = billingMonthKeyFromDate(defaultInvoiceDate());
  if (currentKey && options.some((o) => o.key === currentKey)) return currentKey;

  return options[options.length - 1]?.key ?? null;
}

export function calculateMonthlyAmount(
  order: Order,
  invoiceDate: string,
  periods?: OrderBillingPeriod[] | null
): number {
  if (!isMultiMonthOrder(order)) return order.final_price ?? 0;
  if (!order.from || !order.to || !order.final_price) return order.final_price ?? 0;

  const distribution = resolveOrderMonthlyDistribution(order, periods);
  if (distribution.length === 0) return order.final_price ?? 0;

  const invoiceParsed = parseDateOnlyLocal(invoiceDate);
  if (!invoiceParsed) return distribution[distribution.length - 1].amount;

  const match = distribution.find(
    (m) => m.year === invoiceParsed.getFullYear() && m.month === invoiceParsed.getMonth() + 1
  );
  if (match) return match.amount;

  return distribution[distribution.length - 1].amount;
}

export type InvoiceAmountMode = 'monthly' | 'full';

export function isFullCampaignInvoice(
  invoice: {
    period_from?: string | null;
    period_to?: string | null;
  },
  order: Order
): boolean {
  if (!isMultiMonthOrder(order)) return false;

  const full = getFullOrderPeriod(order);
  return (
    formatDateOnly(invoice.period_from ?? '') === full.from &&
    formatDateOnly(invoice.period_to ?? '') === full.to
  );
}

export function resolveInvoiceAmountMode(
  invoice: {
    period_from?: string | null;
    period_to?: string | null;
  },
  order: Order
): InvoiceAmountMode {
  return isFullCampaignInvoice(invoice, order) ? 'full' : 'monthly';
}

export function getFullOrderPeriod(order: Order): { from: string; to: string } {
  return {
    from: formatDateOnly(order.from),
    to: formatDateOnly(order.to),
  };
}

export function resolveInvoiceAmountAndPeriod(
  order: Order,
  invoiceDate: string,
  mode: InvoiceAmountMode,
  periods?: OrderBillingPeriod[] | null
): { amount: number; from: string; to: string } {
  if (mode === 'full' && isMultiMonthOrder(order)) {
    const period = getFullOrderPeriod(order);
    return {
      amount: order.final_price ?? 0,
      from: period.from,
      to: period.to,
    };
  }

  const period = calculateInvoicePeriod(order, invoiceDate, periods);
  return {
    amount: calculateMonthlyAmount(order, invoiceDate, periods),
    from: period.from,
    to: period.to,
  };
}

export function calculateInvoicePeriod(
  order: Order,
  invoiceDate: string,
  periods?: OrderBillingPeriod[] | null
): { from: string; to: string } {
  if (!order.from || !order.to) return { from: order.from, to: order.to };
  if (!isMultiMonthOrder(order)) {
    return { from: formatDateOnly(order.from), to: formatDateOnly(order.to) };
  }

  try {
    const invoiceDateObj = parseDateOnlyLocal(invoiceDate);
    if (!invoiceDateObj) {
      return { from: formatDateOnly(order.from), to: formatDateOnly(order.to) };
    }
    const currentMonth = invoiceDateObj.getMonth() + 1;
    const currentYear = invoiceDateObj.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDayNum = new Date(currentYear, currentMonth, 0).getDate();
    const lastDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDayNum}`;

    if (hasActiveBillingPeriods(periods)) {
      const billable = billablePeriodInMonth(
        order.from,
        order.to,
        currentYear,
        currentMonth,
        periods!
      );
      if (billable) return billable;
      return { from: formatDateOnly(order.from), to: formatDateOnly(order.to) };
    }

    const orderStart = parseDateOnlyLocal(order.from);
    const orderEnd = parseDateOnlyLocal(order.to);
    if (!orderStart || !orderEnd) {
      return { from: formatDateOnly(order.from), to: formatDateOnly(order.to) };
    }
    const isFirstMonth =
      orderStart.getMonth() + 1 === currentMonth && orderStart.getFullYear() === currentYear;
    const isLastMonth =
      orderEnd.getMonth() + 1 === currentMonth && orderEnd.getFullYear() === currentYear;

    return {
      from: isFirstMonth ? formatDateOnly(order.from) : firstDay,
      to: isLastMonth ? formatDateOnly(order.to) : lastDay,
    };
  } catch {
    return { from: formatDateOnly(order.from), to: formatDateOnly(order.to) };
  }
}

export function calculateVat(amount: number, rate = VAT_RATE): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function numberToWordsLt(num: number): string {
  const ones = ['', 'vienas', 'du', 'trys', 'keturi', 'penki', 'šeši', 'septyni', 'aštuoni', 'devyni'];
  const teens = [
    'dešimt', 'vienuolika', 'dvylika', 'trylika', 'keturiolika', 'penkiolika',
    'šešiolika', 'septyniolika', 'aštuoniolika', 'devyniolika',
  ];
  const tens = [
    '', '', 'dvidešimt', 'trisdešimt', 'keturiasdešimt', 'penkiasdešimt',
    'šešiasdešimt', 'septyniasdešimt', 'aštuoniasdešimt', 'devyniasdešimt',
  ];

  const integerPart = Math.floor(num);
  if (integerPart === 0) return 'nulis';
  if (integerPart < 10) return ones[integerPart];
  if (integerPart < 20) return teens[integerPart - 10];
  if (integerPart < 100) {
    const t = tens[Math.floor(integerPart / 10)];
    const r = integerPart % 10;
    return r > 0 ? `${t} ${ones[r]}` : t;
  }
  if (integerPart < 1000) {
    const hundreds = Math.floor(integerPart / 100);
    const remainder = integerPart % 100;
    const h = hundreds === 1 ? 'šimtas' : `${ones[hundreds]} šimtai`;
    return remainder > 0 ? `${h} ${numberToWordsLt(remainder)}` : h;
  }
  if (integerPart < 1_000_000) {
    const thousands = Math.floor(integerPart / 1000);
    const remainder = integerPart % 1000;
    const t = thousands === 1 ? 'tūkstantis' : `${numberToWordsLt(thousands)} tūkstančiai`;
    return remainder > 0 ? `${t} ${numberToWordsLt(remainder)}` : t;
  }
  return String(integerPart);
}

/** @deprecated use amountInWords from invoice-locale */
export function numberToWordsWithCurrency(num: number): string {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let result = `${numberToWordsLt(integerPart)} EUR`;
  if (decimalPart > 0) {
    result += ` ir ${numberToWordsLt(decimalPart)} ct.`;
  }
  return result;
}

export function parseInvoiceNumber(value: string): number {
  const match = value.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Rūšiavimui: PIK skaitinė dalis, tada tekstinis numeris. */
export function compareInvoiceNumbers(a: string, b: string): number {
  const numA = parseInvoiceNumber(a);
  const numB = parseInvoiceNumber(b);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b, 'lt');
}

export function formatPikNumber(seq: number): string {
  return `PIK ${seq}`;
}

const STANDALONE_ORDER_PREFIX = 'standalone-';
const COMBINED_ORDER_PREFIX = 'combined-';
export const INVOICE_SEED_ORDER_ID = 'seed-last-number';

/** Techninis įrašas PIK numeracijai — nerodomas sąraše. */
export function isInvoiceSeedRecord(
  invoice: Pick<Invoice, 'order_id' | 'buyer_name'>
): boolean {
  return (
    invoice.order_id === INVOICE_SEED_ORDER_ID ||
    /^seed$/i.test(invoice.buyer_name?.trim() ?? '')
  );
}

/** Seni / neužpildyti DB įrašai be tikro pirkėjo. */
export function hasMeaningfulBuyerName(name: string | null | undefined): boolean {
  const buyer = (name ?? '').trim();
  if (!buyer) return false;
  if (/^[-—–.]$/.test(buyer)) return false;
  if (/^seed$/i.test(buyer)) return false;
  return true;
}

export function isInvoiceListable(invoice: Invoice): boolean {
  if (isInvoiceSeedRecord(invoice)) return false;
  return hasMeaningfulBuyerName(invoice.buyer_name);
}

export function createStandaloneInvoiceOrder(orderId?: string): Order {
  const today = defaultInvoiceDate();
  return {
    id: orderId ?? `${STANDALONE_ORDER_PREFIX}${crypto.randomUUID()}`,
    client: '',
    agency: '',
    invoice_id: '—',
    approved: true,
    viaduct: false,
    from: today,
    to: today,
    media_received: false,
    final_price: 0,
    invoice_sent: false,
    updated: new Date().toISOString(),
  };
}

export function isStandaloneInvoiceOrder(orderId: string): boolean {
  return orderId.startsWith(STANDALONE_ORDER_PREFIX);
}

export function createCombinedInvoiceOrderId(): string {
  return `${COMBINED_ORDER_PREFIX}${crypto.randomUUID()}`;
}

export function isCombinedInvoiceOrder(orderId: string): boolean {
  return orderId.startsWith(COMBINED_ORDER_PREFIX);
}

export function computeInvoiceTotals(
  lineAmounts: number[],
  vatRate: number
): { amount: number; vat_amount: number; total_amount: number } {
  const amount = Math.round(lineAmounts.reduce((s, a) => s + a, 0) * 100) / 100;
  const vat_amount = calculateVat(amount, vatRate);
  const total_amount = Math.round((amount + vat_amount) * 100) / 100;
  return { amount, vat_amount, total_amount };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Vieninga sumų skaidymas sąrašų suvestinėms — PVM iš total − amount, kad sutaptų su Su PVM. */
export function getInvoiceAmountBreakdown(invoice: {
  amount: number;
  vat_amount: number;
  total_amount: number;
}): { amount: number; vat: number; total: number } {
  const amount = roundMoney(Number(invoice.amount));
  const storedTotal = Number(invoice.total_amount);
  const storedVat = Number(invoice.vat_amount);

  if (storedTotal > 0) {
    const total = roundMoney(storedTotal);
    return {
      amount,
      vat: roundMoney(total - amount),
      total,
    };
  }

  const vat = roundMoney(storedVat);
  return {
    amount,
    vat,
    total: roundMoney(amount + vat),
  };
}

export function sumInvoiceAmountBreakdowns(
  invoices: Array<{ amount: number; vat_amount: number; total_amount: number }>
): { amount: number; vat: number; total: number } {
  return invoices.reduce(
    (acc, invoice) => {
      const breakdown = getInvoiceAmountBreakdown(invoice);
      return {
        amount: roundMoney(acc.amount + breakdown.amount),
        vat: roundMoney(acc.vat + breakdown.vat),
        total: roundMoney(acc.total + breakdown.total),
      };
    },
    { amount: 0, vat: 0, total: 0 }
  );
}
