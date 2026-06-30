import { supabase } from '@/lib/supabase';

export interface BankSettings {
  account_balance: number | null;
  balance_as_of: string | null;
  updated_at: string;
}

export class BankSettingsService {
  static async get(): Promise<BankSettings> {
    const { data, error } = await supabase.from('bank_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;

    return {
      account_balance: data?.account_balance != null ? Number(data.account_balance) : null,
      balance_as_of: data?.balance_as_of ?? null,
      updated_at: data?.updated_at ?? new Date().toISOString(),
    };
  }

  static async setAccountBalance(balance: number, balanceAsOf?: string): Promise<BankSettings> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('bank_settings')
      .upsert({
        id: 1,
        account_balance: balance,
        balance_as_of: balanceAsOf ?? new Date().toISOString().slice(0, 10),
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      account_balance: Number(data.account_balance),
      balance_as_of: data.balance_as_of,
      updated_at: data.updated_at,
    };
  }
}
