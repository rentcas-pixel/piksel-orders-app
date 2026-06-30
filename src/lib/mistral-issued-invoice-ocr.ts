import { formatDateOnly, formatPikNumber, parseInvoiceNumber } from '@/lib/invoice-utils';
import { normalizeIssuedInvoiceAmounts } from '@/lib/issued-invoice-amounts';

export interface MistralIssuedInvoiceExtraction {
  buyer_name: string;
  buyer_company_code?: string | null;
  buyer_vat_code?: string | null;
  buyer_address?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  line_description?: string | null;
  period_from?: string | null;
  period_to?: string | null;
}

export const ISSUED_INVOICE_OCR_SCHEMA = {
  type: 'object',
  properties: {
    buyer_name: { type: 'string', description: 'Pirkėjo / kliento pavadinimas' },
    buyer_company_code: { type: 'string', description: 'Pirkėjo įmonės kodas (Lietuvoje 9 skaitmenys)' },
    buyer_vat_code: { type: 'string', description: 'Pirkėjo PVM mokėtojo kodas, pvz. LT123456789' },
    buyer_address: { type: 'string', description: 'Pirkėjo adresas' },
    invoice_number: { type: 'string', description: 'Sąskaitos numeris, pvz. PIK 3772' },
    invoice_date: { type: 'string', description: 'Sąskaitos data YYYY-MM-DD' },
    due_date: { type: 'string', description: 'Apmokėjimo terminas YYYY-MM-DD' },
    amount: { type: 'number', description: 'Suma be PVM eurais' },
    vat_amount: { type: 'number', description: 'PVM suma eurais' },
    total_amount: { type: 'number', description: 'Suma su PVM' },
    line_description: { type: 'string', description: 'Paslaugų ar prekių aprašymas' },
    period_from: { type: 'string', description: 'Paslaugų laikotarpio pradžia YYYY-MM-DD' },
    period_to: { type: 'string', description: 'Paslaugų laikotarpio pabaiga YYYY-MM-DD' },
  },
  required: [
    'buyer_name',
    'invoice_number',
    'invoice_date',
    'amount',
    'vat_amount',
    'total_amount',
  ],
  additionalProperties: false,
} as const;

export const ISSUED_INVOICE_OCR_PROMPT = `Ištrauk duomenis iš lietuviškos išrašytos sąskaitos faktūros, kurią išrašė UAB "Videoarchitektai" (Piksel).
Pardavėjas yra Videoarchitektai / Piksel — pirkėjas yra klientas, kuriam išrašyta sąskaita.
Sąskaitos numeris dažnai prasideda PIK ir skaičiumi, pvz. "PIK 3772".
Svarbiausi laukai: buyer_name, invoice_number, invoice_date, amount, vat_amount, total_amount.
Jei papildomų laukų nėra dokumente arba jų neįmanoma patikimai nustatyti, grąžink tuščią eilutę tekstiniams laukams arba 0 skaitiniams.
Geriau grąžinti dalinį, bet teisingą atsakymą, nei neatspėti pirkėjo adreso ar laikotarpio.
Datos formatas: YYYY-MM-DD.
Sumos su dviem skaitmenimis po kablelio.
Suma be PVM = amount, PVM = vat_amount, su PVM = total_amount.`;

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  try {
    return formatDateOnly(trimmed);
  } catch {
    return null;
  }
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function normalizePikInvoiceNumber(value: string): string {
  const trimmed = value.trim();
  const seq = parseInvoiceNumber(trimmed);
  if (/pik/i.test(trimmed) && seq > 0) {
    return formatPikNumber(seq);
  }
  return trimmed;
}

export function parseMistralIssuedInvoiceAnnotation(
  raw: unknown
): MistralIssuedInvoiceExtraction | null {
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  } else {
    return null;
  }

  const buyer_name = cleanText(parsed.buyer_name);
  if (!buyer_name) return null;

  const invoice_numberRaw = cleanText(parsed.invoice_number);
  const invoice_number = invoice_numberRaw ? normalizePikInvoiceNumber(invoice_numberRaw) : null;

  const totals = normalizeIssuedInvoiceAmounts({
    buyer_name,
    amount: parseNumber(parsed.amount),
    vat_amount: parseNumber(parsed.vat_amount),
    total_amount: parseNumber(parsed.total_amount),
  });

  return {
    buyer_name,
    buyer_company_code: cleanText(parsed.buyer_company_code) || null,
    buyer_vat_code: cleanText(parsed.buyer_vat_code) || null,
    buyer_address: cleanText(parsed.buyer_address) || null,
    invoice_number,
    invoice_date: parseDate(parsed.invoice_date),
    due_date: parseDate(parsed.due_date),
    amount: totals?.amount ?? null,
    vat_amount: totals?.vat_amount ?? null,
    total_amount: totals?.total_amount ?? null,
    line_description: cleanText(parsed.line_description) || null,
    period_from: parseDate(parsed.period_from),
    period_to: parseDate(parsed.period_to),
  };
}
