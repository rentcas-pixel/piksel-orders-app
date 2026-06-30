/**
 * Sukuria agentūros portalo vartotoją.
 *
 * Naudojimas:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/create-agency-user.ts open user@agency.lt TempPass123!
 *
 * Reikalavimai:
 *   - Supabase migracija 20260702_agency_portal_auth.sql pritaikyta
 *   - agencies.slug egzistuoja (pvz. open, bpn, omd)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/index';
import { AGENCY_PUBLIC_HOST } from '../src/lib/agency-portal-paths';

const [, , agencySlug, email, password] = process.argv;

if (!agencySlug || !email || !password) {
  console.error('Naudojimas: npx tsx scripts/create-agency-user.ts <agency-slug> <email> <password>');
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
  const { data: agency, error: agencyError } = await admin
    .from('agencies')
    .select('id, name, slug')
    .eq('slug', agencySlug)
    .maybeSingle();

  if (agencyError) throw agencyError;
  if (!agency) {
    throw new Error(`Agentūra su slug "${agencySlug}" nerasta. Paleisk migraciją arba įrašyk agencies.`);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) throw createError;
  if (!created.user) throw new Error('Vartotojas nesukurtas');

  const { error: linkError } = await admin.from('agency_users').insert({
    user_id: created.user.id,
    agency_id: agency.id,
  });

  if (linkError) throw linkError;

  console.log(`Sukurta: ${email} → ${agency.name} (${agency.slug})`);
  console.log(`Prisijungimas: https://${AGENCY_PUBLIC_HOST}/login`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
