import type { Order } from '@/types';
import { isDentsuLatviaOrder, matchesDentsuLatvia } from '@/lib/invoice-clients';

export type InvoiceLocale = 'lt' | 'en';

export type InvoiceLabels = {
  title: string;
  series: string;
  invoiceDate: string;
  dueDate: string;
  seller: string;
  buyer: string;
  companyCode: string;
  vatCode: string;
  address: string;
  bank: string;
  bankCode: string;
  account: string;
  description: string;
  quantity: string;
  unit: string;
  unitShort: string;
  priceExVat: string;
  amountExVat: string;
  vatAmount: string;
  vatPercent: string;
  total: string;
  subtotalWithRate: (rate: number) => string;
  vatWithRate: (rate: number) => string;
  grandTotal: string;
  amountInWords: string;
  legalNote: string;
  contactLabel: string;
  contactEmail: string;
  linePrefix: string;
  discountApplied: (percent: number) => string;
};

const LABELS: Record<InvoiceLocale, InvoiceLabels> = {
  lt: {
    title: 'PVM SĄSKAITA FAKTŪRA',
    series: 'Serija',
    invoiceDate: 'Sąskaitos data',
    dueDate: 'Apmokėti iki',
    seller: 'Pardavėjas',
    buyer: 'Pirkėjas',
    companyCode: 'Įm. kodas',
    vatCode: 'PVM mokėtojo kodas',
    address: 'Adresas',
    bank: 'Bankas',
    bankCode: 'Banko kodas',
    account: 'Sąskaita',
    description: 'Pavadinimas',
    quantity: 'Kiekis',
    unit: 'Matas',
    unitShort: 'vnt.',
    priceExVat: 'Kaina be PVM',
    amountExVat: 'Suma be PVM',
    vatAmount: 'PVM Suma',
    vatPercent: 'PVM %',
    total: 'Iš viso',
    subtotalWithRate: (rate) => `Suma be PVM (${rate}%):`,
    vatWithRate: (rate) => `PVM (${rate}%):`,
    grandTotal: 'Bendra suma:',
    amountInWords: 'Suma žodžiais:',
    legalNote: 'Ši sąskaita sugeneruota automatiškai.',
    contactLabel: 'Klausimai dėl sąskaitos:',
    contactEmail: 'info@piksel.lt',
    linePrefix: 'Reklamos transliacijos',
    discountApplied: (percent) => `Taikoma ${percent}% nuolaida.`,
  },
  en: {
    title: 'INVOICE',
    series: 'Invoice No.',
    invoiceDate: 'Invoice date',
    dueDate: 'Payment due',
    seller: 'Seller',
    buyer: 'Buyer',
    companyCode: 'Reg. code',
    vatCode: 'VAT No.',
    address: 'Address',
    bank: 'Bank',
    bankCode: 'Bank code',
    account: 'Account',
    description: 'Description',
    quantity: 'Qty',
    unit: 'Unit',
    unitShort: 'pcs',
    priceExVat: 'Unit price',
    amountExVat: 'Amount',
    vatAmount: 'VAT amount',
    vatPercent: 'VAT %',
    total: 'Total',
    subtotalWithRate: (rate) => `Subtotal (${rate}%):`,
    vatWithRate: (rate) => `VAT (${rate}%):`,
    grandTotal: 'Total amount:',
    amountInWords: 'Amount in words:',
    legalNote: 'This invoice was generated automatically.',
    contactLabel: 'Invoice enquiries:',
    contactEmail: 'info@piksel.lt',
    linePrefix: 'Advertising broadcasts',
    discountApplied: (percent) => `${percent}% discount applied.`,
  },
};

export function getInvoiceLabels(locale: InvoiceLocale): InvoiceLabels {
  return LABELS[locale];
}

export function resolveInvoiceLocale(params: {
  buyerName?: string;
  order?: Pick<Order, 'client' | 'agency'> | null;
}): InvoiceLocale {
  const buyerName = params.buyerName?.trim() ?? '';
  if (matchesDentsuLatvia(buyerName)) return 'en';
  if (params.order && isDentsuLatviaOrder(params.order)) return 'en';
  return 'lt';
}

const LT_LINE_RE = /^Reklamos transliacij\w* \((.+), U-([^)]+)\) (.+)$/i;
const EN_LINE_RE = /^Advertising broadcasts \((.+), U-([^)]+)\) (.+)$/i;

export function buildLineDescription(
  order: Pick<Order, 'client' | 'invoice_id'>,
  periodFrom: string,
  periodTo: string,
  locale: InvoiceLocale = 'lt'
): string {
  const prefix = getInvoiceLabels(locale).linePrefix;
  return `${prefix} (${order.client}, U-${order.invoice_id}) ${periodFrom} - ${periodTo}`;
}

export function formatLineDescriptionForLocale(
  text: string,
  locale: InvoiceLocale
): string {
  const ltMatch = text.match(LT_LINE_RE);
  if (ltMatch && locale === 'en') {
    const [, client, invoiceId, period] = ltMatch;
    const [from, to] = period.split(' - ').map((s) => s.trim());
    return buildLineDescription({ client, invoice_id: invoiceId }, from, to ?? period, 'en');
  }
  const enMatch = text.match(EN_LINE_RE);
  if (enMatch && locale === 'lt') {
    const [, client, invoiceId, period] = enMatch;
    const [from, to] = period.split(' - ').map((s) => s.trim());
    return buildLineDescription({ client, invoice_id: invoiceId }, from, to ?? period, 'lt');
  }
  return text;
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

function numberToWordsEn(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ];

  if (num === 0) return 'zero';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const t = tens[Math.floor(num / 10)];
    const r = num % 10;
    return r > 0 ? `${t}-${ones[r]}` : t;
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const r = num % 100;
    const head = h === 1 ? 'one hundred' : `${ones[h]} hundred`;
    return r > 0 ? `${head} ${numberToWordsEn(r)}` : head;
  }
  if (num < 1_000_000) {
    const th = Math.floor(num / 1000);
    const r = num % 1000;
    const head = th === 1 ? 'one thousand' : `${numberToWordsEn(th)} thousand`;
    return r > 0 ? `${head} ${numberToWordsEn(r)}` : head;
  }
  return String(num);
}

export function amountInWords(total: number, locale: InvoiceLocale): string {
  const integerPart = Math.floor(total);
  const decimalPart = Math.round((total - integerPart) * 100);

  if (locale === 'en') {
    let result = `${numberToWordsEn(integerPart)} euros`;
    if (decimalPart > 0) {
      result += ` and ${numberToWordsEn(decimalPart)} cents`;
    }
    return result;
  }

  let result = `${numberToWordsLt(integerPart)} EUR`;
  if (decimalPart > 0) {
    result += ` ir ${numberToWordsLt(decimalPart)} ct.`;
  }
  return result;
}
