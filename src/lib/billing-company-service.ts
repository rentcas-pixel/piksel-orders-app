import { companyNameMatches, foldSearchText } from '@/lib/company-name-match';
import { supabase } from '@/lib/supabase';
import type { BillingCompany } from '@/types';

const CACHE_TTL_MS = 60_000;

let companiesCache: BillingCompany[] | null = null;
let companiesCacheAt = 0;

function logBillingCompaniesError(context: string, error: unknown): void {
  if (!error || typeof error !== 'object') {
    console.error(`billing_companies ${context}:`, error);
    return;
  }
  const record = error as { message?: string; code?: string; details?: string };
  console.error(`billing_companies ${context}:`, {
    message: record.message,
    code: record.code,
    details: record.details,
  });
}

function companyHaystack(company: BillingCompany): string {
  return foldSearchText(
    [company.name, company.full_name, company.company_code, company.vat_code, company.address]
      .filter(Boolean)
      .join(' ')
  );
}

function matchesSearchQuery(company: BillingCompany, query: string): boolean {
  const q = foldSearchText(query);
  if (!q) return true;
  return companyHaystack(company).includes(q);
}

export class BillingCompanyService {
  private static async listCompanies(limit = 500): Promise<BillingCompany[]> {
    const now = Date.now();
    if (companiesCache && now - companiesCacheAt < CACHE_TTL_MS) {
      return companiesCache;
    }

    const { data, error } = await supabase
      .from('billing_companies')
      .select('*')
      .order('name')
      .limit(limit);

    if (error) {
      logBillingCompaniesError('getAll', error);
      return companiesCache ?? [];
    }

    companiesCache = data ?? [];
    companiesCacheAt = now;
    return companiesCache;
  }

  static invalidateCache(): void {
    companiesCache = null;
    companiesCacheAt = 0;
  }

  static async search(query: string, limit = 10): Promise<BillingCompany[]> {
    const q = query.trim();
    const all = await this.listCompanies();
    if (!q) return all.slice(0, limit);
    return all.filter((company) => matchesSearchQuery(company, q)).slice(0, limit);
  }

  static async getAll(limit = 100): Promise<BillingCompany[]> {
    return (await this.listCompanies(limit)).slice(0, limit);
  }

  static async findBestMatch(label: string): Promise<BillingCompany | null> {
    const q = label.trim();
    if (!q) return null;

    const all = await this.listCompanies();
    const exact = all.find(
      (company) =>
        companyNameMatches(company.full_name || company.name, q) ||
        companyNameMatches(company.name, q)
    );
    if (exact) return exact;

    return all.find((company) => matchesSearchQuery(company, q)) ?? null;
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
    this.invalidateCache();
    return data;
  }
}
