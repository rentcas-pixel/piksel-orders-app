import { computeInvoiceTotals, resolveVatRate } from '@/lib/invoice-utils';
import type { MistralIssuedInvoiceExtraction } from '@/lib/mistral-issued-invoice-ocr';

export function normalizeIssuedInvoiceAmounts(
  data: Pick<MistralIssuedInvoiceExtraction, 'buyer_name' | 'amount' | 'vat_amount' | 'total_amount'>
): { amount: number; vat_amount: number; total_amount: number } | null {
  let amount = data.amount ?? 0;
  let vat_amount = data.vat_amount ?? 0;
  let total_amount = data.total_amount ?? 0;
  const vatRate = resolveVatRate({ buyerName: data.buyer_name });

  if (total_amount > 0 && vat_amount > 0 && (!amount || Math.abs(amount - total_amount) < 0.01)) {
    amount = Math.round((total_amount - vat_amount) * 100) / 100;
  } else if (total_amount > 0 && (!amount || amount <= 0) && vat_amount > 0) {
    amount = Math.round((total_amount - vat_amount) * 100) / 100;
  } else if (total_amount > 0 && (!amount || amount <= 0) && vat_amount <= 0) {
    if (vatRate === 0) {
      amount = total_amount;
      vat_amount = 0;
    } else {
      return computeInvoiceTotals(
        [Math.round((total_amount / (1 + vatRate)) * 100) / 100],
        vatRate
      );
    }
  } else if (amount > 0 && vat_amount > 0 && total_amount <= 0) {
    total_amount = Math.round((amount + vat_amount) * 100) / 100;
  } else if (amount > 0 && (!vat_amount || vat_amount <= 0) && total_amount <= 0) {
    return computeInvoiceTotals([amount], vatRate);
  }

  if (amount <= 0 && total_amount <= 0) return null;

  return {
    amount,
    vat_amount,
    total_amount:
      total_amount > 0 ? total_amount : Math.round((amount + vat_amount) * 100) / 100,
  };
}
