import { isSignificantBankExpense, type BankPayment } from '@/lib/bank-statement-import';
import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import { normalizeKnownCompanyText } from '@/lib/bank-csv-encoding';

const CAMT_NS_PATTERNS = [
 /urn:iso:std:iso:20022:tech:xsd:camt\.052\.001\.\d+/,
 /urn:iso:std:iso:20022:tech:xsd:camt\.053\.001\.\d+/,
];

export interface ParsedBankStatementXml {
  expenses: BankPayment[];
  income: BankPayment[];
  skippedRows: number;
}

export function isBankStatementXml(text: string): boolean {
  const sample = text.trim().slice(0, 4000);
  return sample.startsWith('<?xml') || sample.startsWith('<Document');
}

function elementsByLocalName(parent: ParentNode, localName: string): Element[] {
  const root = parent as Document | Element;
  return Array.from(root.getElementsByTagName('*')).filter(
    (el): el is Element => el.localName === localName
  );
}

function firstByLocalName(parent: ParentNode, localName: string): Element | null {
  return elementsByLocalName(parent, localName)[0] ?? null;
}

function textByLocalName(parent: ParentNode, localName: string): string | null {
  const el = firstByLocalName(parent, localName);
  return el?.textContent?.trim() || null;
}

function childText(parent: ParentNode, ...path: string[]): string | null {
  let current: Element | null = parent instanceof Element ? parent : null;
  for (const name of path) {
    if (!current) return null;
    current = firstByLocalName(current, name);
  }
  return current?.textContent?.trim() || null;
}

function parseAmount(raw: string | null): number {
  if (!raw) return NaN;
  const value = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) ? Math.abs(value) : NaN;
}

function parseXmlDate(raw: string | null): string {
  if (!raw) return '';
  return raw.slice(0, 10);
}

function joinUstrd(txDtls: Element): string {
  return elementsByLocalName(txDtls, 'Ustrd')
    .map((el) => el.textContent?.trim() || '')
    .filter(Boolean)
    .join(' · ');
}

function counterpartyFromTx(txDtls: Element, direction: 'DBIT' | 'CRDT'): string | undefined {
  const partyTag = direction === 'DBIT' ? 'Cdtr' : 'Dbtr';
  const party = firstByLocalName(txDtls, partyTag);
  const name = party ? textByLocalName(party, 'Nm') : null;
  if (name) return normalizeKnownCompanyText(name.replace(/^["']|["']$/g, '').trim());

  const ustrd = joinUstrd(txDtls);
  const resolved = resolveBankCounterparty(undefined, ustrd);
  return resolved === 'Nežinomas' ? undefined : resolved;
}

function parseNtry(ntry: Element): { payment: BankPayment; direction: 'expense' | 'income' } | null {
  const cdtDbtInd = textByLocalName(ntry, 'CdtDbtInd');
  if (cdtDbtInd !== 'DBIT' && cdtDbtInd !== 'CRDT') return null;

  const amount = parseAmount(
    firstByLocalName(ntry, 'Amt')?.textContent ?? childText(ntry, 'Amt')
  );
  if (!amount) return null;

  const date =
    childText(ntry, 'BookgDt', 'Dt') ||
    childText(ntry, 'ValDt', 'Dt') ||
    textByLocalName(ntry, 'Dt');
  if (!date) return null;

  const txDtlsList = elementsByLocalName(ntry, 'TxDtls');
  const txDtls = txDtlsList[0] ?? ntry;

  const counterparty = counterpartyFromTx(txDtls, cdtDbtInd);
  const description =
    joinUstrd(txDtls) ||
    textByLocalName(txDtls, 'AddtlTxInf') ||
    counterparty ||
    '';

  if (!counterparty && !description) return null;

  return {
    direction: cdtDbtInd === 'DBIT' ? 'expense' : 'income',
    payment: {
      date: parseXmlDate(date),
      amount,
      counterparty: counterparty || undefined,
      description: normalizeKnownCompanyText(description),
    },
  };
}

export function parseBankStatementXml(
  text: string,
  onProgress?: (current: number, total: number) => void
): ParsedBankStatementXml {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parseris prieinamas tik naršyklėje.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Nepavyko nuskaityti XML failo.');
  }

  const expenses: BankPayment[] = [];
  const income: BankPayment[] = [];
  let skippedRows = 0;

  const ntries = elementsByLocalName(doc, 'Ntry');
  const total = ntries.length;
  if (onProgress) onProgress(0, total);

  for (let i = 0; i < ntries.length; i++) {
    const ntry = ntries[i];
    const parsed = parseNtry(ntry);
    if (!parsed) {
      skippedRows += 1;
    } else {
      const payment: BankPayment = {
        ...parsed.payment,
        counterparty: resolveBankCounterparty(parsed.payment.counterparty, parsed.payment.description),
        description:
          parsed.payment.description ||
          resolveBankCounterparty(parsed.payment.counterparty, parsed.payment.description),
      };

      if (payment.counterparty === 'Nežinomas') {
        payment.counterparty = undefined;
      }

      if (parsed.direction === 'expense' && !isSignificantBankExpense(payment.amount)) {
        skippedRows += 1;
      } else if (parsed.direction === 'expense') {
        expenses.push(payment);
      } else {
        income.push(payment);
      }
    }

    if (onProgress && (i % 20 === 19 || i === ntries.length - 1)) {
      onProgress(i + 1, total);
    }
  }

  return { expenses, income, skippedRows };
}

export function detectCamtNamespace(text: string): string | null {
  for (const pattern of CAMT_NS_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
