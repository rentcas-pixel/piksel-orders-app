import { NextResponse } from 'next/server';
import { alertsByOrderId } from '@/lib/partner-confirm-alert';
import { listPartnerDeliveriesForOrders } from '@/lib/partner-deliveries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ORDER_IDS = 50;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('orderIds') || '';
  const orderIds = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_ORDER_IDS
  );
  if (orderIds.length === 0) {
    return NextResponse.json({ alerts: {} });
  }

  const rows = await listPartnerDeliveriesForOrders(orderIds);
  return NextResponse.json({ alerts: alertsByOrderId(rows) });
}
