import {
  formatDateOnly,
  formatPikNumber,
  parseInvoiceNumber,
} from '@/lib/invoice-utils';
import type { MistralIssuedInvoiceExtraction } from '@/lib/mistral-issued-invoice-ocr';
import { normalizeIssuedInvoiceAmounts } from '@/lib/issued-invoice-amounts';

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\u0000/g, '').trim();
}

function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const ymd = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

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

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const number = parseFloat(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

async function extractPdfLines(buffer: Buffer): Promise<string[]> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return (result.text || '')
      .split(/\r?\n/)
      .map(cleanLine)
      .filter(Boolean);
  } finally {
    await parser.destroy();
  }
}

function findInvoiceNumber(lines: string[], filename: string): string | null {
  const filenameMatch = filename.match(/PIK[\s_-]*(\d{3,6})/i);
  if (filenameMatch) return formatPikNumber(parseInt(filenameMatch[1], 10));

  for (const line of lines) {
    const match = line.match(/PIK[\s-]*(\d{3,6})/i);
    if (match) return formatPikNumber(parseInt(match[1], 10));
  }
  return null;
}

function findInvoiceDate(lines: string[], filename: string): string | null {
  const filenameMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (filenameMatch) {
    return `${filenameMatch[1]}-${filenameMatch[2]}-${filenameMatch[3]}`;
  }

  for (const line of lines) {
    const match = line.match(
      /(?:sąskaitos\s+data|data)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i
    );
    if (match) return parseDate(match[1]);
  }
  return null;
}

function findDueDate(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.match(
      /(?:apmokėti\s+iki|mokėjimo\s+terminas|due\s+date)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i
    );
    if (match) return parseDate(match[1]);
  }
  return null;
}

function findLabelValue(lines: string[], label: RegExp, maxLookahead = 3): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!label.test(line)) continue;

    const inline = line
      .replace(label, '')
      .replace(/^[:\s-]+/, '')
      .trim();
    if (inline) return inline;

    for (let step = 1; step <= maxLookahead; step += 1) {
      const next = cleanLine(lines[i + step] ?? '');
      if (!next) continue;
      if (/^(pardavėjas|pirkėjas|sąskaitos|paslaug|prek|iš\s+viso|viso|suma|pvm)/i.test(next)) {
        break;
      }
      return next;
    }
  }
  return null;
}

function findBuyerName(lines: string[]): string | null {
  const fromLabel = findLabelValue(lines, /^pirkėjas\b[:\s-]*/i, 4);
  if (fromLabel) return fromLabel;

  const companyLine = lines.find((line) => /\b(UAB|MB|AB|VšĮ|IĮ|UADB)\b/i.test(line));
  if (companyLine && !/Videoarchitektai/i.test(companyLine)) return companyLine;

  return null;
}

function findBuyerCompanyCode(lines: string[]): string | null {
  const buyerIndex = lines.findIndex((line) => /^pirkėjas\b/i.test(line));
  if (buyerIndex < 0) return null;

  for (let i = buyerIndex; i < Math.min(lines.length, buyerIndex + 6); i += 1) {
    const match = lines[i].match(/(?:įm\.\s*kodas|įmonės\s*kodas|kodas)\s*:?\s*(\d{7,9})/i);
    if (match) return match[1];
  }
  return null;
}

function findBuyerVatCode(lines: string[]): string | null {
  const buyerIndex = lines.findIndex((line) => /^pirkėjas\b/i.test(line));
  if (buyerIndex < 0) return null;

  for (let i = buyerIndex; i < Math.min(lines.length, buyerIndex + 6); i += 1) {
    const match = lines[i].match(/\b([A-Z]{2}\d{6,15})\b/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function findBuyerAddress(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^pirkėjas\b/i.test(lines[i])) continue;
    const parts: string[] = [];
    for (let step = 1; step <= 4; step += 1) {
      const next = cleanLine(lines[i + step] ?? '');
      if (!next) continue;
      if (/^(įmonės\s*kodas|pvm\s*kodas|sąskaitos|paslaug|prek|iš\s+viso|viso|suma|mokėjimo)/i.test(next)) {
        break;
      }
      if (!parts.includes(next)) parts.push(next);
    }
    if (parts.length > 1) return parts.slice(1).join(', ');
  }
  return null;
}

function findInvoiceAmounts(lines: string[]): {
  amount: number | null;
  vat_amount: number | null;
  total_amount: number | null;
} {
  let amount: number | null = null;
  let vat_amount: number | null = null;
  let total_amount: number | null = null;

  for (const line of lines) {
    if (!amount) {
      const match = line.match(/suma\s+be\s+pvm(?:\s*\(\d+%\))?\s+([\d.,]+)/i);
      if (match) amount = parseMoney(match[1]);
    }

    if (!vat_amount) {
      const match = line.match(/pvm\s*\(\d+%\)\s+([\d.,]+)/i);
      if (match) vat_amount = parseMoney(match[1]);
    }

    if (!total_amount) {
      const match = line.match(/bendra\s+suma\s+([\d.,]+)/i);
      if (match) total_amount = parseMoney(match[1]);
    }
  }

  return { amount, vat_amount, total_amount };
}

function findLineDescription(lines: string[]): string | null {
  const noisy = /^(pardavėjas|pirkėjas|įmonės\s*kodas|pvm\s*kodas|sąskaitos|data|apmokėti|mokėjimo|suma|pvm|iš\s+viso|viso|bank|swedbank|lt\d+)/i;
  const startIndex = lines.findIndex((line) => /^(paslaug|prek|aprašymas|description)/i.test(line));
  if (startIndex >= 0) {
    const values: string[] = [];
    for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 5); i += 1) {
      const line = cleanLine(lines[i]);
      if (!line || noisy.test(line)) break;
      values.push(line);
    }
    if (values.length > 0) return values.join(' ');
  }

  const reklamaIndex = lines.findIndex((line) => /^reklamos\s+transliacijos/i.test(line));
  if (reklamaIndex >= 0) {
    const parts = [lines[reklamaIndex]];
    for (let i = reklamaIndex + 1; i < Math.min(lines.length, reklamaIndex + 3); i += 1) {
      const line = cleanLine(lines[i]);
      if (!line || /^\d+\s*vnt\b/i.test(line) || noisy.test(line)) break;
      parts.push(line);
    }
    return parts.join(' ');
  }

  return null;
}

function findPeriod(lines: string[]): { period_from: string | null; period_to: string | null } {
  for (const line of lines) {
    const match = line.match(
      /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:iki|-|–)\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i
    );
    if (match) {
      return {
        period_from: parseDate(match[1]),
        period_to: parseDate(match[2]),
      };
    }
  }
  return { period_from: null, period_to: null };
}

export async function parsePikselIssuedInvoicePdf(
  buffer: Buffer,
  filename: string
): Promise<MistralIssuedInvoiceExtraction | null> {
  const lines = await extractPdfLines(buffer);
  if (lines.length === 0) return null;

  const invoice_number = findInvoiceNumber(lines, filename);
  const invoice_date = findInvoiceDate(lines, filename);
  const due_date = findDueDate(lines);
  const buyer_name = findBuyerName(lines);
  const buyer_company_code = findBuyerCompanyCode(lines);
  const buyer_vat_code = findBuyerVatCode(lines);
  const buyer_address = findBuyerAddress(lines);
  const line_description = findLineDescription(lines);
  const { period_from, period_to } = findPeriod(lines);

  const { amount: rawAmount, vat_amount: rawVat, total_amount: rawTotal } =
    findInvoiceAmounts(lines);

  if (!buyer_name || !invoice_number || (!rawAmount && !rawVat && !rawTotal)) {
    return null;
  }

  const totals = normalizeIssuedInvoiceAmounts({
    buyer_name,
    amount: rawAmount,
    vat_amount: rawVat,
    total_amount: rawTotal,
  });
  if (!totals) return null;

  return {
    buyer_name,
    buyer_company_code,
    buyer_vat_code,
    buyer_address,
    invoice_number: invoice_number && parseInvoiceNumber(invoice_number) > 0 ? invoice_number : null,
    invoice_date,
    due_date,
    amount: totals.amount,
    vat_amount: totals.vat_amount,
    total_amount: totals.total_amount,
    line_description,
    period_from,
    period_to,
  };
}
