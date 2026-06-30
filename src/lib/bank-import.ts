import { parseBankStatementCsv, type BankPayment } from '@/lib/bank-statement-import';
import { isBankStatementXml, parseBankStatementXml } from '@/lib/bank-statement-xml';
import { decodeBankCsvBytes, readBankCsvFile } from '@/lib/bank-csv-encoding';

export type BankStatementFileFormat = 'csv' | 'xml';

export interface ParsedBankStatementFile {
  format: BankStatementFileFormat;
  expenses: BankPayment[];
  income: BankPayment[];
  skippedRows: number;
}

export async function readBankStatementFile(file: File): Promise<{ text: string; format: BankStatementFileFormat }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.xml')) {
    return { text: await file.text(), format: 'xml' };
  }

  const buffer = await file.arrayBuffer();
  const head = new TextDecoder('utf-8').decode(buffer.slice(0, 2000)).trim();
  if (isBankStatementXml(head)) {
    return { text: new TextDecoder('utf-8').decode(buffer), format: 'xml' };
  }

  return { text: decodeBankCsvBytes(buffer), format: 'csv' };
}

export function parseBankStatementFile(
  text: string,
  format: BankStatementFileFormat,
  onProgress?: (current: number, total: number) => void
): ParsedBankStatementFile {
  if (format === 'xml' || isBankStatementXml(text)) {
    const parsed = parseBankStatementXml(text, onProgress);
    return { format: 'xml', ...parsed };
  }

  const expenses = parseBankStatementCsv(text, false);
  const income = parseBankStatementCsv(text, true);
  return {
    format: 'csv',
    expenses: expenses.payments,
    income: income.payments,
    skippedRows: expenses.skippedRows + income.skippedRows,
  };
}

export async function importBankStatementFile(file: File): Promise<ParsedBankStatementFile> {
  const { text, format } = await readBankStatementFile(file);
  return parseBankStatementFile(text, format);
}

// Backwards-compatible CSV helper
export { readBankCsvFile };
