import { config } from '@/config';
import type { Order } from '@/types';

const POCKETBASE_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;
const REQUEST_TIMEOUT = 10000;

async function pocketBaseFetch(endpoint: string): Promise<unknown> {
  const url = `${POCKETBASE_URL}/api/collections/${COLLECTION}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`PocketBase HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function getOrdersServer(params: {
  page?: number;
  perPage?: number;
  sort?: string;
  filter?: string;
} = {}): Promise<{ items: Order[]; totalItems: number; totalPages: number }> {
  const { page = 1, perPage = 25, sort = '-updated', filter = '' } = params;
  const queryParams = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    sort,
    ...(filter && { filter }),
  });

  const response = (await pocketBaseFetch(`/records?${queryParams}`)) as {
    items?: Order[];
    totalItems?: number;
    totalPages?: number;
  };

  return {
    items: response.items ?? [],
    totalItems: response.totalItems ?? 0,
    totalPages: response.totalPages ?? 0,
  };
}

export async function getOrderServer(id: string): Promise<Order | null> {
  try {
    return (await pocketBaseFetch(`/records/${id}`)) as Order;
  } catch {
    return null;
  }
}
