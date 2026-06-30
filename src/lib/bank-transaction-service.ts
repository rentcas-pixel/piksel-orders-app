import { isSignificantBankExpense, type BankPayment } from '@/lib/bank-statement-import';
import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import {
  buildBankImportFingerprint,
  buildBankTransactionFingerprint,
} from '@/lib/bank-transaction-fingerprint';
import {
  AMOUNT_TOLERANCE,
  counterpartyKey,
  getEffectivePaidAmount,
  isFullyPaid,
  planFifoAllocations,
  roundMoney,
  type FifoAllocationPlan,
  type FifoInvoiceTarget,
  type FifoPaymentSource,
} from '@/lib/payment-allocation';
import { supabase } from '@/lib/supabase';
import type {
  BankDirection,
  BankTransaction,
  BankTransactionInput,
  Invoice,
  PaymentAllocation,
  ReceivedInvoice,
} from '@/types';

export interface AllocationResult {
  allocationsCreated: number;
  invoicesUpdated: number;
}

export interface BankImportResult {
  imported: BankTransaction[];
  skipped: number;
}

function mapTransaction(
  row: BankTransaction,
  allocatedAmount = 0
): BankTransaction {
  return {
    ...row,
    amount: Number(row.amount),
    allocated_amount: roundMoney(allocatedAmount),
  };
}

export class BankTransactionService {
  static async getAll(direction?: BankDirection): Promise<BankTransaction[]> {
    let query = supabase
      .from('bank_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (direction) {
      query = query.eq('direction', direction);
    }

    const { data, error } = await query;
    if (error) throw error;

    const allocated = await this.getAllocatedByTransaction();
    return (data ?? []).map((row) =>
      mapTransaction(row as BankTransaction, allocated.get(row.id) ?? 0)
    );
  }

  static async getAllocatedByTransaction(): Promise<Map<string, number>> {
    const { data, error } = await supabase.from('payment_allocations').select('bank_transaction_id, amount');
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const id = row.bank_transaction_id as string;
      map.set(id, roundMoney((map.get(id) ?? 0) + Number(row.amount)));
    }
    return map;
  }

  static async create(input: BankTransactionInput): Promise<BankTransaction> {
    const { data, error } = await supabase
      .from('bank_transactions')
      .insert({
        transaction_date: input.transaction_date,
        amount: input.amount,
        direction: input.direction,
        counterparty: input.counterparty.trim(),
        description: input.description?.trim() || null,
        source: input.source ?? 'manual',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return mapTransaction(data as BankTransaction, 0);
  }

  static async update(
    id: string,
    input: Partial<BankTransactionInput>
  ): Promise<BankTransaction> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.transaction_date != null) patch.transaction_date = input.transaction_date;
    if (input.amount != null) patch.amount = input.amount;
    if (input.direction != null) patch.direction = input.direction;
    if (input.counterparty != null) patch.counterparty = input.counterparty.trim();
    if (input.description !== undefined) patch.description = input.description?.trim() || null;

    const { data, error } = await supabase
      .from('bank_transactions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const allocated = await this.getAllocatedByTransaction();
    return mapTransaction(data as BankTransaction, allocated.get(id) ?? 0);
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from('bank_transactions').delete().eq('id', id);
    if (error) throw error;
  }

  /** Ištrina visus banko pavedimus, sudengimus ir nuima banko žymes nuo sąskaitų. */
  static async clearAll(): Promise<{ transactions: number; allocations: number }> {
    const [{ count: txCount }, { count: allocCount }] = await Promise.all([
      supabase.from('bank_transactions').select('*', { count: 'exact', head: true }),
      supabase.from('payment_allocations').select('*', { count: 'exact', head: true }),
    ]);

    const { error: txError } = await supabase
      .from('bank_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (txError) throw txError;

    const now = new Date().toISOString();
    const [{ error: issuedError }, { error: receivedError }] = await Promise.all([
      supabase
        .from('invoices')
        .update({ paid_amount: 0, payment_date: null, updated_at: now })
        .or('paid_amount.gt.0,payment_date.not.is.null'),
      supabase
        .from('received_invoices')
        .update({ paid_amount: 0, payment_date: null, updated_at: now })
        .or('paid_amount.gt.0,payment_date.not.is.null'),
    ]);
    if (issuedError) throw issuedError;
    if (receivedError) throw receivedError;

    return {
      transactions: txCount ?? 0,
      allocations: allocCount ?? 0,
    };
  }

  static async importPayments(
    payments: BankPayment[],
    direction: BankDirection,
    source = 'csv',
    onProgress?: (done: number, total: number) => void
  ): Promise<BankImportResult> {
    const eligible =
      direction === 'expense'
        ? payments.filter((payment) => isSignificantBankExpense(payment.amount))
        : payments;
    if (eligible.length === 0) return { imported: [], skipped: 0 };

    const existing = await this.getAll(direction);
    const seen = new Set(existing.map((tx) => buildBankTransactionFingerprint(tx)));

    const unique: BankPayment[] = [];
    let skipped = 0;
    for (const payment of eligible) {
      const fingerprint = buildBankImportFingerprint(direction, payment);
      if (seen.has(fingerprint)) {
        skipped += 1;
        continue;
      }
      seen.add(fingerprint);
      unique.push(payment);
    }

    if (unique.length === 0) return { imported: [], skipped };

    const BATCH_SIZE = 40;
    const results: BankTransaction[] = [];

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const chunk = unique.slice(i, i + BATCH_SIZE);
      const rows = chunk.map((payment) => ({
        transaction_date: payment.date,
        amount: payment.amount,
        direction,
        counterparty: resolveBankCounterparty(payment.counterparty, payment.description),
        description: payment.description?.trim() || null,
        source,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('bank_transactions').insert(rows).select();
      if (error) throw error;

      results.push(...(data ?? []).map((row) => mapTransaction(row as BankTransaction, 0)));
      onProgress?.(Math.min(i + chunk.length, unique.length), unique.length);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    return { imported: results, skipped };
  }

  static async importFromCsv(
    expensePayments: BankPayment[],
    incomePayments: BankPayment[],
    source = 'csv',
    onProgress?: (done: number, total: number) => void
  ): Promise<{ expenses: number; income: number; skipped: number }> {
    const total = expensePayments.length + incomePayments.length;
    const expenseResult = await this.importPayments(
      expensePayments,
      'expense',
      source,
      onProgress
        ? (done) => onProgress(done, total)
        : undefined
    );
    const incomeResult = await this.importPayments(
      incomePayments,
      'income',
      source,
      onProgress
        ? (done) => onProgress(expensePayments.length + done, total)
        : undefined
    );
    return {
      expenses: expenseResult.imported.length,
      income: incomeResult.imported.length,
      skipped: expenseResult.skipped + incomeResult.skipped,
    };
  }

  /** Pašalina DB dublikatus (tas pačias operacijas importuotas kelis kartus). */
  static async deduplicateAll(): Promise<{ removed: number }> {
    const transactions = await this.getAll();
    const groups = new Map<string, BankTransaction[]>();

    for (const tx of transactions) {
      const key = buildBankTransactionFingerprint(tx);
      const list = groups.get(key) ?? [];
      list.push(tx);
      groups.set(key, list);
    }

    const toDelete: string[] = [];
    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      const sorted = [...group].sort((a, b) => {
        const allocA = a.allocated_amount ?? 0;
        const allocB = b.allocated_amount ?? 0;
        if (allocB !== allocA) return allocB - allocA;
        return a.created_at.localeCompare(b.created_at);
      });
      toDelete.push(...sorted.slice(1).map((tx) => tx.id));
    }

    for (const id of toDelete) {
      await this.delete(id);
    }

    if (toDelete.length > 0) {
      await this.rebuildAllocationsFromScratch();
    }

    return { removed: toDelete.length };
  }

  /** Ištrina sudengimus, nuima apmokėjimo žymes ir sudengia iš naujo (FIFO). */
  static async rebuildAllocationsFromScratch(): Promise<AllocationResult> {
    const { error: allocError } = await supabase
      .from('payment_allocations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (allocError) throw allocError;

    const now = new Date().toISOString();
    const [{ error: issuedError }, { error: receivedError }] = await Promise.all([
      supabase
        .from('invoices')
        .update({ paid_amount: 0, payment_date: null, updated_at: now })
        .or('paid_amount.gt.0,payment_date.not.is.null'),
      supabase
        .from('received_invoices')
        .update({ paid_amount: 0, payment_date: null, updated_at: now })
        .or('paid_amount.gt.0,payment_date.not.is.null'),
    ]);
    if (issuedError) throw issuedError;
    if (receivedError) throw receivedError;

    return this.allocateAll();
  }

  /** Perskaičiuoja sąskaitų paid_amount iš likusių sudengimų. */
  static async syncInvoicePaidAmountsFromAllocations(): Promise<number> {
    const { data: rows, error } = await supabase
      .from('payment_allocations')
      .select('amount, issued_invoice_id, received_invoice_id, bank_transactions(transaction_date)');
    if (error) throw error;

    type Totals = { paid: number; lastDate: string };
    const issuedTotals = new Map<string, Totals>();
    const receivedTotals = new Map<string, Totals>();

    for (const row of rows ?? []) {
      const tx = row.bank_transactions as { transaction_date?: string } | null;
      const txDate = tx?.transaction_date ?? '';
      const amount = Number(row.amount);

      if (row.issued_invoice_id) {
        const id = row.issued_invoice_id as string;
        const current = issuedTotals.get(id) ?? { paid: 0, lastDate: '' };
        current.paid = roundMoney(current.paid + amount);
        if (txDate > current.lastDate) current.lastDate = txDate;
        issuedTotals.set(id, current);
      }

      if (row.received_invoice_id) {
        const id = row.received_invoice_id as string;
        const current = receivedTotals.get(id) ?? { paid: 0, lastDate: '' };
        current.paid = roundMoney(current.paid + amount);
        if (txDate > current.lastDate) current.lastDate = txDate;
        receivedTotals.set(id, current);
      }
    }

    const now = new Date().toISOString();
    let updated = 0;

    for (const [id, totals] of issuedTotals) {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const patch: Record<string, unknown> = {
        paid_amount: totals.paid,
        updated_at: now,
      };
      if (isFullyPaid(Number(invoice.total_amount), totals.paid)) {
        patch.payment_date = totals.lastDate || null;
      } else {
        patch.payment_date = null;
      }

      const { error: updateError } = await supabase.from('invoices').update(patch).eq('id', id);
      if (updateError) throw updateError;
      updated += 1;
    }

    for (const [id, totals] of receivedTotals) {
      const { data: invoice, error: fetchError } = await supabase
        .from('received_invoices')
        .select('total_amount')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const patch: Record<string, unknown> = {
        paid_amount: totals.paid,
        updated_at: now,
      };
      if (isFullyPaid(Number(invoice.total_amount), totals.paid)) {
        patch.payment_date = totals.lastDate || null;
      } else {
        patch.payment_date = null;
      }

      const { error: updateError } = await supabase
        .from('received_invoices')
        .update(patch)
        .eq('id', id);
      if (updateError) throw updateError;
      updated += 1;
    }

    return updated;
  }

  static async allocateAll(): Promise<AllocationResult> {
    await this.repairCounterpartyNames();

    const [transactions, allocations, issued, received] = await Promise.all([
      this.getAll(),
      supabase.from('payment_allocations').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('received_invoices').select('*'),
    ]);

    if (allocations.error) throw allocations.error;
    if (issued.error) throw issued.error;
    if (received.error) throw received.error;

    const allocatedByTx = await this.getAllocatedByTransaction();
    const paidByIssued = sumAllocationsByInvoice(allocations.data ?? [], 'issued');
    const paidByReceived = sumAllocationsByInvoice(allocations.data ?? [], 'received');

    const expenseSources: FifoPaymentSource[] = [];
    const incomeSources: FifoPaymentSource[] = [];

    for (const tx of transactions) {
      const source: FifoPaymentSource = {
        id: tx.id,
        transactionDate: tx.transaction_date,
        amount: tx.amount,
        allocatedAmount: allocatedByTx.get(tx.id) ?? 0,
        counterparty: resolveBankCounterparty(tx.counterparty, tx.description),
        description: tx.description?.trim() || undefined,
      };
      if (tx.direction === 'expense') expenseSources.push(source);
      else incomeSources.push(source);
    }

    const receivedTargets: FifoInvoiceTarget[] = (received.data ?? []).map((invoice) => {
      const row = invoice as ReceivedInvoice;
      return {
        id: `received:${row.id}`,
        invoiceDate: row.invoice_date,
        totalAmount: Number(row.total_amount),
        paidAmount: roundMoney(
          Math.max(paidByReceived.get(row.id) ?? 0, getEffectivePaidAmount(row))
        ),
        counterparty: row.seller_name?.trim() || 'Nežinomas',
      };
    });

    const issuedTargets: FifoInvoiceTarget[] = (issued.data ?? []).map((invoice) => {
      const row = invoice as Invoice;
      return {
        id: `issued:${row.id}`,
        invoiceDate: row.invoice_date,
        totalAmount: Number(row.total_amount),
        paidAmount: roundMoney(
          Math.max(paidByIssued.get(row.id) ?? 0, getEffectivePaidAmount(row))
        ),
        counterparty: row.buyer_name?.trim() || 'Nežinomas',
        invoiceNumber: row.invoice_number,
      };
    });

    const plans = [
      ...planFifoAllocations(expenseSources, receivedTargets),
      ...planFifoAllocations(incomeSources, issuedTargets),
    ];

    if (plans.length === 0) {
      return { allocationsCreated: 0, invoicesUpdated: 0 };
    }

    return this.applyAllocationPlans(plans);
  }

  /** Pataiso kontrahentą DB įrašuose (pvz. IBAN → UAB Šklėriai iš aprašymo). */
  static async repairCounterpartyNames(): Promise<number> {
    const txs = await this.getAll();
    let fixed = 0;

    for (const tx of txs) {
      const resolved = resolveBankCounterparty(tx.counterparty, tx.description);
      if (resolved === 'Nežinomas' || resolved === tx.counterparty?.trim()) continue;
      await this.update(tx.id, { counterparty: resolved });
      fixed += 1;
    }

    return fixed;
  }

  static async applyAllocationPlans(plans: FifoAllocationPlan[]): Promise<AllocationResult> {
    if (plans.length === 0) return { allocationsCreated: 0, invoicesUpdated: 0 };

    const rows = plans.map((plan) => ({
      bank_transaction_id: plan.bankTransactionId,
      issued_invoice_id: plan.issuedInvoiceId ?? null,
      received_invoice_id: plan.receivedInvoiceId ?? null,
      amount: plan.amount,
    }));

    const { error: insertError } = await supabase.from('payment_allocations').insert(rows);
    if (insertError) throw insertError;

    const issuedTotals = new Map<string, { paid: number; paymentDate: string }>();
    const receivedTotals = new Map<string, { paid: number; paymentDate: string }>();

    for (const plan of plans) {
      if (plan.issuedInvoiceId) {
        const current = issuedTotals.get(plan.issuedInvoiceId) ?? { paid: 0, paymentDate: plan.transactionDate };
        current.paid = roundMoney(current.paid + plan.amount);
        if (plan.transactionDate > current.paymentDate) current.paymentDate = plan.transactionDate;
        issuedTotals.set(plan.issuedInvoiceId, current);
      }
      if (plan.receivedInvoiceId) {
        const current = receivedTotals.get(plan.receivedInvoiceId) ?? { paid: 0, paymentDate: plan.transactionDate };
        current.paid = roundMoney(current.paid + plan.amount);
        if (plan.transactionDate > current.paymentDate) current.paymentDate = plan.transactionDate;
        receivedTotals.set(plan.receivedInvoiceId, current);
      }
    }

    let invoicesUpdated = 0;

    for (const [id, totals] of issuedTotals) {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const newPaid = roundMoney(Number(invoice.paid_amount ?? 0) + totals.paid);
      const patch: Record<string, unknown> = {
        paid_amount: newPaid,
        updated_at: new Date().toISOString(),
      };
      if (isFullyPaid(Number(invoice.total_amount), newPaid)) {
        patch.payment_date = totals.paymentDate;
      }

      const { error } = await supabase.from('invoices').update(patch).eq('id', id);
      if (error) throw error;
      invoicesUpdated += 1;
    }

    for (const [id, totals] of receivedTotals) {
      const { data: invoice, error: fetchError } = await supabase
        .from('received_invoices')
        .select('total_amount, paid_amount')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const newPaid = roundMoney(Number(invoice.paid_amount ?? 0) + totals.paid);
      const patch: Record<string, unknown> = {
        paid_amount: newPaid,
        updated_at: new Date().toISOString(),
      };
      if (isFullyPaid(Number(invoice.total_amount), newPaid)) {
        patch.payment_date = totals.paymentDate;
      }

      const { error } = await supabase.from('received_invoices').update(patch).eq('id', id);
      if (error) throw error;
      invoicesUpdated += 1;
    }

    return { allocationsCreated: plans.length, invoicesUpdated };
  }

  static getUnallocatedAmount(tx: BankTransaction): number {
    const allocated = tx.allocated_amount ?? 0;
    return roundMoney(Math.max(0, tx.amount - allocated));
  }

  static groupSummary(transactions: BankTransaction[]): {
    key: string;
    counterparty: string;
    count: number;
    total: number;
    unallocated: number;
  }[] {
    const groups = new Map<string, { counterparty: string; count: number; total: number; unallocated: number }>();

    for (const tx of transactions) {
      const label = resolveBankCounterparty(tx.counterparty, tx.description);
      const key = counterpartyKey(label);
      const current = groups.get(key) ?? {
        counterparty: label,
        count: 0,
        total: 0,
        unallocated: 0,
      };
      current.count += 1;
      current.total = roundMoney(current.total + tx.amount);
      current.unallocated = roundMoney(current.unallocated + this.getUnallocatedAmount(tx));
      groups.set(key, current);
    }

    return [...groups.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.unallocated - a.unallocated || a.counterparty.localeCompare(b.counterparty));
  }
}

function sumAllocationsByInvoice(
  rows: PaymentAllocation[],
  kind: 'issued' | 'received'
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = kind === 'issued' ? row.issued_invoice_id : row.received_invoice_id;
    if (!id) continue;
    map.set(id, roundMoney((map.get(id) ?? 0) + Number(row.amount)));
  }
  return map;
}
