import { config } from '@/config';
import { Order } from '@/types';

const POCKETBASE_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;

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
    console.log('🔍 PocketBase full URL:', url);
    
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
        console.log(`🔄 Retrying request (${retries} attempts left)...`);
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
    console.log('🌐 PocketBase request URL:', url);
    console.log('🌐 PocketBase filter:', filter);
    
    const response = await this.makeRequestWithRetry(url);
    
    console.log('📦 PocketBase raw response:', response);
    
    return {
      items: response.items || [],
      totalItems: response.totalItems || 0,
      totalPages: response.totalPages || 0,
    };
  }

  static async getOrder(id: string): Promise<Order> {
    return this.makeRequestWithRetry(`/records/${id}`);
  }

  static async searchOrders(query: string): Promise<Order[]> {
    // Debounce search requests
    return this.queueRequest(async () => {
      const response = await this.makeRequestWithRetry(`/records?filter=(client~"${query}" || agency~"${query}" || invoice_id~"${query}")&perPage=25`);
      return response.items || [];
    });
  }

  static async updateOrder(id: string, data: Partial<Order>): Promise<Order> {
    return this.makeRequestWithRetry(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static async deleteOrder(id: string): Promise<void> {
    await this.makeRequestWithRetry(`/records/${id}`, {
      method: 'DELETE',
    });
  }

  static async getQuoteByOrderId(orderId: string): Promise<{ link: string; viaduct_link: string } | null> {
    try {
      const url = `${POCKETBASE_URL}/api/collections/quotes/records?filter=order_id="${orderId}"&perPage=1`;
      console.log('🔍 Trying to fetch quote from:', url);
      
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
      console.log('No quote found for order:', orderId);
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
        results.push(...(response.items || []));
      } catch (error) {
        console.error('❌ Batch request failed:', error);
      }
    }
    
    return results;
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
