import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import { counterpartyKey, roundMoney } from '@/lib/payment-allocation';
import type { BankPayment } from '@/lib/bank-statement-import';
import type { BankDirection, BankTransaction } from '@/types';

function normalizeFingerprintText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildBankImportFingerprint(
  direction: BankDirection,
  payment: Pick<BankPayment, 'date' | 'amount' | 'counterparty' | 'description'>
): string {
  const counterparty = resolveBankCounterparty(payment.counterparty, payment.description);
  const description = normalizeFingerprintText(payment.description || counterparty);
  return [
    direction,
    payment.date,
    roundMoney(payment.amount).toFixed(2),
    counterpartyKey(counterparty),
    description,
  ].join('|');
}

export function buildBankTransactionFingerprint(tx: BankTransaction): string {
  return buildBankImportFingerprint(tx.direction, {
    date: tx.transaction_date,
    amount: tx.amount,
    counterparty: tx.counterparty,
    description: tx.description ?? '',
  });
}
