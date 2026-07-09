/**
 * Patikrina ar order_spec_prices lentelė egzistuoja.
 * Jei ne — išveda SQL migracijos instrukciją.
 *
 * Paleisti: npx tsx scripts/apply-order-spec-prices-migration.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), '.env.local');
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || 'https://titkwifsatjemnquyrij.supabase.co';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('Trūksta SUPABASE_SERVICE_ROLE_KEY .env.local faile.');
    process.exit(1);
  }

  const sqlPath = resolve(process.cwd(), 'supabase/migrations/20260709_order_spec_prices.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from('order_spec_prices').select('order_id').limit(1);
  if (!error) {
    console.log('OK — order_spec_prices lentelė jau egzistuoja.');
    return;
  }

  console.log('Lentelė order_spec_prices nerasta.\n');
  console.log('1. Atidarykite Supabase Dashboard → SQL Editor');
  console.log('2. Nukopijuokite ir paleiskite:\n');
  console.log(sql);
  console.log('\nFailas:', sqlPath);
  process.exit(1);
}

void main();
