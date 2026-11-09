/** Užsakymas yra viadukų, net jei žodžio nėra kliento varde. */
export function isViaductOrder(order: {
  viaduct?: boolean;
  intensity?: string;
  details?: unknown;
}): boolean {
  if (order.viaduct) return true;
  const plan = (order.details as { plan?: { viaduct?: boolean; intensity?: string } } | undefined)
    ?.plan;
  if (plan?.viaduct) return true;
  return /^Kas\s+[124]\s+minut/i.test(String(plan?.intensity || order.intensity || ''));
}
