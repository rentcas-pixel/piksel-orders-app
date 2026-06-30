import { createClient } from '@supabase/supabase-js';
import { config } from '@/config';

export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error('Trūksta SUPABASE_SERVICE_ROLE_KEY serverio aplinkoje.');
  }

  return createClient(config.supabase.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
