import { supabase } from '@/lib/supabase';
import type { BillingCompany } from '@/types';

export class BillingCompanyService {
  static async search(query: string, limit = 10): Promise<BillingCompany[]> {
    const q = query.trim();
    if (!q) return this.getAll(limit);

    const { data, error } = await supabase
      .from('billing_companies')
      .select('*')
      .or(`name.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order('name')
      .limit(limit);

    if (error) {
      console.error('billing_companies search:', error);
      return [];
    }
    return data ?? [];
  }

  static async getAll(limit = 100): Promise<BillingCompany[]> {
    const { data, error } = await supabase
      .from('billing_companies')
      .select('*')
      .order('name')
      .limit(limit);

    if (error) {
      console.error('billing_companies getAll:', error);
      return [];
    }
    return data ?? [];
  }

  static async findBestMatch(label: string): Promise<BillingCompany | null> {
    const q = label.trim();
    if (!q) return null;

    const { data: exact, error: exactError } = await supabase
      .from('billing_companies')
      .select('*')
      .or(`name.ilike.${q},full_name.ilike.${q}`)
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.error('billing_companies findBestMatch exact:', exactError);
    }
    if (exact) return exact;

    const { data, error } = await supabase
      .from('billing_companies')
      .select('*')
      .or(`name.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order('name')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('billing_companies findBestMatch:', error);
      return null;
    }
    return data;
  }

  static async create(
    company: Omit<BillingCompany, 'id' | 'created_at' | 'updated_at'>
  ): Promise<BillingCompany> {
    const { data, error } = await supabase
      .from('billing_companies')
      .insert([{ ...company, updated_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
