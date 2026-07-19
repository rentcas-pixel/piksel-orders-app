import { formatDateOnly } from '@/lib/invoice-utils';
import { computeReceivedInvoiceTotals } from '@/lib/received-invoice-service';

export interface MistralReceivedInvoiceExtraction {
  seller_name: string;
  seller_company_code?: string | null;
  seller_vat_code?: string | null;
  seller_address?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  description?: string | null;
}

export const RECEIVED_INVOICE_OCR_SCHEMA = {
  type: 'object',
  properties: {
    seller_name: { type: 'string', description: 'Tiekėjo / pardavėjo pavadinimas' },
    seller_company_code: { type: 'string', description: 'Įmonės kodas (Lietuvoje 9 skaitmenys)' },
    seller_vat_code: { type: 'string', description: 'PVM mokėtojo kodas, pvz. LT123456789' },
    seller_address: { type: 'string', description: 'Tiekėjo adresas' },
    invoice_number: { type: 'string', description: 'Sąskaitos faktūros numeris' },
    invoice_date: { type: 'string', description: 'Sąskaitos data YYYY-MM-DD' },
    due_date: { type: 'string', description: 'Apmokėjimo terminas YYYY-MM-DD' },
    amount: { type: 'number', description: 'Suma be PVM eurais' },
    vat_amount: { type: 'number', description: 'PVM suma eurais' },
    total_amount: { type: 'number', description: 'Suma su PVM arba bendra suma' },
    currency: { type: 'string', description: 'Valiutos kodas: EUR, USD, GBP' },
    description: { type: 'string', description: 'Paslaugų ar prekių aprašymas' },
  },
  required: [
    'seller_name',
    'seller_company_code',
    'seller_vat_code',
    'seller_address',
    'invoice_number',
    'invoice_date',
    'due_date',
    'amount',
    'vat_amount',
    'total_amount',
    'description',
  ],
  additionalProperties: false,
} as const;

export const RECEIVED_INVOICE_OCR_PROMPT = `Ištrauk duomenis iš lietuviškos gautos sąskaitos faktūros (tiekėjo sąskaitos).
Jei lauko nėra dokumente, grąžink tuščią eilutę tekstiniams laukams arba 0 skaitiniams.
Datos formatas: YYYY-MM-DD.
Sumos su dviem skaitmenimis po kablelio.
Jei sąskaita USD ar kita valiuta — nurodyk currency (EUR, USD, GBP) ir sumas toje valiutoje.
Suma be PVM = amount, PVM = vat_amount (0 jei užsienio sąskaita be PVM), su PVM = total_amount.

Tiekėjas (seller_*) = kas IŠRAŠĖ sąskaitą (pardavėjas), NIEKADA pirkėjas/mokėtojas.
UAB "Videoarchitektai" / Piksel (įm.k. 304500899, PVM LT100011114017) šiose gautose sąskaitose beveik visada yra MOKĖTOJAS — jų nedėk į seller_*.
Jei dokumente yra "Sąskaitą išrašė: …" — tai seller_name.
Individualios veiklos sąskaitose tiekėjas dažnai pažymėtas kaip "Gavėjas", o Videoarchitektai — kaip "Mokėtojas"; tada seller_* = Gavėjas (pvz. Margarita Kapčiuvienė), be Videoarchitektų kodų.
Jei PVM netaikomas ir mokėtina suma = eilutės suma — vat_amount = 0, amount = total_amount.`;

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

export function parseMistralDocumentAnnotation(
  raw: unknown
): MistralReceivedInvoiceExtraction | null {
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

  const seller_name = cleanText(parsed.seller_name);
  if (!seller_name) return null;

  let amount = parseNumber(parsed.amount);
  let vat_amount = parseNumber(parsed.vat_amount);
  let total_amount = parseNumber(parsed.total_amount);

  if (total_amount && total_amount > 0 && (!amount || amount <= 0) && vat_amount && vat_amount > 0) {
    amount = Math.round((total_amount - vat_amount) * 100) / 100;
  } else if (total_amount && total_amount > 0 && (!amount || amount <= 0) && (!vat_amount || vat_amount <= 0)) {
    const totals = computeReceivedInvoiceTotals(
      Math.round((total_amount / 1.21) * 100) / 100
    );
    amount = totals.amount;
    vat_amount = totals.vat_amount;
    total_amount = totals.total_amount;
  } else if (amount && amount > 0 && (!vat_amount || vat_amount <= 0) && (!total_amount || total_amount <= 0)) {
    const totals = computeReceivedInvoiceTotals(amount);
    amount = totals.amount;
    vat_amount = totals.vat_amount;
    total_amount = totals.total_amount;
  }

  return {
    seller_name,
    seller_company_code: cleanText(parsed.seller_company_code) || null,
    seller_vat_code: cleanText(parsed.seller_vat_code) || null,
    seller_address: cleanText(parsed.seller_address) || null,
    invoice_number: cleanText(parsed.invoice_number) || null,
    invoice_date: parseDate(parsed.invoice_date),
    due_date: parseDate(parsed.due_date),
    amount,
    vat_amount,
    total_amount,
    currency: cleanText(parsed.currency)?.toUpperCase() || null,
    description: cleanText(parsed.description) || null,
  };
}

export function buildMistralDocumentPayload(
  base64: string,
  mimeType: string
): { type: string; document_url?: string; image_url?: string } {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  if (mimeType.startsWith('image/')) {
    return { type: 'image_url', image_url: dataUrl };
  }
  return { type: 'document_url', document_url: dataUrl };
}
