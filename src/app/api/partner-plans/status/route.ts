import { NextResponse } from 'next/server';
import { getPartnerDeliveryStatusesForOrder } from '@/lib/partner-deliveries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get('orderId')?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'Trūksta orderId' }, { status: 400 });
  }

  const statuses = await getPartnerDeliveryStatusesForOrder(orderId);
  return NextResponse.json({ orderId, statuses });
}
