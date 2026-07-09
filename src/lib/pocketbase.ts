import { config } from '@/config';
import {
  normalizeOrder,
  normalizeOrders,
  orderPriceNeedsPersistSync,
} from '@/lib/order-price';
import { Order, Screen, Partner } from '@/types';

const POCKETBASE_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;
const SCREENS_COLLECTION = 'screens';
const PARTNERS_COLLECTION = 'partners';

// In-memory cache for screen names (60 min) - sumažina PocketBase apkrovą
const screenNamesCache = new Map<string, { data: Record<string, Screen>; expires: number }>();
const partnersCache = new Map<string, { data: Partner[]; expires: number }>();
const SCREEN_CACHE_TTL = 60 * 60 * 1000;

// Connection pool and retry configuration
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class PocketBaseService {
  private static connectionPool = new Map<string, { lastUsed: number; inUse: boolean }>();
  private static requestQueue: Array<() => Promise<unknown>> = [];
  private static isProcessingQueue = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${POCKETBASE_URL}/api/collections/${COLLECTION}${endpoint}`;
    
    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300', // 5 minutes cache
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('⏰ PocketBase request timeout:', url);
        throw new Error('Request timeout');
      }
      
      console.error('❌ PocketBase request failed:', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async makeRequestWithRetry(endpoint: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<any> {
    try {
      return await this.makeRequest(endpoint, options);
    } catch (error) {
      if (retries > 0 && error instanceof Error && error.message !== 'Request timeout') {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequestWithRetry(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  private static async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch {
          console.error('❌ Queue request failed');
        }
      }
    }
    
    this.isProcessingQueue = false;
  }

  private static queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  static async getOrders(params: {
    page?: number;
    perPage?: number;
    sort?: string;
    filter?: string;
  } = {}): Promise<{ items: Order[]; totalItems: number; totalPages: number }> {
    const { page = 1, perPage = 25, sort = '-updated', filter = '' } = params; // Reduced perPage from 50 to 25
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      sort,
      ...(filter && { filter }),
    });

    const url = `/records?${queryParams}`;
    
    const response = await this.makeRequestWithRetry(url);
    
    return {
      items: normalizeOrders(response.items || []),
      totalItems: response.totalItems || 0,
      totalPages: response.totalPages || 0,
    };
  }

  static async getOrder(id: string): Promise<Order> {
    const raw = await this.makeRequestWithRetry(`/records/${id}`);
    return this.hydrateOrder(raw);
  }

  /** Jei details.total ≠ final_price — pataiso PB fone (be skaičiuoklės refresh). */
  static async syncOrderPriceIfNeeded(order: Order): Promise<Order> {
    const { needed, canonicalPrice } = orderPriceNeedsPersistSync(order);
    if (!needed) {
      return normalizeOrder(order);
    }

    try {
      const updated = await this.makeRequestWithRetry(`/records/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ final_price: canonicalPrice }),
      });
      return normalizeOrder(updated);
    } catch (error) {
      console.warn('Order price sync failed:', order.id, error);
      return normalizeOrder(order);
    }
  }

  private static hydrateOrder(raw: Order): Order {
    const normalized = normalizeOrder(raw);
    const { needed, canonicalPrice } = orderPriceNeedsPersistSync(raw);

    if (needed) {
      void this.makeRequestWithRetry(`/records/${raw.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ final_price: canonicalPrice }),
      }).catch((error) => {
        console.warn('Background order price sync failed:', raw.id, error);
      });
    }

    return normalized;
  }

  static async searchOrders(query: string): Promise<Order[]> {
    // Debounce search requests
    return this.queueRequest(async () => {
      const response = await this.makeRequestWithRetry(`/records?filter=(client~"${query}" || agency~"${query}" || invoice_id~"${query}")&perPage=25`);
      return normalizeOrders(response.items || []);
    });
  }

  static async updateOrder(id: string, data: Partial<Order>): Promise<Order> {
    const updated = await this.makeRequestWithRetry(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeOrder(updated);
  }

  static async deleteOrder(id: string): Promise<void> {
    await this.makeRequestWithRetry(`/records/${id}`, {
      method: 'DELETE',
    });
  }

  static async getQuoteByOrderId(orderId: string): Promise<{ link: string; viaduct_link: string } | null> {
    try {
      const url = `${POCKETBASE_URL}/api/collections/quotes/records?filter=order_id="${orderId}"&perPage=1`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=600', // 10 minutes cache for quotes
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout for quotes
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.items?.[0] || null;
    } catch {
      return null;
    }
  }

  // Batch operations for better performance
  static async getOrdersBatch(orderIds: string[]): Promise<Order[]> {
    if (orderIds.length === 0) return [];
    
    const batchSize = 10; // Process in batches of 10
    const results: Order[] = [];
    
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      const batchFilter = batch.map(id => `id="${id}"`).join(' || ');
      
      try {
        const response = await this.makeRequestWithRetry(`/records?filter=(${batchFilter})&perPage=${batchSize}`);
        results.push(...normalizeOrders(response.items || []));
      } catch (error) {
        console.error('❌ Batch request failed:', error);
      }
    }
    
    return results;
  }

  /** Gauti visus partnerius – cache 60 min */
  static async getPartners(): Promise<Partner[]> {
    const cacheKey = 'partners_all';
    const cached = partnersCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const url = `${POCKETBASE_URL}/api/collections/${PARTNERS_COLLECTION}/records?perPage=100`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      const items = data.items || [];
      const result = items.map((p: { id: string; name: string; slug?: string }) => ({
        id: p.id,
        name: p.name || 'Nežinomas',
        slug: p.slug,
      }));
      partnersCache.set(cacheKey, { data: result, expires: Date.now() + SCREEN_CACHE_TTL });
      return result;
    } catch {
      return [];
    }
  }

  /** Gauti ekranus su partner info (expand=partner) – viena batch užklausa */
  static async getScreensWithPartner(screenIds: string[]): Promise<Record<string, Screen>> {
    const uniqueIds = [...new Set(screenIds)].filter(Boolean);
    if (uniqueIds.length === 0) return {};

    const cacheKey = `screens_partner_${uniqueIds.sort().join(',')}`;
    const cached = screenNamesCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const filter = uniqueIds.map(id => `id="${id}"`).join(' || ');
      const url = `${POCKETBASE_URL}/api/collections/${SCREENS_COLLECTION}/records?filter=(${filter})&perPage=100&expand=partner`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return this.emptyScreenNames(uniqueIds);

      const data = await response.json();
      const items = data.items || [];
      const result: Record<string, Screen> = {};
      for (const item of items) {
        const partnerId = item.partner ?? item.expand?.partner?.id;
        result[item.id] = {
          id: item.id,
          name: item.name || 'Nežinomas',
          city: item.city,
          type: item.type,
          viaduct: item.viaduct,
          partner: partnerId,
        };
      }
      for (const id of uniqueIds) {
        if (!result[id]) result[id] = { id, name: `ID: ${id.slice(0, 8)}...` };
      }
      screenNamesCache.set(cacheKey, { data: result, expires: Date.now() + SCREEN_CACHE_TTL });
      return result;
    } catch {
      return this.emptyScreenNames(uniqueIds);
    }
  }

  /** Gauti visus ekranus (cache 60 min) */
  static async getAllScreens(): Promise<Screen[]> {
    const cacheKey = 'screens_all';
    const cached = screenNamesCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return Object.values(cached.data);

    try {
      const url = `${POCKETBASE_URL}/api/collections/${SCREENS_COLLECTION}/records?perPage=1000`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];

      const data = await response.json();
      const items = data.items || [];
      const byId: Record<string, Screen> = {};
      for (const item of items) {
        byId[item.id] = {
          id: item.id,
          name: item.name || 'Nezinomas',
          city: item.city,
          type: item.type,
          viaduct: item.viaduct,
          partner: item.partner,
        };
      }
      screenNamesCache.set(cacheKey, { data: byId, expires: Date.now() + SCREEN_CACHE_TTL });
      return Object.values(byId);
    } catch {
      return [];
    }
  }

  /** Gauti ekranų pavadinimus pagal ID masyvą – VIENA batch užklausa (ne N atskirų) */
  static async getScreenNames(screenIds: string[]): Promise<Record<string, Screen>> {
    const uniqueIds = [...new Set(screenIds)].filter(Boolean);
    if (uniqueIds.length === 0) return {};

    const cacheKey = uniqueIds.sort().join(',');
    const cached = screenNamesCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const filter = uniqueIds.map(id => `id="${id}"`).join(' || ');
      const url = `${POCKETBASE_URL}/api/collections/${SCREENS_COLLECTION}/records?filter=(${filter})&perPage=100`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return this.emptyScreenNames(uniqueIds);

      const data = await response.json();
      const items = data.items || [];
      const result: Record<string, Screen> = {};
      for (const item of items) {
        result[item.id] = {
          id: item.id,
          name: item.name || 'Nežinomas',
          city: item.city,
          type: item.type,
          viaduct: item.viaduct,
        };
      }
      for (const id of uniqueIds) {
        if (!result[id]) result[id] = { id, name: `ID: ${id.slice(0, 8)}...` };
      }

      screenNamesCache.set(cacheKey, { data: result, expires: Date.now() + SCREEN_CACHE_TTL });
      return result;
    } catch {
      return this.emptyScreenNames(uniqueIds);
    }
  }

  private static emptyScreenNames(ids: string[]): Record<string, Screen> {
    const r: Record<string, Screen> = {};
    for (const id of ids) r[id] = { id, name: `ID: ${id.slice(0, 8)}...` };
    return r;
  }

  private static campaignScreensCache = new Map<
    string,
    { data: Record<string, unknown>[]; expires: number }
  >();

  /** Užsakymo ekranai eksportui — pilni įrašai iš PocketBase (kainos, OTS, partner) */
  static async getCampaignScreensByIds(
    screenIds: string[]
  ): Promise<Record<string, unknown>[]> {
    const uniqueIds = [...new Set(screenIds)].filter(Boolean);
    if (uniqueIds.length === 0) return [];

    const batchSize = 40;
    const items: Record<string, unknown>[] = [];

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const filter = batch.map((id) => `id="${id}"`).join(' || ');
      try {
        const url = `${POCKETBASE_URL}/api/collections/${SCREENS_COLLECTION}/records?filter=(${filter})&perPage=${batchSize}`;
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) continue;
        const data = await response.json();
        items.push(...((data.items || []) as Record<string, unknown>[]));
      } catch {
        // skip batch on failure
      }
    }

    return items;
  }

  /** Visi ekranai skaičiuoklės eksportui (su kainomis, OTS) */
  static async getCampaignScreens(viaduct: boolean): Promise<Record<string, unknown>[]> {
    const cacheKey = viaduct ? 'v' : 'u';
    const cached = this.campaignScreensCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const filter = viaduct ? 'viaduct = true' : 'viaduct = false';
      const url = `${POCKETBASE_URL}/api/collections/${SCREENS_COLLECTION}/records?filter=${encodeURIComponent(filter)}&perPage=500&sort=name`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return [];

      const data = await response.json();
      const items = (data.items || []) as Record<string, unknown>[];
      this.campaignScreensCache.set(cacheKey, {
        data: items,
        expires: Date.now() + SCREEN_CACHE_TTL,
      });
      return items;
    } catch {
      return [];
    }
  }

  static async getBundles(): Promise<
    Array<{ id: string; name: string; discount: number; screens: string[] }>
  > {
    try {
      const url = `${POCKETBASE_URL}/api/collections/bundles/records?perPage=100`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.items || []).map(
        (b: { id: string; name: string; discount: number; screens: string[] }) => ({
          id: b.id,
          name: b.name,
          discount: b.discount,
          screens: b.screens || [],
        })
      );
    } catch {
      return [];
    }
  }

  // Health check method
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
