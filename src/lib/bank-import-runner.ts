import { BankTransactionService } from '@/lib/bank-transaction-service';
import {
  bankImportProgress,
  yieldToUi,
} from '@/lib/bank-import-progress';
import {
  parseBankStatementFile,
  readBankStatementFile,
  type BankStatementFileFormat,
} from '@/lib/bank-import';

export interface BankImportRunResult {
  format: BankStatementFileFormat;
  expenses: number;
  income: number;
  skipped: number;
  duplicatesRemoved: number;
  allocationsCreated: number;
}

export interface BankImportRunOptions {
  /** Importuoti tik išlaidas (gautų sąskaitų modalas). */
  expensesOnly?: boolean;
}

export async function runBankStatementImport(
  file: File,
  options?: BankImportRunOptions
): Promise<BankImportRunResult> {
  bankImportProgress.start(file.name);

  try {
    bankImportProgress.setPhase('reading');
    await yieldToUi();

    const { text, format } = await readBankStatementFile(file);
    bankImportProgress.setFormat(format);
    bankImportProgress.setPhase('parsing');
    await yieldToUi();

    const parsed = parseBankStatementFile(text, format, (current, total) => {
      bankImportProgress.setProgress(current, total, 'parsing');
    });

    const expensePayments = parsed.expenses;
    const incomePayments = options?.expensesOnly ? [] : parsed.income;
    const totalPayments = expensePayments.length + incomePayments.length;
    if (totalPayments === 0) {
      throw new Error('Iš failo nepavyko nuskaityti pavedimų.');
    }

    bankImportProgress.setPhase('importing', 0, totalPayments);
    await yieldToUi();

    const deduped = await BankTransactionService.deduplicateAll();

    const imported = await BankTransactionService.importFromCsv(
      expensePayments,
      incomePayments,
      format,
      (done, total) => bankImportProgress.setProgress(done, total, 'importing')
    );

    bankImportProgress.setPhase('allocating');
    await yieldToUi();

    const alloc = await BankTransactionService.allocateAll();

    const parts = [
      `Importuota (${format.toUpperCase()}): ${imported.expenses} išlaidų, ${imported.income} įplaukų.`,
    ];
    if (imported.skipped > 0) {
      parts.push(`Praleista ${imported.skipped} dublikatų.`);
    }
    if (deduped.removed > 0) {
      parts.push(`Pašalinta ${deduped.removed} senų dublikatų.`);
    }
    parts.push(`Sudengta ${alloc.allocationsCreated} sąskaitų eilučių.`);
    const message = parts.join(' ');

    bankImportProgress.complete(message);

    return {
      format,
      expenses: imported.expenses,
      income: imported.income,
      skipped: imported.skipped,
      duplicatesRemoved: deduped.removed,
      allocationsCreated: alloc.allocationsCreated,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nepavyko importuoti banko failo.';
    bankImportProgress.fail(message);
    throw error;
  }
}
