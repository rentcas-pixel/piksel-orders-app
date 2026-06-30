import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { config } from '@/config';

let browserClient: SupabaseClient | null = null;

function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(config.supabase.url, config.supabase.anonKey);
  }
  return browserClient;
}

function getServerFallbackSupabase(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey);
}

export function getSupabase(): SupabaseClient {
  if (typeof window !== 'undefined') {
    return getBrowserSupabase();
  }
  return getServerFallbackSupabase();
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
