import { createPartnerDeliveryToken, type PartnerDelivery, type PartnerDeliveryStage } from '@/lib/partner-deliveries';

/** Shared in-process store (lokalus Next process) — veikia tarp /api ir /c/[token]. */
const globalStore = globalThis as typeof globalThis & {
  __pikselPartnerDeliveries?: Map<string, PartnerDelivery>;
  __pikselPartnerDeliveriesByOrder?: Map<string, Set<string>>;
};

function store(): Map<string, PartnerDelivery> {
  if (!globalStore.__pikselPartnerDeliveries) {
    globalStore.__pikselPartnerDeliveries = new Map();
  }
  return globalStore.__pikselPartnerDeliveries;
}

function orderIndex(): Map<string, Set<string>> {
  if (!globalStore.__pikselPartnerDeliveriesByOrder) {
    globalStore.__pikselPartnerDeliveriesByOrder = new Map();
  }
  return globalStore.__pikselPartnerDeliveriesByOrder;
}

export function memoryGetByToken(token: string): PartnerDelivery | null {
  return store().get(token) ?? null;
}

export function memoryListByOrder(orderId: string): PartnerDelivery[] {
  const tokens = orderIndex().get(orderId);
  if (!tokens) return [];
  return [...tokens]
    .map((token) => store().get(token))
    .filter((row): row is PartnerDelivery => Boolean(row));
}

export function memorySaveDelivery(input: {
  orderId: string;
  partnerId: string;
  partnerName: string;
  campaignLabel?: string | null;
  stage: PartnerDeliveryStage;
  toEmail: string;
  resendId?: string | null;
  token?: string;
}): PartnerDelivery {
  const token = input.token || createPartnerDeliveryToken();
  const existing = memoryListByOrder(input.orderId).find(
    (row) =>
      row.partner_id === input.partnerId && row.stage === input.stage
  );

  if (existing) {
    store().delete(existing.token);
    const set = orderIndex().get(input.orderId);
    set?.delete(existing.token);
  }

  const row: PartnerDelivery = {
    id: `mem_${token}`,
    order_id: input.orderId,
    partner_id: input.partnerId,
    partner_name: input.partnerName,
    campaign_label: input.campaignLabel ?? null,
    stage: input.stage,
    token,
    to_email: input.toEmail,
    resend_id: input.resendId ?? null,
    sent_at: new Date().toISOString(),
    confirmed_at: null,
  };

  store().set(token, row);
  const set = orderIndex().get(input.orderId) ?? new Set<string>();
  set.add(token);
  orderIndex().set(input.orderId, set);
  return row;
}

export function memoryConfirmByToken(token: string): PartnerDelivery | null {
  const row = store().get(token);
  if (!row) return null;
  const now = row.confirmed_at || new Date().toISOString();
  let result: PartnerDelivery | null = null;
  for (const other of memoryListByOrder(row.order_id)) {
    if (other.partner_id !== row.partner_id) continue;
    const next = { ...other, confirmed_at: other.confirmed_at || now };
    store().set(other.token, next);
    if (other.token === token) result = next;
  }
  return result;
}
