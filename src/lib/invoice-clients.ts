import type { Order } from '@/types';

export function matchesDentsuLatvia(label: string): boolean {
  return /dentsu\s+latvia/i.test(label.trim());
}

export function isDentsuLatviaOrder(order: Pick<Order, 'client' | 'agency'>): boolean {
  const client = order.client?.trim() ?? '';
  const agency = order.agency?.trim() ?? '';
  return matchesDentsuLatvia(client) || matchesDentsuLatvia(agency);
}
