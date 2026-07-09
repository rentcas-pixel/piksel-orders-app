import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as browserSupabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

let serverClient: SupabaseClient | null = null;

function resolveEmailSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    return browserSupabase;
  }

  if (!serverClient) {
    serverClient = createSupabaseAdminClient();
  }
  return serverClient;
}

/** El. pašto DB klientas — serveryje naudoja service role (RLS apeinamas po admin auth). */
export const emailDb = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = resolveEmailSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
