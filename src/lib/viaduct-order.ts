import type { Order } from '@/types';

/** Užsakymas yra viadukų, net jei žodžio nėra kliento varde. */
export function isViaductOrder(
  order: Pick<Order, 'viaduct' | 'intensity' | 'details'>
): boolean {
  if (order.viaduct) return true;
  const plan = order.details?.plan;
  if (plan?.viaduct) return true;
  return /^Kas\s+[124]\s+minut/i.test(String(plan?.intensity || order.intensity || ''));
}
