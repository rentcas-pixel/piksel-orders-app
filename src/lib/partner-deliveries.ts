import { randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';
import {
  memoryConfirmByToken,
  memoryGetByToken,
  memoryListByOrder,
  memorySaveDelivery,
} from '@/lib/partner-deliveries-memory';

export type PartnerDeliveryStage = 'plan' | 'clips';

export type PartnerDelivery = {
  id: string;
  order_id: string;
  partner_id: string;
  partner_name: string;
  campaign_label: string | null;
  stage: PartnerDeliveryStage;
  token: string;
  to_email: string;
  resend_id: string | null;
  sent_at: string;
  confirmed_at: string | null;
};

export type PartnerDeliveryStatus = {
  partnerId: string;
  partnerName: string;
  stage: PartnerDeliveryStage;
  sent: boolean;
  confirmed: boolean;
  sentAt: string | null;
  confirmedAt: string | null;
  toEmail: string | null;
};

export function createPartnerDeliveryToken(): string {
  return randomBytes(12).toString('base64url');
}

export async function savePartnerDelivery(input: {
  orderId: string;
  partnerId: string;
  partnerName: string;
  campaignLabel?: string | null;
  stage: PartnerDeliveryStage;
  toEmail: string;
  resendId?: string | null;
  token?: string;
}): Promise<PartnerDelivery> {
  const token = input.token || createPartnerDeliveryToken();
  const payload = {
    order_id: input.orderId,
    partner_id: input.partnerId,
    partner_name: input.partnerName,
    campaign_label: input.campaignLabel ?? null,
    stage: input.stage,
    token,
    to_email: input.toEmail,
    resend_id: input.resendId ?? null,
    sent_at: new Date().toISOString(),
    confirmed_at: null as string | null,
  };

  try {
    const { data, error } = await supabase
      .from('partner_deliveries')
      .upsert(payload, { onConflict: 'order_id,partner_id,stage' })
      .select('*')
      .maybeSingle();

    if (!error && data) {
      // Mirror to memory so /c works even if later reads miss
      memorySaveDelivery({
        orderId: input.orderId,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        campaignLabel: input.campaignLabel,
        stage: input.stage,
        toEmail: input.toEmail,
        resendId: input.resendId,
        token: data.token,
      });
      return data as PartnerDelivery;
    }
  } catch {
    // table may not exist yet — memory fallback
  }

  return memorySaveDelivery({
    orderId: input.orderId,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    campaignLabel: input.campaignLabel,
    stage: input.stage,
    toEmail: input.toEmail,
    resendId: input.resendId,
    token,
  });
}

export async function getPartnerDeliveryByToken(
  token: string
): Promise<PartnerDelivery | null> {
  const mem = memoryGetByToken(token);
  if (mem) return mem;

  try {
    const { data, error } = await supabase
      .from('partner_deliveries')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (error || !data) return null;
    return data as PartnerDelivery;
  } catch {
    return null;
  }
}

export async function confirmPartnerDeliveryByToken(
  token: string
): Promise<PartnerDelivery | null> {
  const mem = memoryConfirmByToken(token);
  if (mem) {
    try {
      await supabase
        .from('partner_deliveries')
        .update({ confirmed_at: mem.confirmed_at })
        .eq('token', token);
    } catch {
      // ignore
    }
    return mem;
  }

  const now = new Date().toISOString();
  try {
    const { data: existing, error: readError } = await supabase
      .from('partner_deliveries')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (readError || !existing) return null;

    if (existing.confirmed_at) {
      return existing as PartnerDelivery;
    }

    const { data, error } = await supabase
      .from('partner_deliveries')
      .update({ confirmed_at: now })
      .eq('token', token)
      .select('*')
      .maybeSingle();
    if (error || !data) return existing as PartnerDelivery;
    return data as PartnerDelivery;
  } catch {
    return null;
  }
}

export async function listPartnerDeliveriesForOrder(
  orderId: string
): Promise<PartnerDelivery[]> {
  const mem = memoryListByOrder(orderId);
  try {
    const { data, error } = await supabase
      .from('partner_deliveries')
      .select('*')
      .eq('order_id', orderId)
      .order('sent_at', { ascending: false });
    if (!error && data?.length) {
      const byKey = new Map<string, PartnerDelivery>();
      for (const row of data as PartnerDelivery[]) {
        byKey.set(`${row.partner_id}:${row.stage}`, row);
      }
      for (const row of mem) {
        const key = `${row.partner_id}:${row.stage}`;
        if (!byKey.has(key)) byKey.set(key, row);
      }
      return [...byKey.values()];
    }
  } catch {
    // ignore
  }
  return mem;
}

export async function getPartnerDeliveryStatusesForOrder(
  orderId: string
): Promise<PartnerDeliveryStatus[]> {
  const rows = await listPartnerDeliveriesForOrder(orderId);
  return rows.map((row) => ({
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    stage: row.stage,
    sent: Boolean(row.sent_at),
    confirmed: Boolean(row.confirmed_at),
    sentAt: row.sent_at,
    confirmedAt: row.confirmed_at,
    toEmail: row.to_email,
  }));
}
