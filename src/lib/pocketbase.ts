import { config } from '@/config';
import { Order } from '@/types';

const POCKETBASE_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;

export class PocketBaseService {
  private static async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${POCKETBASE_URL}/api/collections/${COLLECTION}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('PocketBase request failed:', error);
      throw error;
    }
  }

  static async getOrders(params: {
    page?: number;
    perPage?: number;
    sort?: string;
    filter?: string;
  } = {}): Promise<{ items: Order[]; totalItems: number; totalPages: number }> {
    const { page = 1, perPage = 50, sort = '-updated', filter = '' } = params;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      sort,
      ...(filter && { filter }),
    });

    const response = await this.makeRequest(`/records?${queryParams}`);
    
    return {
      items: response.items || [],
      totalItems: response.totalItems || 0,
      totalPages: response.totalPages || 0,
    };
  }

  static async getOrder(id: string): Promise<Order> {
    const response = await this.makeRequest(`/records/${id}`);
    return response;
  }

  static async searchOrders(query: string): Promise<Order[]> {
    const response = await this.makeRequest(`/records?filter=(client~"${query}" || agency~"${query}" || invoice_id~"${query}")`);
    return response.items || [];
  }
}
