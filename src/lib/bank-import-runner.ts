import { BankTransactionService } from '@/lib/bank-transaction-service';
import { buildBankTransactionFingerprint } from '@/lib/bank-transaction-fingerprint';
import {
  bankImportProgress,
  yieldToUi,
} from '@/lib/bank-import-progress';
import {
  parseBankStatementFile,
  readBankStatementFile,
  type BankStatementFileFormat,
} from '@/lib/bank-import';
import {
  buildBankImportReview,
  computeSelectedAllocations,
  type BankImportReview,
} from '@/lib/bank-import-suggestions';
import { InvoiceService } from '@/lib/invoice-service';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import type { FifoAllocationPlan } from '@/lib/payment-allocation';
import type { BankTransaction } from '@/types';

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

export async function prepareBankImportReview(
  file: File,
  options?: BankImportRunOptions
): Promise<BankImportReview> {
  const { text, format } = await readBankStatementFile(file);
  const parsed = parseBankStatementFile(text, format);
  const [issued, received] = await Promise.all([
    InvoiceService.getAll(),
    ReceivedInvoiceService.getAll(),
  ]);
  return buildBankImportReview(parsed, issued, received, options);
}

function mapTransactionsByFingerprint(transactions: BankTransaction[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tx of transactions) {
    map.set(buildBankTransactionFingerprint(tx), tx.id);
  }
  return map;
}

function buildPlansFromReview(
  review: BankImportReview,
  txByFingerprint: Map<string, string>
): FifoAllocationPlan[] {
  const plans: FifoAllocationPlan[] = [];

  for (const group of review.groups) {
    const txId = txByFingerprint.get(group.key);
    if (!txId) continue;

    const allocations = computeSelectedAllocations(group.payment.amount, group.suggestions);
    for (const allocation of allocations) {
      const line = group.suggestions.find((row) => row.id === allocation.lineId);
      if (!line || allocation.amount <= 0) continue;

      const plan: FifoAllocationPlan = {
        bankTransactionId: txId,
        transactionDate: group.payment.date,
        amount: allocation.amount,
      };
      if (line.kind === 'issued') {
        plan.issuedInvoiceId = line.invoiceId;
      } else {
        plan.receivedInvoiceId = line.invoiceId;
      }
      plans.push(plan);
    }
  }

  return plans;
}

export async function applyBankImportReview(
  file: File,
  review: BankImportReview,
  options?: BankImportRunOptions
): Promise<BankImportRunResult> {
  bankImportProgress.start(file.name);

  try {
    bankImportProgress.setFormat(review.format);
    bankImportProgress.setPhase('reading');
    await yieldToUi();

    const { text, format } = await readBankStatementFile(file);
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

    const deduped = await BankTransactionService.deduplicateAll({ rebuildAllocations: false });

    const imported = await BankTransactionService.importFromCsv(
      expensePayments,
      incomePayments,
      format,
      (done, total) => bankImportProgress.setProgress(done, total, 'importing')
    );

    bankImportProgress.setPhase('allocating');
    await yieldToUi();

    const txByFingerprint = mapTransactionsByFingerprint(await BankTransactionService.getAll());

    const plans = buildPlansFromReview(review, txByFingerprint);
    const alloc = await BankTransactionService.applyAllocationPlans(plans);

    const parts = [
      `Importuota (${format.toUpperCase()}): ${imported.expenses} išlaidų, ${imported.income} įplaukų.`,
    ];
    if (imported.skipped > 0) {
      parts.push(`Praleista ${imported.skipped} dublikatų.`);
    }
    if (deduped.removed > 0) {
      parts.push(`Pašalinta ${deduped.removed} senų dublikatų.`);
    }
    parts.push(`Sudengta ${alloc.allocationsCreated} sąskaitų eilučių (patvirtinta).`);
    bankImportProgress.complete(parts.join(' '));

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

