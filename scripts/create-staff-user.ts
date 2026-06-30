/**
 * Sukuria vidinės komandos vartotoją (staff arba admin).
 *
 * Naudojimas:
 *   npx tsx scripts/create-staff-user.ts admin renatas@piksel.lt TavoSlaptazodis
 *
 * Raktas: SUPABASE_SERVICE_ROLE_KEY .env.local arba aplinkos kintamasis.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/index';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const [, , role, email, password] = process.argv;

if (!role || !email || !password || (role !== 'staff' && role !== 'admin')) {
  console.error('Naudojimas: npx tsx scripts/create-staff-user.ts <staff|admin> <email> <password>');
  process.exit(1);
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('Trūksta SUPABASE_SERVICE_ROLE_KEY aplinkos kintamojo.');
  process.exit(1);
}

const admin = createClient(config.supabase.url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) throw createError;
  if (!created.user) throw new Error('Vartotojas nesukurtas');

  const { error: linkError } = await admin.from('app_users').upsert({
    user_id: created.user.id,
    role,
  });

  if (linkError) throw linkError;

  console.log(`Sukurta: ${email} → ${role}`);
  console.log('Prisijungimas: /login');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
