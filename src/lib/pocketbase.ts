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

    const url = `/records?${queryParams}`;
    console.log('🌐 PocketBase request URL:', url);
    console.log('🌐 PocketBase filter:', filter);
    
    const response = await this.makeRequest(url);
    
    console.log('📦 PocketBase raw response:', response);
    
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

  static async updateOrder(id: string, data: Partial<Order>): Promise<Order> {
    const response = await this.makeRequest(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response;
  }

  static async deleteOrder(id: string): Promise<void> {
    await this.makeRequest(`/records/${id}`, {
      method: 'DELETE',
    });
  }
}
